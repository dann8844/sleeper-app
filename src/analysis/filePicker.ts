import * as DocumentPicker from 'expo-document-picker';

const AUDIO_MIME_TYPES = [
  'audio/*',
  'application/octet-stream', // some AMR files come through as binary
];

export interface PickedFile {
  uri: string;
  name: string;
}

/**
 * Opens the system file picker filtered to audio files.
 * Returns null if the user cancels.
 */
export async function pickAudioFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: AUDIO_MIME_TYPES,
    copyToCacheDirectory: true, // ensures we can read the file via its URI
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name };
}
