import { AudioLabel } from '../analysis/types';
import { MODEL_SAMPLE_RATE, int16ToFloat32, resample } from '../classify/pcm';
import { isRelevantNoise } from '../classify/relevance';
import { classifyWaveform, getSession, resetSession } from '../classify/yamnet';
import { base64ToUint8Array } from './noiseDetector';

/** Audio kept before the onset, so the clip is not all aftermath. */
const PRE_ROLL_SEC  = 0.6;
/** Audio collected after the onset before classifying — this is the alert delay. */
const POST_ROLL_SEC = 0.7;
/** Floor between classifications: inference every few hundred ms would cost battery for nothing. */
const MIN_INTERVAL_MS = 1500;
/** Consecutive failures before the session is rebuilt rather than reused. */
const FAILURES_BEFORE_RELOAD = 3;

export interface LiveClassification {
  labels:   AudioLabel[];
  verdict:  string;
  relevant: boolean;
}

interface Options {
  sampleRate: number;
  onResult:   (result: LiveClassification) => void;
  onError:    (error: unknown) => void;
}

/**
 * Keeps a rolling window of recent audio so a noise onset can be classified with
 * the audio either side of it. The detector only ever sees 100ms RMS windows and
 * throws the samples away, so without this there is nothing to hand the model.
 */
export function createLiveClassifier({ sampleRate, onResult, onError }: Options) {
  // Derived per half rather than from a summed CLIP_SEC: 0.6 + 0.7 is
  // 1.2999999999999998, which quietly costs a sample.
  const preRollSamples  = Math.max(1, Math.floor(sampleRate * PRE_ROLL_SEC));
  const postRollSamples = Math.max(1, Math.floor(sampleRate * POST_ROLL_SEC));
  const clipSamples     = preRollSamples + postRollSamples;

  const ring = new Float32Array(clipSamples);
  let writePos     = 0;
  let totalSamples = 0;
  let pendingAt: number | null = null;
  let lastRunAt    = 0;
  let busy         = false;
  let consecutiveFailures = 0;

  /** Copies the ring out oldest-first. */
  function snapshot(): Float32Array {
    const out = new Float32Array(clipSamples);
    for (let i = 0; i < clipSamples; i++) out[i] = ring[(writePos + i) % clipSamples];
    return out;
  }

  function maybeRun() {
    if (pendingAt === null || busy) return;
    if (totalSamples - pendingAt < postRollSamples) return;   // still collecting
    if (totalSamples < clipSamples) { pendingAt = null; return; }  // not enough history

    pendingAt = null;
    busy = true;

    const clip = resample(snapshot(), sampleRate, MODEL_SAMPLE_RATE);
    classifyWaveform(clip)
      .then(({ verdict, labels }) => {
        consecutiveFailures = 0;
        onResult({ verdict, labels, relevant: isRelevantNoise(labels) });
      })
      .catch((error) => {
        consecutiveFailures++;
        if (consecutiveFailures >= FAILURES_BEFORE_RELOAD) {
          consecutiveFailures = 0;
          resetSession();
        }
        onError(error);
      })
      .then(() => { busy = false; });
  }

  return {
    /** Warms the model so the first real event is not delayed by a 15MB load. */
    warmUp(): void {
      getSession().catch(onError);
    },

    pushChunk(base64: string): void {
      const samples = int16ToFloat32(base64ToUint8Array(base64));
      for (let i = 0; i < samples.length; i++) {
        ring[writePos] = samples[i];
        writePos = (writePos + 1) % clipSamples;
      }
      totalSamples += samples.length;
      maybeRun();
    },

    /** Called on a rising edge. Throttled; the classification runs once post-roll arrives. */
    noteOnset(): void {
      const now = Date.now();
      if (now - lastRunAt < MIN_INTERVAL_MS) return;
      lastRunAt = now;
      pendingAt = totalSamples;
    },

    reset(): void {
      ring.fill(0);
      writePos = 0;
      totalSamples = 0;
      pendingAt = null;
      busy = false;
      consecutiveFailures = 0;
    },
  };
}
