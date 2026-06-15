import { Directory, File, Paths } from 'expo-file-system';
import { AnalysisReport } from './types';

const REPORTS_DIR = new Directory(Paths.document, 'sleeper-reports');

function reportFileName(report: AnalysisReport): string {
  const base = report.filePath.split('/').pop() ?? 'report';
  return base.replace(/\.wav$/i, '.report.json');
}

function serializeReport(report: AnalysisReport): string {
  // Omit windows — large array not needed for comparison
  const { windows: _omit, ...rest } = report;
  return JSON.stringify(rest, null, 2);
}

export async function saveReport(report: AnalysisReport): Promise<string> {
  if (!REPORTS_DIR.exists) REPORTS_DIR.create();
  const fileName = reportFileName(report);
  const file = new File(REPORTS_DIR, fileName);
  file.write(serializeReport(report));
  return file.uri;
}

export function getReportJson(report: AnalysisReport): string {
  return serializeReport(report);
}
