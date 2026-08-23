import { AudioLabel } from '../analysis/types';

/**
 * Classes that make a noise event "relevant" — the sounds this app exists to
 * find. Names are the exact AudioSet display names from
 * assets/models/yamnet_class_map.csv (Snoring 38, Breathing 36, Purr 77,
 * Growling 74); the model emits these strings verbatim, so any variation here
 * would silently never match.
 */
export const RELEVANT_CLASSES: ReadonlySet<string> = new Set([
  'Snoring',
  'Breathing',
  'Purr',
  'Growling',
]);

/**
 * True when any stored label is a relevant class, regardless of score.
 *
 * Deliberately unlike `verdictFor`, which applies a score floor and a rank
 * limit: presence anywhere in the event's top labels is enough here, so a faint
 * snore that is too weak to decide the verdict still counts as relevant.
 */
export function isRelevantNoise(labels?: AudioLabel[]): boolean {
  return !!labels?.some(label => RELEVANT_CLASSES.has(label.name));
}

export function countRelevantNoises(events: { labels?: AudioLabel[] }[]): number {
  return events.reduce((n, event) => n + (isRelevantNoise(event.labels) ? 1 : 0), 0);
}
