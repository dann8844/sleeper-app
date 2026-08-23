import { AudioLabel } from '../analysis/types';

export type Verdict =
  | 'snore' | 'snort' | 'breathing' | 'cough'
  | 'speech' | 'movement' | 'external' | 'ambience' | 'other';

/**
 * A label must reach this score before it can decide the verdict.
 *
 * Deliberately low. YAMNet is confident about a clear snore (0.3-0.9), but a
 * faint one recorded across a room scores far lower, and discarding those left
 * real events reported as 'ambience'. Low confidence is surfaced rather than
 * hidden: the verdict names the event, and the labels beside it show the score
 * so a weak call is visible as weak. Raise this if verdicts feel trigger-happy.
 */
export const MIN_VERDICT_SCORE = 0.05;

/**
 * Only the strongest few classes may decide the verdict. With 521 classes there
 * is always something scoring 0.05 somewhere down the ranking; this keeps the
 * decision among the labels actually shown in the report.
 */
export const VERDICT_RANK_LIMIT = 5;

/**
 * AudioSet display name → verdict bucket. Every name here was verified against
 * assets/models/yamnet_class_map.csv; anything unlisted falls through to 'other'.
 * (Note there is no "Cloth" class in the released 521-class set.)
 */
const BUCKETS: Readonly<Record<string, Verdict>> = {
  Snoring: 'snore',

  Snort: 'snort',
  Grunt: 'snort',
  Groan: 'snort',

  Breathing: 'breathing',
  Wheeze: 'breathing',
  Gasp: 'breathing',
  Sigh: 'breathing',
  Sniff: 'breathing',

  Cough: 'cough',
  Sneeze: 'cough',
  'Throat clearing': 'cough',

  Speech: 'speech',
  Conversation: 'speech',
  Whispering: 'speech',
  Babbling: 'speech',
  Chatter: 'speech',
  Shout: 'speech',
  Yell: 'speech',
  'Speech synthesizer': 'speech',

  Rustle: 'movement',
  'Rustling leaves': 'movement',
  Squeak: 'movement',
  Tap: 'movement',
  Slam: 'movement',
  Bang: 'movement',

  Vehicle: 'external',
  Car: 'external',
  Truck: 'external',
  Motorcycle: 'external',
  Aircraft: 'external',
  Siren: 'external',
  Dog: 'external',
  Bird: 'external',
  Wind: 'external',
  Rain: 'external',
  'Mechanical fan': 'external',
  'Air conditioning': 'external',

  Silence: 'ambience',
  Noise: 'ambience',
  'Environmental noise': 'ambience',
  Static: 'ambience',
  'White noise': 'ambience',
  Hum: 'ambience',
  'Mains hum': 'ambience',
};

/**
 * The bucket of the highest-scoring *mapped* label, with one deliberate
 * exception: 'ambience' is a fallback, never a winner.
 *
 * Short events are padded out to a minimum clip length with the audio either
 * side of them, so "Silence" frequently outranks the event itself — a real snore
 * at 0.35 sitting under Silence at 0.85 is still a snore, and reporting
 * "ambience" there hides the very thing the report exists to surface. So a
 * non-ambience match wins outright, and ambience is used only when nothing else
 * registers. Unmapped classes (e.g. "Music") are skipped rather than forcing
 * 'other'; the raw labels are shown alongside the verdict either way.
 *
 * Ranked labels must be sorted by score descending.
 */
export function verdictFor(ranked: AudioLabel[]): Verdict {
  let ambience: Verdict | null = null;

  for (const label of ranked.slice(0, VERDICT_RANK_LIMIT)) {
    if (label.score < MIN_VERDICT_SCORE) break;
    const bucket = BUCKETS[label.name];
    if (!bucket) continue;
    if (bucket === 'ambience') {
      if (!ambience) ambience = bucket;
      continue;
    }
    return bucket;
  }

  return ambience ?? 'other';
}
