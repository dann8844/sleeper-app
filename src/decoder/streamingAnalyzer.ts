import * as FileSystem from 'expo-file-system/legacy';
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

const CHUNK_BYTES = 10 * 1024 * 1024; // 10 MB per read

// ─── File I/O ─────────────────────────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readRange(uri: string, position: number, length: number): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return b64ToBytes(b64);
}

// ─── WAV Header ───────────────────────────────────────────────────────────────

interface WavInfo {
  dataOffset:    number;
  dataSize:      number;
  sampleRate:    number;
  bitsPerSample: number;
}

function parseWavHeader(h: Uint8Array): WavInfo {
  if (h[0] !== 0x52 || h[1] !== 0x49 || h[2] !== 0x46 || h[3] !== 0x46) {
    throw new Error('Not a RIFF/WAV file');
  }
  const view = new DataView(h.buffer, h.byteOffset, h.byteLength);
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  let sampleRate = 8000;   // fallback for malformed headers
  let bitsPerSample = 16;

  while (offset + 8 <= h.length) {
    const id   = String.fromCharCode(h[offset], h[offset+1], h[offset+2], h[offset+3]);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      sampleRate    = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataSize   = size;
      break;
    }
    offset += 8 + size;
  }

  if (dataOffset === -1) throw new Error('WAV file has no data chunk');
  return { dataOffset, dataSize, sampleRate, bitsPerSample };
}

// ─── Streaming Analysis ───────────────────────────────────────────────────────

export interface StreamingOptions {
  thresholdDb?:      number;
  windowMs?:         number;
  silenceGapMs?:     number;
  startSec?:         number;
  endSec?:           number;
  isSleepRecording?: boolean;
}

export async function analyzeWavStreaming(
  filePath: string,
  options: StreamingOptions = {}
): Promise<AnalysisReport> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

  const header = await readRange(uri, 0, 512);
  const { dataOffset, dataSize, sampleRate, bitsPerSample } = parseWavHeader(header);

  const bytesPerSample   = bitsPerSample / 8;
  const totalDurationSec = (dataSize / bytesPerSample) / sampleRate;

  const thresholdDb  = options.thresholdDb  ?? DEFAULT_THRESHOLD_DBFS;
  const windowMs     = options.windowMs     ?? DEFAULT_WINDOW_MS;
  const silenceGapMs = options.silenceGapMs ?? DEFAULT_SILENCE_GAP_MS;

  const minDurForOffsets = (DEFAULT_START_OFFSET_MIN + DEFAULT_END_OFFSET_MIN) * 60;
  const useOffsets = !!options.isSleepRecording && totalDurationSec > minDurForOffsets;
  const startSec   = options.startSec ?? (useOffsets ? DEFAULT_START_OFFSET_MIN * 60 : 0);
  const endSec     = options.endSec   ?? (useOffsets ? totalDurationSec - DEFAULT_END_OFFSET_MIN * 60 : totalDurationSec);

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
  return buildReport(filePath, allWindows, events, thresholdDb, windowMs, silenceGapMs, startSec, endSec, totalDurationSec, sampleRate);
}
