import * as FileSystem from 'expo-file-system/legacy';

export interface WavInfo {
  dataOffset:    number;
  dataSize:      number;
  sampleRate:    number;
  bitsPerSample: number;
}

/** Bytes needed to cover any realistic RIFF header before the data chunk. */
export const HEADER_BYTES = 512;

export function toFileUri(filePath: string): string {
  return filePath.startsWith('file://') ? filePath : `file://${filePath}`;
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function readRange(uri: string, position: number, length: number): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return b64ToBytes(b64);
}

/**
 * Walks RIFF chunks to find `fmt ` and `data`, so non-44-byte headers work.
 */
export function parseWavHeader(h: Uint8Array): WavInfo {
  if (h[0] !== 0x52 || h[1] !== 0x49 || h[2] !== 0x46 || h[3] !== 0x46) {
    throw new Error('Not a RIFF/WAV file');
  }
  const view = new DataView(h.buffer, h.byteOffset, h.byteLength);
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  let sampleRate = 8000;   // fallback for malformed headers
  let bitsPerSample = 16;

  while (offset + 8 <= h.length) {
    const id   = String.fromCharCode(h[offset], h[offset+1], h[offset+2], h[offset+3]);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      sampleRate    = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataSize   = size;
      break;
    }
    offset += 8 + size;
  }

  if (dataOffset === -1) throw new Error('WAV file has no data chunk');
  return { dataOffset, dataSize, sampleRate, bitsPerSample };
}

/** Reads the header and returns the parsed info. */
export async function readWavInfo(uri: string): Promise<WavInfo> {
  return parseWavHeader(await readRange(uri, 0, HEADER_BYTES));
}
