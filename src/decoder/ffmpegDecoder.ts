/**
 * ffmpeg-kit-react-native was removed — it targets AGP 7.x and fails to build
 * against Expo SDK 54 (AGP 8.x). Non-WAV formats are unsupported for now.
 * WAV files from in-app recordings work fine via wavParser.ts.
 */
export async function ffmpegDecodeToPCM(_inputPath: string): Promise<never> {
  throw new Error(
    'Only WAV files are supported for analysis.\n' +
    'AMR/m4a support will be added in a future update.'
  );
}
