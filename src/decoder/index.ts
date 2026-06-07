import { isWav, readWavToPCM } from './wavParser';
import { SAMPLE_RATE } from '../analysis/engine';

export interface DecodeResult {
  pcm: Int16Array;
  totalDurationSec: number;
  cleanup: () => void;
}

/**
 * Decodes a WAV audio file to a raw Int16Array of s16le PCM samples.
 * Non-WAV formats (AMR, m4a) are not yet supported — ffmpeg-kit-react-native
 * was removed due to AGP 8.x incompatibility.
 */
export async function decodeAudioFile(filePath: string): Promise<DecodeResult> {
  if (!isWav(filePath)) {
    throw new Error(
      'Only WAV files are supported for analysis.\n' +
      'AMR/m4a support will be added in a future update.'
    );
  }

  const pcm = await readWavToPCM(filePath);
  return {
    pcm,
    totalDurationSec: pcm.length / SAMPLE_RATE,
    cleanup: () => {},
  };
}
