import { Asset } from 'expo-asset';
import type { InferenceSession } from 'onnxruntime-react-native';
import { AudioLabel } from '../analysis/types';
import { maxOverFrames, rankLabels, topLabels } from './scoring';
import { Verdict, verdictFor } from './verdict';

const INPUT_NAME  = 'waveform';
/** output_0 = scores [frames, 521]; output_1 = embeddings; output_2 = log-mel. */
const SCORES_NAME = 'output_0';

export interface Classification {
  verdict: Verdict;
  labels:  AudioLabel[];
}

type Ort = typeof import('onnxruntime-react-native');
let ort: Ort | null = null;

/**
 * Loaded on first use, never at import time. The package calls
 * `NativeModules.Onnxruntime.install()` as a side effect of being imported, so a
 * missing or unregistered native module throws immediately — at module scope that
 * would take down app startup rather than merely disabling classification.
 */
function requireOrt(): Ort {
  if (!ort) ort = require('onnxruntime-react-native') as Ort;
  return ort;
}

let sessionPromise: Promise<InferenceSession> | null = null;

async function loadSession(): Promise<InferenceSession> {
  const { InferenceSession } = requireOrt();
  const asset = Asset.fromModule(require('../../assets/models/yamnet.onnx'));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  try {
    return await InferenceSession.create(uri);
  } catch {
    // Some platforms want a bare filesystem path rather than a file:// URI.
    return await InferenceSession.create(uri.replace(/^file:\/\//, ''));
  }
}

/** Loaded once and reused — session creation costs far more than an inference. */
export function getSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = loadSession().catch(err => {
      sessionPromise = null;   // let a later attempt retry
      throw err;
    });
  }
  return sessionPromise;
}

/**
 * Drops the cached session so the next call rebuilds it. `getSession` already
 * retries a failed *load*, but a session that loaded and later stopped working
 * would otherwise be reused forever.
 */
export function resetSession(): void {
  sessionPromise = null;
}

export async function classifyWaveform(pcm: Float32Array): Promise<Classification> {
  const { Tensor } = requireOrt();
  const session = await getSession();
  const output  = await session.run({ [INPUT_NAME]: new Tensor(pcm, [pcm.length]) });

  const scores = output[SCORES_NAME];
  if (!scores) throw new Error(`Model returned no ${SCORES_NAME} tensor`);

  const [frames, classes] = scores.dims as number[];
  const peak   = maxOverFrames(scores.data as Float32Array, frames, classes);
  const ranked = rankLabels(peak);

  return { verdict: verdictFor(ranked), labels: topLabels(ranked) };
}
