/** Start of this window in milliseconds from file start */
export interface WindowResult {
  startMs: number;
  /** RMS level in dBFS (-∞ to 0) */
  db: number;
  /** Whether this window exceeded the configured threshold */
  isNoise: boolean;
}

export interface NoiseEvent {
  startSec: number;
  endSec: number;
  durationSec: number;
  peakDb: number;
  avgDb: number;
}

export interface AnalysisReport {
  filePath: string;
  displayName?: string;
  durationSec: number;
  sampleRate: number;
  windowMs: number;
  thresholdDb: number;
  silenceGapMs: number;
  analyzeStartSec: number;
  analyzeEndSec: number;
  totalDurationSec: number;

  overallPeakDb: number;
  overallAvgDb: number;

  noiseEventCount: number;
  totalNoiseTimeSec: number;
  percentageNoise: number;

  noiseEvents: NoiseEvent[];
  windows: WindowResult[];
  sequences: NoiseSequenceRow[];
  noiseByHour: NoiseByHourRow[];
}

export interface NoiseByHourRow {
  hour: number;
  noiseCount: number;
}

export interface NoiseSequenceRow {
  noiseCount: number;
  sequenceCount: number;
  startTimes: number[];
}
