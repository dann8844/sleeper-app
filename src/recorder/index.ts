import { Audio } from 'expo-av';
import AudioRecord from 'react-native-audio-record';
import { SAMPLE_RATE, BYTES_PER_SAMPLE, DEFAULT_THRESHOLD_DBFS } from '../analysis/engine';
import { createNoiseDetector, NoiseCallback } from './noiseDetector';
import { playRandomSound, isAlertActive } from '../sounds';
import { LiveClassification, createLiveClassifier } from './liveClassifier';

export type { LiveClassification };

// Android MediaRecorder.AudioSource constants.
/** Near-unprocessed: no noise suppression, no AGC. Truest dBFS levels. */
const SOURCE_VOICE_RECOGNITION = 6;
/**
 * Runs the device voice chain: noise suppressor + echo canceller (which keeps
 * our own alert sound out of the recording). Caveat: on some devices this also
 * enables AGC, which floats the gain and distorts dBFS levels.
 */
const SOURCE_VOICE_COMMUNICATION = 7;

export interface RecorderOptions {
  onNoise?:      NoiseCallback;
  thresholdDb?:  number;
  soundEnabled?: boolean;
  bonnet?:       boolean;
  headphones?:   boolean;
  /** Record via VOICE_COMMUNICATION instead of VOICE_RECOGNITION. */
  noiseSuppression?: boolean;
  onClassified?:     (result: LiveClassification) => void;
  /** Fired on every failed classification, with the running total for this session. */
  onClassifyFailure?: (total: number) => void;
}

let initialized = false;

function buildFilename(thresholdDb: number, soundEnabled: boolean, bonnet: boolean, headphones: boolean, audioSource: number): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const thr  = `${thresholdDb > 0 ? '+' : ''}${thresholdDb}dB`;
  const snd  = soundEnabled ? 'sound-on' : 'sound-off';
  const accessories = [bonnet && 'bonnet', headphones && 'headphones'].filter(Boolean).join('_');
  const suffix = accessories ? `_${accessories}` : '';
  return `sleeper_${date}_${time}_${thr}_${snd}${suffix}_src${audioSource}.wav`;
}

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export function startRecording(options: RecorderOptions = {}): () => void {
  const threshold    = options.thresholdDb  ?? DEFAULT_THRESHOLD_DBFS;
  const soundEnabled = options.soundEnabled ?? true;
  const bonnet       = options.bonnet       ?? false;
  const headphones   = options.headphones   ?? false;
  const audioSource  = (options.noiseSuppression ?? true)
    ? SOURCE_VOICE_COMMUNICATION
    : SOURCE_VOICE_RECOGNITION;

  if (!initialized) {
    AudioRecord.init({
      sampleRate:    SAMPLE_RATE,
      channels:      1,
      bitsPerSample: BYTES_PER_SAMPLE * 8,
      audioSource:   audioSource,
      wavFile:       buildFilename(threshold, soundEnabled, bonnet, headphones, audioSource),
    });
    initialized = true;
  }

  let wasNoise = false;
  let classifyFailures = 0;

  const live = createLiveClassifier({
    sampleRate: SAMPLE_RATE,
    onResult: (result) => {
      options.onClassified?.(result);
      if (result.relevant && soundEnabled) playRandomSound();
    },
    onError: () => {
      // Keep attempting on later onsets rather than disabling for the session:
      // the failure worth catching (CPU throttling under Doze) is transient, and
      // giving up after one would make the counter meaningless.
      classifyFailures++;
      options.onClassifyFailure?.(classifyFailures);
      if (soundEnabled) playRandomSound();   // never go silent on a failure
    },
  });
  live.warmUp();

  const detector = createNoiseDetector((isNoise, db) => {
    // Our own alert is playing. Hold the previous state so the alert can
    // neither retrigger itself nor register as a second noise event.
    if (isAlertActive()) {
      options.onNoise?.(wasNoise, db);
      return;
    }
    if (isNoise && !wasNoise) {
      // The alert now waits on the verdict, so it only fires for a relevant
      // noise — roughly POST_ROLL_SEC plus inference after the onset.
      live.noteOnset();
    }
    wasNoise = isNoise;
    options.onNoise?.(isNoise, db);
  }, threshold);

  AudioRecord.on('data', (chunk: string) => {
    detector.onChunk(chunk);
    live.pushChunk(chunk);
  });
  AudioRecord.start();

  return () => { detector.reset(); live.reset(); };
}

export async function stopRecording(): Promise<string> {
  try {
    return await AudioRecord.stop();
  } finally {
    // Must clear even if stop() rejects: a stuck flag would skip init() on the
    // next start, silently reusing the previous filename and audio source.
    initialized = false;
  }
}
