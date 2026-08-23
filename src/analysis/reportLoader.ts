import { File } from 'expo-file-system';
import { AnalysisReport } from './types';

const NUMBER_FIELDS = [
  'durationSec',
  'sampleRate',
  'windowMs',
  'thresholdDb',
  'silenceGapMs',
  'analyzeStartSec',
  'analyzeEndSec',
  'totalDurationSec',
  'noiseEventCount',
  'totalNoiseTimeSec',
  'percentageNoise',
] as const;

const ARRAY_FIELDS = ['noiseEvents', 'sequences', 'noiseByHour'] as const;

// JSON has no Infinity — these serialize to null for a digitally silent recording.
const DB_FIELDS = ['overallPeakDb', 'overallAvgDb'] as const;

const NOT_A_REPORT = 'Not a Sleeper report file.';

/**
 * Parses a saved report. `windows` is stripped on save and stays absent —
 * the report screen never reads it.
 */
export function parseReport(text: string): AnalysisReport {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_REPORT);
  }

  if (!raw || typeof raw !== 'object' || typeof raw.filePath !== 'string') {
    throw new Error(NOT_A_REPORT);
  }
  for (const field of NUMBER_FIELDS) {
    if (typeof raw[field] !== 'number') throw new Error(NOT_A_REPORT);
  }
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(raw[field])) throw new Error(NOT_A_REPORT);
  }

  // Restore -Infinity so fmtDb renders -∞ instead of crashing on null.toFixed().
  for (const field of DB_FIELDS) {
    if (typeof raw[field] !== 'number') raw[field] = -Infinity;
  }

  return raw as AnalysisReport;
}

export async function loadReportFile(filePath: string): Promise<AnalysisReport> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  return parseReport(await new File(uri).text());
}
