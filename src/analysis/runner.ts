import { analyzeWavStreaming } from '../decoder/streamingAnalyzer';
import { ClassifyProgress, classifyEvents } from '../classify';
import { AnalysisReport } from './types';

export async function analyzeFile(
  filePath: string,
  options: {
    thresholdDb?:      number;
    windowMs?:         number;
    silenceGapMs?:     number;
    startSec?:         number;
    endSec?:           number;
    startOffsetMin?:   number;
    endOffsetMin?:     number;
    isSleepRecording?: boolean;
    displayName?:      string;
    /** Set false to skip on-device classification. */
    classify?:         boolean;
    onClassifyProgress?: ClassifyProgress;
  } = {}
): Promise<AnalysisReport> {
  if (!filePath.toLowerCase().endsWith('.wav')) {
    throw new Error(
      'Only WAV files are supported.\n' +
      'AMR/m4a support will be added in a future update.'
    );
  }
  const report = await analyzeWavStreaming(filePath, options);

  if (options.classify !== false) {
    try {
      await classifyEvents(filePath, report, options.onClassifyProgress);
    } catch {
      // Best effort — a report without labels beats no report at all.
    }
  }

  return report;
}
