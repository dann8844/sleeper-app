import { File, Paths } from 'expo-file-system';
import { DEFAULT_THRESHOLD_DBFS } from '../analysis/engine';

interface Settings {
  thresholdAbs:     number;
  bonnet:           boolean;
  headphones:       boolean;
  noiseSuppression: boolean;
}

const FILE = new File(Paths.document, 'sleeper-settings.json');
const DEFAULTS: Settings = {
  thresholdAbs:     Math.abs(DEFAULT_THRESHOLD_DBFS),
  bonnet:           false,
  headphones:       false,
  noiseSuppression: true,
};

export async function loadSettings(): Promise<Settings> {
  try {
    if (FILE.exists) {
      const parsed = JSON.parse(await FILE.text());
      return {
        thresholdAbs:     typeof parsed.thresholdAbs     === 'number'  ? parsed.thresholdAbs     : DEFAULTS.thresholdAbs,
        bonnet:           typeof parsed.bonnet           === 'boolean' ? parsed.bonnet           : DEFAULTS.bonnet,
        headphones:       typeof parsed.headphones       === 'boolean' ? parsed.headphones       : DEFAULTS.headphones,
        noiseSuppression: typeof parsed.noiseSuppression === 'boolean' ? parsed.noiseSuppression : DEFAULTS.noiseSuppression,
      };
    }
  } catch {}
  return DEFAULTS;
}

export function saveSettings(settings: Settings): void {
  try {
    FILE.write(JSON.stringify(settings));
  } catch {}
}
