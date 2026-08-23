/** Target rate for YAMNet. In-app recordings already use this (engine.SAMPLE_RATE). */
export const MODEL_SAMPLE_RATE = 16000;

/** Little-endian signed 16-bit PCM bytes → float32 samples in [-1, 1). */
export function int16ToFloat32(bytes: Uint8Array): Float32Array {
  const count = Math.floor(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** Unsigned 8-bit PCM bytes (silence = 128) → float32 samples in [-1, 1). */
export function uint8ToFloat32(bytes: Uint8Array): Float32Array {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] - 128) / 128;
  return out;
}

/**
 * Linear resample. Good enough for the 1-4s clips we classify — the model's own
 * mel front-end is far less sensitive than the interpolation error.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx];
    const b = idx + 1 < input.length ? input[idx + 1] : a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}
