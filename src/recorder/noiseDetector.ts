import { SAMPLE_RATE, DEFAULT_WINDOW_MS, BYTES_PER_SAMPLE } from '../analysis/engine';

const WINDOW_SAMPLES = Math.floor((SAMPLE_RATE * DEFAULT_WINDOW_MS) / 1000);

export type NoiseCallback = (isNoise: boolean, db: number) => void;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createNoiseDetector(onNoise: NoiseCallback, thresholdDb: number) {
  let buf = new Uint8Array(0);

  function onChunk(base64: string) {
    const incoming = base64ToUint8Array(base64);
    const merged = new Uint8Array(buf.length + incoming.length);
    merged.set(buf);
    merged.set(incoming, buf.length);
    buf = merged;

    const windowBytes = WINDOW_SAMPLES * BYTES_PER_SAMPLE;

    while (buf.length >= windowBytes) {
      const win = buf.slice(0, windowBytes);
      buf = buf.slice(windowBytes);

      const view = new DataView(win.buffer, win.byteOffset, win.byteLength);
      let sumSq = 0;
      for (let s = 0; s < WINDOW_SAMPLES; s++) {
        const sample = view.getInt16(s * 2, true);
        sumSq += sample * sample;
      }

      const rms = Math.sqrt(sumSq / WINDOW_SAMPLES);
      const db = rms === 0 ? -Infinity : 20 * Math.log10(rms / 32768);
      onNoise(db > thresholdDb, db);
    }
  }

  function reset() {
    buf = new Uint8Array(0);
  }

  return { onChunk, reset };
}
