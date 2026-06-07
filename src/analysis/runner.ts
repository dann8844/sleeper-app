import {
  analyzeWindowsFromBuffer,
  detectNoiseEvents,
  buildReport,
  DEFAULT_THRESHOLD_DBFS,
  DEFAULT_WINDOW_MS,
  DEFAULT_SILENCE_GAP_MS,
  DEFAULT_START_OFFSET_MIN,
  DEFAULT_END_OFFSET_MIN,
} from './engine';
import { decodeAudioFile } from '../decoder';
import { AnalysisReport } from './types';

/**
 * Decodes an audio file and runs the full analysis pipeline on it.
 * isSleepRecording=true skips the first 30 min and last 20 min (overnight recording defaults).
 * isSleepRecording=false (default) analyzes the full duration (in-app recordings).
 */
export async function analyzeFile(
  filePath: string,
  options: {
    thresholdDb?: number;
    windowMs?: number;
    silenceGapMs?: number;
    startSec?: number;
    endSec?: number;
    isSleepRecording?: boolean;
  } = {}
): Promise<AnalysisReport> {
  const { pcm, totalDurationSec, cleanup } = await decodeAudioFile(filePath);

  const thresholdDb  = options.thresholdDb  ?? DEFAULT_THRESHOLD_DBFS;
  const windowMs     = options.windowMs     ?? DEFAULT_WINDOW_MS;
  const silenceGapMs = options.silenceGapMs ?? DEFAULT_SILENCE_GAP_MS;
  const startSec     = options.startSec     ?? (options.isSleepRecording ? DEFAULT_START_OFFSET_MIN * 60 : 0);
  const endSec       = options.endSec       ?? (options.isSleepRecording ? totalDurationSec - DEFAULT_END_OFFSET_MIN * 60 : totalDurationSec);

  try {
    const windows = analyzeWindowsFromBuffer(pcm, thresholdDb, windowMs, startSec, endSec);
    const events  = detectNoiseEvents(windows, windowMs, silenceGapMs);
    return buildReport(filePath, windows, events, thresholdDb, windowMs, silenceGapMs, startSec, endSec, totalDurationSec);
  } finally {
    cleanup();
  }
}
