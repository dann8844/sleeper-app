import { File } from 'expo-file-system';

/**
 * Reads a WAV file and returns its PCM samples.
 * Returns Uint8Array for 8-bit unsigned PCM, Int16Array for 16-bit signed PCM.
 * Walks RIFF chunks to find "data" so it handles non-44-byte headers.
 */
export async function readWavToPCM(filePath: string): Promise<Uint8Array | Int16Array> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  const bytes = await new File(uri).bytes();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
    throw new Error('Not a RIFF/WAV file');
  }

  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  let bitsPerSample = 16;

  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size;
  }

  if (dataOffset === -1) throw new Error('WAV file has no data chunk');

  if (bitsPerSample === 8) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset + dataOffset, dataSize);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset + dataOffset, dataSize / 2);
}

export function isWav(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.wav');
}
