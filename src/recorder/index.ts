import { Audio } from 'expo-av';
import AudioRecord from 'react-native-audio-record';
import { SAMPLE_RATE, BYTES_PER_SAMPLE, DEFAULT_THRESHOLD_DBFS } from '../analysis/engine';
import { createNoiseDetector, NoiseCallback } from './noiseDetector';
import { playRandomSound } from '../sounds';

export interface RecorderOptions {
  onNoise?: NoiseCallback;
  thresholdDb?: number;
  soundEnabled?: boolean;
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
  const threshold    = options.thresholdDb ?? DEFAULT_THRESHOLD_DBFS;
  const soundEnabled = options.soundEnabled ?? true;

  if (!initialized) {
    AudioRecord.init({
      sampleRate:    SAMPLE_RATE,
      channels:      1,
      bitsPerSample: BYTES_PER_SAMPLE * 8,
      audioSource:   1,
      wavFile:       buildFilename(threshold, soundEnabled),
    });
    initialized = true;
  }

  const detector = createNoiseDetector((isNoise, db) => {
    if (isNoise && soundEnabled) playRandomSound();
    options.onNoise?.(isNoise, db);
  }, threshold);

  AudioRecord.on('data', (chunk: string) => detector.onChunk(chunk));
  AudioRecord.start();

  return () => { detector.reset(); };
}

export async function stopRecording(): Promise<string> {
  const filePath = await AudioRecord.stop();
  initialized = false;
  return filePath;
}
