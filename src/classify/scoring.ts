import { AudioLabel } from '../analysis/types';
import { YAMNET_LABELS } from './labels';

/** How many labels to keep for display. */
export const TOP_LABELS = 3;

/**
 * The model emits one score row per ~0.48s frame. Average down the frame axis.
 * Kept for reference — `maxOverFrames` is what the classifier uses; see below.
 */
export function meanOverFrames(data: Float32Array | number[], frames: number, classes: number): Float32Array {
  const mean = new Float32Array(classes);
  if (frames <= 0) return mean;
  for (let f = 0; f < frames; f++) {
    const base = f * classes;
    for (let c = 0; c < classes; c++) mean[c] += data[base + c];
  }
  for (let c = 0; c < classes; c++) mean[c] /= frames;
  return mean;
}

/**
 * Peak score per class across frames. Preferred over the mean for event tagging:
 * a short event inside a padded clip occupies only one or two frames, and
 * averaging dilutes its evidence with the quiet frames either side.
 */
export function maxOverFrames(data: Float32Array | number[], frames: number, classes: number): Float32Array {
  const max = new Float32Array(classes);
  if (frames <= 0) return max;
  for (let c = 0; c < classes; c++) max[c] = data[c];
  for (let f = 1; f < frames; f++) {
    const base = f * classes;
    for (let c = 0; c < classes; c++) {
      const v = data[base + c];
      if (v > max[c]) max[c] = v;
    }
  }
  return max;
}

/** All classes ranked by score, highest first. */
export function rankLabels(mean: Float32Array): AudioLabel[] {
  const ranked: AudioLabel[] = [];
  for (let i = 0; i < mean.length && i < YAMNET_LABELS.length; i++) {
    ranked.push({ name: YAMNET_LABELS[i], score: mean[i] });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** Rounds scores for storage — three decimals is plenty and keeps reports small. */
export function topLabels(ranked: AudioLabel[], n: number = TOP_LABELS): AudioLabel[] {
  return ranked.slice(0, n).map(l => ({ name: l.name, score: Math.round(l.score * 1000) / 1000 }));
}
