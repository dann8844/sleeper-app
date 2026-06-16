import { File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import { AnalysisReport } from './types';

// Persists the SAF directory URI the user chose, so we only prompt once.
const SAF_URI_FILE = new File(Paths.document, 'sleeper-report-dir.txt');

function reportFileName(report: AnalysisReport): string {
  const base = report.filePath.split('/').pop() ?? 'report';
  return base.replace(/\.wav$/i, '.report.json');
}

function serializeReport(report: AnalysisReport): string {
  const { windows: _omit, ...rest } = report;
  return JSON.stringify(rest, null, 2);
}

async function loadDirUri(): Promise<string | null> {
  try {
    if (SAF_URI_FILE.exists) {
      const uri = (await SAF_URI_FILE.text()).trim();
      return uri || null;
    }
  } catch {}
  return null;
}

function persistDirUri(uri: string): void {
  try { SAF_URI_FILE.write(uri); } catch {}
}

export async function saveReport(report: AnalysisReport): Promise<string> {
  let dirUri = await loadDirUri();

  if (!dirUri) {
    // First save: show the Android folder picker once. URI is remembered for next time.
    const result = await LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!result.granted) throw new Error('Folder not selected. Please choose a folder to save reports.');
    dirUri = result.directoryUri;
    persistDirUri(dirUri);
  }

  const fileName = reportFileName(report);
  const fileUri = await LegacyFS.StorageAccessFramework.createFileAsync(
    dirUri, fileName, 'application/json',
  );
  await LegacyFS.writeAsStringAsync(fileUri, serializeReport(report), {
    encoding: LegacyFS.EncodingType.UTF8,
  });
  return fileUri;
}

export function getReportJson(report: AnalysisReport): string {
  return serializeReport(report);
}
