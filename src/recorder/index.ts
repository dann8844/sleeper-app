import { Audio } from 'expo-av';
import AudioRecord from 'react-native-audio-record';
import { SAMPLE_RATE, BYTES_PER_SAMPLE, DEFAULT_THRESHOLD_DBFS, DEFAULT_WINDOW_MS } from '../analysis/engine';
import { createNoiseDetector, NoiseCallback } from './noiseDetector';
import { playRandomSound } from '../sounds';

// Calibration: measure ambient noise for this many windows (10 s at 100 ms/window)
const CALIBRATION_WINDOWS = 100;
// Threshold is set this many dB above the measured noise floor
const CALIBRATION_MARGIN_DB = 12;

export interface RecorderOptions {
  onNoise?:       NoiseCallback;
  onCalibrated?:  (thresholdDb: number) => void;
  thresholdDb?:   number;
  soundEnabled?:  boolean;
}

let initialized = false;

function buildFilename(thresholdDb: number, soundEnabled: boolean): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const thr  = `${thresholdDb > 0 ? '+' : ''}${thresholdDb}dB`;
  const snd  = soundEnabled ? 'sound-on' : 'sound-off';
  return `sleeper_${date}_${time}_${thr}_${snd}.wav`;
}

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export function startRecording(options: RecorderOptions = {}): () => void {
  const configuredThreshold = options.thresholdDb ?? DEFAULT_THRESHOLD_DBFS;
  const soundEnabled        = options.soundEnabled ?? true;

  if (!initialized) {
    AudioRecord.init({
      sampleRate:    SAMPLE_RATE,
      channels:      1,
      bitsPerSample: BYTES_PER_SAMPLE * 8,
      audioSource:   1,
      wavFile:       buildFilename(configuredThreshold, soundEnabled),
    });
    initialized = true;
  }

  let wasNoise         = false;
  let calibrationCount = 0;
  let calibrationDbs: number[] = [];

  const detector = createNoiseDetector((isNoise, db) => {
    // ── Calibration phase (first CALIBRATION_WINDOWS windows = 10 s) ──────────
    if (calibrationCount < CALIBRATION_WINDOWS) {
      calibrationCount++;
      if (isFinite(db)) calibrationDbs.push(db);

      if (calibrationCount === CALIBRATION_WINDOWS) {
        if (calibrationDbs.length > 0) {
          const sorted = [...calibrationDbs].sort((a, b) => a - b);
          const floor  = sorted[Math.floor(sorted.length * 0.85)]; // 85th percentile
          const auto   = floor + CALIBRATION_MARGIN_DB;
          // Never make the threshold more lenient than what the user set
          const final  = Math.max(configuredThreshold, auto);
          detector.setThreshold(final);
          options.onCalibrated?.(final);
        } else {
          options.onCalibrated?.(configuredThreshold);
        }
      }

      // Still fire onNoise during calibration so the dB meter is live,
      // but always as non-noise (we don't know the threshold yet)
      options.onNoise?.(false, db);
      return;
    }

    // ── Normal operation ───────────────────────────────────────────────────────
    if (isNoise && !wasNoise && soundEnabled) playRandomSound();
    wasNoise = isNoise;
    options.onNoise?.(isNoise, db);
  }, configuredThreshold);

  AudioRecord.on('data', (chunk: string) => detector.onChunk(chunk));
  AudioRecord.start();

  return () => { detector.reset(); };
}

export async function stopRecording(): Promise<string> {
  const filePath = await AudioRecord.stop();
  initialized = false;
  return filePath;
}
