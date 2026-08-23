import {
  DEFAULT_THRESHOLD_DBFS,
  DEFAULT_WINDOW_MS,
  DEFAULT_SILENCE_GAP_MS,
  DEFAULT_START_OFFSET_MIN,
  DEFAULT_END_OFFSET_MIN,
  detectNoiseEvents,
  buildReport,
} from '../analysis/engine';
import { WindowResult, AnalysisReport } from '../analysis/types';
import { HEADER_BYTES, parseWavHeader, readRange, toFileUri } from './wavReader';

const CHUNK_BYTES = 10 * 1024 * 1024; // 10 MB per read

// ─── Streaming Analysis ───────────────────────────────────────────────────────

export interface StreamingOptions {
  thresholdDb?:      number;
  windowMs?:         number;
  silenceGapMs?:     number;
  startSec?:         number;
  endSec?:           number;
  /** Minutes skipped at the start; overrides the default when provided. */
  startOffsetMin?:   number;
  /** Minutes skipped at the end; overrides the default when provided. */
  endOffsetMin?:     number;
  isSleepRecording?: boolean;
  displayName?:      string;
}

export async function analyzeWavStreaming(
  filePath: string,
  options: StreamingOptions = {}
): Promise<AnalysisReport> {
  const uri = toFileUri(filePath);

  const header = await readRange(uri, 0, HEADER_BYTES);
  const { dataOffset, dataSize, sampleRate, bitsPerSample } = parseWavHeader(header);

  const bytesPerSample   = bitsPerSample / 8;
  const totalDurationSec = (dataSize / bytesPerSample) / sampleRate;

  const thresholdDb  = options.thresholdDb  ?? DEFAULT_THRESHOLD_DBFS;
  const windowMs     = options.windowMs     ?? DEFAULT_WINDOW_MS;
  const silenceGapMs = options.silenceGapMs ?? DEFAULT_SILENCE_GAP_MS;

  const startOffsetMin = options.startOffsetMin ?? DEFAULT_START_OFFSET_MIN;
  const endOffsetMin   = options.endOffsetMin   ?? DEFAULT_END_OFFSET_MIN;

  // Offsets are only applied if they would leave something to analyze —
  // otherwise fall back to the whole file rather than produce an empty report.
  const minDurForOffsets = (startOffsetMin + endOffsetMin) * 60;
  const useOffsets = !!options.isSleepRecording && totalDurationSec > minDurForOffsets;
  const startSec   = options.startSec ?? (useOffsets ? startOffsetMin * 60 : 0);
  const endSec     = options.endSec   ?? (useOffsets ? totalDurationSec - endOffsetMin * 60 : totalDurationSec);

  const is8bit        = bitsPerSample === 8;
  const maxAmplitude  = is8bit ? 128 : 32768;
  const windowSamples = Math.floor(sampleRate * windowMs / 1000);
  const windowBytes   = windowSamples * bytesPerSample;

  const readStart = dataOffset + Math.floor(startSec * sampleRate) * bytesPerSample;
  const readEnd   = Math.min(
    dataOffset + Math.ceil(endSec * sampleRate) * bytesPerSample,
    dataOffset + dataSize
  );

  const allWindows: WindowResult[] = [];
  let carry      = new Uint8Array(0);
  let readPos    = readStart;
  let windowIdx  = 0;

  while (readPos < readEnd) {
    const toRead = Math.min(CHUNK_BYTES, readEnd - readPos);
    const chunk  = await readRange(uri, readPos, toRead);
    readPos += toRead;

    const data = new Uint8Array(carry.length + chunk.length);
    data.set(carry);
    data.set(chunk, carry.length);

    const nWindows = Math.floor(data.length / windowBytes);
    const view16   = is8bit ? null : new DataView(data.buffer, data.byteOffset, data.byteLength);

    for (let wi = 0; wi < nWindows; wi++) {
      const base = wi * windowBytes;
      let sumSq  = 0;

      if (is8bit) {
        for (let s = 0; s < windowSamples; s++) {
          const v = data[base + s] - 128;
          sumSq += v * v;
        }
      } else {
        for (let s = 0; s < windowSamples; s++) {
          const v = view16!.getInt16(base + s * 2, true);
          sumSq += v * v;
        }
      }

      const rms = Math.sqrt(sumSq / windowSamples);
      const db  = rms === 0 ? -Infinity : 20 * Math.log10(rms / maxAmplitude);
      allWindows.push({ startMs: startSec * 1000 + windowIdx * windowMs, db, isNoise: db > thresholdDb });
      windowIdx++;
    }

    carry = data.slice(nWindows * windowBytes);
  }

  const events = detectNoiseEvents(allWindows, windowMs, silenceGapMs);
  return buildReport(filePath, allWindows, events, thresholdDb, windowMs, silenceGapMs, startSec, endSec, totalDurationSec, sampleRate, options.displayName);
}
