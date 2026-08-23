import { AnalysisReport, NoiseEvent } from '../analysis/types';
import { WavInfo, readRange, readWavInfo, toFileUri } from '../decoder/wavReader';
import { MODEL_SAMPLE_RATE, int16ToFloat32, resample, uint8ToFloat32 } from './pcm';
import { classifyWaveform } from './yamnet';

/**
 * Shortest clip handed to the model. Short events are widened with the real
 * surrounding audio — the model zero-pads anything shorter than one 0.975s
 * frame, which would skew a brief event toward "Silence".
 */
const MIN_CLIP_SEC = 1.2;
/** Longest clip. Snores are short and the onset characterises the event. */
const MAX_CLIP_SEC = 4;
/** Emit progress at most this often — a setState per event would out-cost inference. */
const PROGRESS_EVERY = 10;

export type ClassifyProgress = (done: number, total: number) => void;

async function readClip(
  uri: string,
  info: WavInfo,
  fileDurationSec: number,
  event: NoiseEvent,
): Promise<Float32Array> {
  const bytesPerSample = info.bitsPerSample / 8;

  const wanted = Math.min(MAX_CLIP_SEC, Math.max(MIN_CLIP_SEC, event.durationSec));
  const centre = (event.startSec + event.endSec) / 2;
  const start  = Math.max(0, Math.min(centre - wanted / 2, Math.max(0, fileDurationSec - wanted)));
  const length = Math.min(wanted, fileDurationSec - start);

  const byteStart = info.dataOffset + Math.floor(start * info.sampleRate) * bytesPerSample;
  const byteLen   = Math.max(bytesPerSample, Math.floor(length * info.sampleRate) * bytesPerSample);

  const bytes = await readRange(uri, byteStart, byteLen);
  const mono  = info.bitsPerSample === 8 ? uint8ToFloat32(bytes) : int16ToFloat32(bytes);
  return resample(mono, info.sampleRate, MODEL_SAMPLE_RATE);
}

/**
 * Classifies each detected event in place. Individual failures are swallowed so
 * one unreadable clip cannot sink the run; the caller treats a total failure as
 * "report without labels" rather than a failed analysis.
 */
export async function classifyEvents(
  filePath: string,
  report: AnalysisReport,
  onProgress?: ClassifyProgress,
): Promise<void> {
  const events = report.noiseEvents;
  if (events.length === 0) return;

  const uri  = toFileUri(filePath);
  const info = await readWavInfo(uri);
  const fileDurationSec = (info.dataSize / (info.bitsPerSample / 8)) / info.sampleRate;

  onProgress?.(0, events.length);

  for (let i = 0; i < events.length; i++) {
    try {
      const { verdict, labels } = await classifyWaveform(
        await readClip(uri, info, fileDurationSec, events[i]),
      );
      events[i].verdict = verdict;
      events[i].labels  = labels;
    } catch {
      // Leave this one unclassified and keep going.
    }
    if ((i + 1) % PROGRESS_EVERY === 0 || i === events.length - 1) {
      onProgress?.(i + 1, events.length);
    }
  }
}
