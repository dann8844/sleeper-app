import { analyzeWavStreaming } from '../decoder/streamingAnalyzer';
import { AnalysisReport } from './types';

export async function analyzeFile(
  filePath: string,
  options: {
    thresholdDb?:      number;
    windowMs?:         number;
    silenceGapMs?:     number;
    startSec?:         number;
    endSec?:           number;
    isSleepRecording?: boolean;
  } = {}
): Promise<AnalysisReport> {
  if (!filePath.toLowerCase().endsWith('.wav')) {
    throw new Error(
      'Only WAV files are supported.\n' +
      'AMR/m4a support will be added in a future update.'
    );
  }
  return analyzeWavStreaming(filePath, options);
}
