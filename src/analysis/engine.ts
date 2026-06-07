import {
  AnalysisReport,
  NoiseByHourRow,
  NoiseEvent,
  NoiseSequenceRow,
  WindowResult,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SAMPLE_RATE             = 8000;
export const CHANNELS                = 1;
export const BYTES_PER_SAMPLE        = 2;
export const DEFAULT_THRESHOLD_DBFS  = -54;
export const DEFAULT_WINDOW_MS       = 100;
export const DEFAULT_SILENCE_GAP_MS  = 500;
export const DEFAULT_START_OFFSET_MIN = 30;
export const DEFAULT_END_OFFSET_MIN   = 20;
export const SEQUENCE_GAP_SEC        = 10;

const MAX_AMPLITUDE = 32768; // 2^15 for 16-bit signed PCM

// ─── Signal Analysis ──────────────────────────────────────────────────────────

function rmsToDbfs(rms: number): number {
  return rms === 0 ? -Infinity : 20 * Math.log10(rms / MAX_AMPLITUDE);
}

/**
 * Sweep through a raw s16le PCM buffer (as Int16Array) in fixed windows.
 * startSec/endSec select the slice to analyze — the rest is skipped.
 */
export function analyzeWindowsFromBuffer(
  pcm: Int16Array,
  thresholdDb: number,
  windowMs: number,
  startSec: number,
  endSec: number
): WindowResult[] {
  const windowSamples  = Math.floor((SAMPLE_RATE * windowMs) / 1000);
  const results: WindowResult[] = [];

  const startWindowIdx = Math.floor((startSec * SAMPLE_RATE) / windowSamples);
  const endWindowIdx   = Math.ceil((endSec   * SAMPLE_RATE) / windowSamples);

  for (let wi = startWindowIdx; wi < endWindowIdx; wi++) {
    const offset = wi * windowSamples;
    if (offset + windowSamples > pcm.length) break;

    let sumSq = 0;
    for (let s = 0; s < windowSamples; s++) {
      const sample = pcm[offset + s];
      sumSq += sample * sample;
    }

    const rms = Math.sqrt(sumSq / windowSamples);
    const db  = rmsToDbfs(rms);
    results.push({ startMs: wi * windowMs, db, isNoise: db > thresholdDb });
  }

  return results;
}

// ─── Noise Event Detection ────────────────────────────────────────────────────

export function detectNoiseEvents(
  windows: WindowResult[],
  windowMs: number,
  silenceGapMs: number
): NoiseEvent[] {
  const silenceGapWindows = Math.ceil(silenceGapMs / windowMs);
  const events: NoiseEvent[] = [];

  let inEvent      = false;
  let startSec     = 0;
  let peakDb       = -Infinity;
  let sumDb        = 0;
  let count        = 0;
  let silenceCount = 0;
  let silenceStart = 0;

  const closeEvent = (endSec: number) => {
    events.push({ startSec, endSec, durationSec: endSec - startSec, peakDb, avgDb: sumDb / count });
    inEvent      = false;
    peakDb       = -Infinity;
    sumDb        = 0;
    count        = 0;
    silenceCount = 0;
  };

  for (const win of windows) {
    if (win.isNoise) {
      if (!inEvent) { inEvent = true; startSec = win.startMs / 1000; }
      silenceCount = 0;
      if (win.db > peakDb) peakDb = win.db;
      sumDb += win.db;
      count++;
    } else if (inEvent) {
      if (silenceCount === 0) silenceStart = win.startMs / 1000;
      silenceCount++;
      if (silenceCount >= silenceGapWindows) closeEvent(silenceStart);
    }
  }

  if (inEvent && windows.length > 0) {
    const endSec = silenceCount > 0
      ? silenceStart
      : (windows[windows.length - 1].startMs + windowMs) / 1000;
    closeEvent(endSec);
  }

  return events;
}

// ─── Sequence Detection ───────────────────────────────────────────────────────

export function detectSequences(events: NoiseEvent[]): NoiseSequenceRow[] {
  if (events.length === 0) return [];

  const runs: { length: number; startSec: number }[] = [];
  let runLength   = 1;
  let runStartSec = events[0].startSec;

  for (let i = 1; i < events.length; i++) {
    const gap = events[i].startSec - events[i - 1].endSec;
    if (gap < SEQUENCE_GAP_SEC) {
      runLength++;
    } else {
      runs.push({ length: runLength, startSec: runStartSec });
      runLength   = 1;
      runStartSec = events[i].startSec;
    }
  }
  runs.push({ length: runLength, startSec: runStartSec });

  const freq = new Map<number, { sequenceCount: number; startTimes: number[] }>();
  for (const { length, startSec } of runs) {
    const entry = freq.get(length);
    if (entry) { entry.sequenceCount++; entry.startTimes.push(startSec); }
    else        { freq.set(length, { sequenceCount: 1, startTimes: [startSec] }); }
  }

  return Array.from(freq.entries())
    .map(([noiseCount, { sequenceCount, startTimes }]) => ({ noiseCount, sequenceCount, startTimes }))
    .sort((a, b) => b.noiseCount - a.noiseCount || b.sequenceCount - a.sequenceCount);
}

// ─── Hourly Breakdown ─────────────────────────────────────────────────────────

export function computeNoiseByHour(
  events: NoiseEvent[],
  analyzeStartSec: number,
  analyzeEndSec: number
): NoiseByHourRow[] {
  const startHour = Math.floor(analyzeStartSec / 3600);
  const endHour   = Math.floor((analyzeEndSec - 1) / 3600);

  const counts = new Map<number, number>();
  for (const event of events) {
    const hour = Math.floor(event.startSec / 3600);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  const rows: NoiseByHourRow[] = [];
  for (let h = startHour; h <= endHour; h++) {
    rows.push({ hour: h, noiseCount: counts.get(h) ?? 0 });
  }
  return rows;
}

// ─── Report Building ──────────────────────────────────────────────────────────

export function buildReport(
  filePath: string,
  windows: WindowResult[],
  events: NoiseEvent[],
  thresholdDb: number,
  windowMs: number,
  silenceGapMs: number,
  analyzeStartSec: number,
  analyzeEndSec: number,
  totalDurationSec: number
): AnalysisReport {
  const noiseWindows      = windows.filter(w => w.isNoise);
  const totalNoiseTimeSec = (noiseWindows.length * windowMs) / 1000;
  const percentageNoise   = windows.length > 0 ? (noiseWindows.length / windows.length) * 100 : 0;
  const finiteDb          = windows.map(w => w.db).filter(isFinite);
  const overallPeakDb     = finiteDb.reduce((max, v) => v > max ? v : max, -Infinity);
  const overallAvgDb      = finiteDb.length > 0
    ? finiteDb.reduce((sum, v) => sum + v, 0) / finiteDb.length
    : -Infinity;

  return {
    filePath,
    durationSec: analyzeEndSec - analyzeStartSec,
    sampleRate: SAMPLE_RATE,
    windowMs,
    thresholdDb,
    silenceGapMs,
    analyzeStartSec,
    analyzeEndSec,
    totalDurationSec,
    overallPeakDb,
    overallAvgDb,
    noiseEventCount: events.length,
    totalNoiseTimeSec,
    percentageNoise,
    noiseEvents: events,
    windows,
    sequences: detectSequences(events),
    noiseByHour: computeNoiseByHour(events, analyzeStartSec, analyzeEndSec),
  };
}
