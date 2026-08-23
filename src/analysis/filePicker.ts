import * as DocumentPicker from 'expo-document-picker';

const AUDIO_MIME_TYPES = [
  'audio/*',
  'application/octet-stream', // some AMR files come through as binary
];

const REPORT_MIME_TYPES = [
  'application/json',
  'application/octet-stream', // SAF providers are inconsistent about .json
  'text/plain',
];

export interface PickedFile {
  uri: string;
  name: string;
}

async function pick(types: string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: types,
    copyToCacheDirectory: true, // ensures we can read the file via its URI
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name };
}

/**
 * Opens the system file picker filtered to audio files.
 * Returns null if the user cancels.
 */
export async function pickAudioFile(): Promise<PickedFile | null> {
  return pick(AUDIO_MIME_TYPES);
}

/**
 * Opens the system file picker filtered to saved JSON reports.
 * Returns null if the user cancels.
 */
export async function pickReportFile(): Promise<PickedFile | null> {
  return pick(REPORT_MIME_TYPES);
}
