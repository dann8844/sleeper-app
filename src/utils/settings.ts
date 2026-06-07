import { File, Paths } from 'expo-file-system';
import { DEFAULT_THRESHOLD_DBFS } from '../analysis/engine';

interface Settings {
  thresholdAbs: number;
}

const FILE = new File(Paths.document, 'sleeper-settings.json');
const DEFAULTS: Settings = { thresholdAbs: Math.abs(DEFAULT_THRESHOLD_DBFS) };

export async function loadSettings(): Promise<Settings> {
  try {
    if (FILE.exists) {
      const parsed = JSON.parse(await FILE.text());
      if (typeof parsed.thresholdAbs === 'number') return parsed;
    }
  } catch {}
  return DEFAULTS;
}

export function saveSettings(settings: Settings): void {
  try {
    FILE.write(JSON.stringify(settings));
  } catch {}
}
