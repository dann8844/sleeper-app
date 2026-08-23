import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { AnalysisReport, NoiseEvent, NoiseByHourRow, NoiseSequenceRow } from '../analysis/types';
import { fmtDb, fmtSec, fmtPct, fmtTime, fmtTimeSec, fmtHM, fmtSecValue, fmtDbValue } from '../utils/format';
import { saveReport, getReportJson, recordingName } from '../analysis/reportSaver';
import { countRelevantNoises, isRelevantNoise } from '../classify/relevance';
import { computeNoiseByHour, detectSequences } from '../analysis/engine';

interface Props {
  report: AnalysisReport;
  onBack: () => void;
  /** 'file' reports were loaded from JSON — their WAV is not on disk. */
  source?: 'analysis' | 'file';
}

/** Verdicts worth drawing the eye to — the ones this app exists to find. */
function isSnoreLike(verdict?: string): boolean {
  return verdict === 'snore' || verdict === 'snort';
}

function parseRecordingMeta(fileName: string) {
  if (!fileName.startsWith('sleeper_')) return null;
  return {
    sound:      fileName.includes('sound-on'),
    bonnet:     fileName.includes('bonnet'),
    headphones: fileName.includes('headphones'),
    // Recordings made before this option existed carry no _src tag and were
    // all captured on VOICE_RECOGNITION, so absent correctly means "off".
    noiseSupp:  fileName.includes('_src7'),
  };
}

export default function ReportScreen({ report, onBack, source = 'analysis' }: Props) {
  const [relevantOnly, setRelevantOnly] = useState(true);
  const [savingWav,    setSavingWav]    = useState(false);
  const [savedWav,     setSavedWav]     = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport,  setSavedReport]  = useState(false);
  const fileName = recordingName(report);
  const meta = parseRecordingMeta(fileName);
  const relevantCount = countRelevantNoises(report.noiseEvents);

  // Every table is derived from the same event list so the switch cannot leave
  // them disagreeing. detectSequences/computeNoiseByHour are the same pure
  // functions the analysis used, re-run on the filtered set.
  const events = useMemo(
    () => (relevantOnly ? report.noiseEvents.filter(e => isRelevantNoise(e.labels)) : report.noiseEvents),
    [report.noiseEvents, relevantOnly],
  );
  const sequences = useMemo(() => detectSequences(events), [events]);
  const byHour = useMemo(
    () => computeNoiseByHour(events, report.analyzeStartSec, report.analyzeEndSec),
    [events, report.analyzeStartSec, report.analyzeEndSec],
  );

  // Derived from event durations rather than the stored window counts, so the
  // figure stays consistent whichever way the switch is set.
  const noiseTimeSec = events.reduce((total, e) => total + e.durationSec, 0);
  const noisePct = report.durationSec > 0 ? (noiseTimeSec / report.durationSec) * 100 : 0;

  // Peak and average now describe the events in view rather than every analyzed
  // window. Reduce rather than Math.max(...spread) — a busy night can produce
  // enough events to blow the call stack.
  const peakDb = events.reduce(
    (max, e) => (Number.isFinite(e.peakDb) && e.peakDb > max ? e.peakDb : max),
    -Infinity,
  );

  // Duration-weighted: a 20s event should count for more than a 0.2s one.
  const avgDb = (() => {
    let weighted = 0;
    let seconds = 0;
    for (const e of events) {
      if (!Number.isFinite(e.avgDb) || e.durationSec <= 0) continue;
      weighted += e.avgDb * e.durationSec;
      seconds  += e.durationSec;
    }
    return seconds > 0 ? weighted / seconds : -Infinity;
  })();

  async function handleSaveWav() {
    try {
      setSavingWav(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Storage access is needed to save the recording.');
        return;
      }
      await MediaLibrary.createAssetAsync(report.filePath);
      setSavedWav(true);
      Alert.alert('Saved', 'Recording saved to your media library.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save the recording.');
    } finally {
      setSavingWav(false);
    }
  }

  async function handleSaveReport() {
    try {
      setSavingReport(true);
      await saveReport(report);
      setSavedReport(true);
      Alert.alert('Report saved', 'JSON report saved to your chosen folder.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save the report.');
    } finally {
      setSavingReport(false);
    }
  }

  async function handleShareReport() {
    try {
      await Share.share({
        message: getReportJson(report),
        title: fileName.replace(/\.wav$/i, ' report'),
      });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message ?? 'Could not share the report.');
    }
  }

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← New Recording</Text>
        </TouchableOpacity>
        <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>

        <View style={styles.headerBtns}>
          {source === 'analysis' && (
            <TouchableOpacity
              onPress={handleSaveWav}
              disabled={savingWav || savedWav}
              style={[styles.hBtn, savedWav && styles.hBtnDone]}
            >
              <Text style={styles.hBtnText}>{savedWav ? '✓ Recording' : savingWav ? '…' : 'Save recording'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={savedReport ? handleShareReport : handleSaveReport}
            disabled={savingReport}
            style={[styles.hBtn, savedReport && styles.hBtnDone]}
          >
            <Text style={styles.hBtnText}>
              {savingReport ? '…' : savedReport ? 'Share report' : 'Save report'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Summary ── */}
        <View style={styles.card}>
          <CardHeader title="SUMMARY" value={relevantOnly} onChange={setRelevantOnly} />
          {meta && <Row label="Sound"      value={meta.sound      ? 'on' : 'off'} />}
          {meta && <Row label="Bonnet"     value={meta.bonnet     ? 'yes' : 'no'} />}
          {meta && <Row label="Headphones" value={meta.headphones ? 'yes' : 'no'} />}
          {meta && <Row label="Noise suppression" value={meta.noiseSupp ? 'on' : 'off'} />}
          <Row label="Duration"     value={fmtSec(report.totalDurationSec)} />
          <Row label="Analyzed"     value={`${fmtSec(report.analyzeStartSec)} → ${fmtSec(report.analyzeEndSec)}`} />
          <Row label="Peak level"   value={fmtDb(peakDb)} />
          <Row label="Avg level"    value={fmtDb(avgDb)} />
          <Row label="Threshold"    value={fmtDb(report.thresholdDb)} />
          <Row label="Noise events" value={String(report.noiseEventCount)} highlight />
          <Row label="Relevant noises" value={String(relevantCount)} highlight />
          <Row label="Noise time"   value={fmtSec(noiseTimeSec)} />
          <Row label="Noise %"      value={fmtPct(noisePct)} highlight />
        </View>

        {/* ── Events ── */}
        {events.length > 0 && (
          <View style={styles.card}>
            <CardHeader title={`NOISE EVENTS (${events.length})`} value={relevantOnly} onChange={setRelevantOnly} />
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colIdx]}>#</Text>
              <Text style={[styles.col, styles.colTime]}>Start</Text>
              <Text style={[styles.col, styles.colDur]}>Dur (s)</Text>
              <Text style={[styles.col, styles.colDb]}>Peak (dBFS)</Text>
              <Text style={[styles.col, styles.colVerdict]}>Verdict</Text>
            </View>
            <View style={styles.eventsTable}>
              <FlatList
                data={events}
                keyExtractor={(_, i) => String(i)}
                nestedScrollEnabled
                renderItem={({ item, index }: { item: NoiseEvent; index: number }) => (
                  <View style={index % 2 === 0 ? styles.tableRowAlt : undefined}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.col, styles.colIdx, styles.cellText]}>{index + 1}</Text>
                      <Text style={[styles.col, styles.colTime, styles.cellText]}>{fmtTimeSec(item.startSec)}</Text>
                      <Text style={[styles.col, styles.colDur, styles.cellText]}>{fmtSecValue(item.durationSec)}</Text>
                      <Text style={[styles.col, styles.colDb, styles.cellText]}>{fmtDbValue(item.peakDb)}</Text>
                      <Text
                        style={[styles.col, styles.colVerdict, styles.cellText,
                                isSnoreLike(item.verdict) && styles.verdictSnore]}
                        numberOfLines={1}
                      >
                        {item.verdict ?? '—'}
                      </Text>
                    </View>

                    {item.labels && item.labels.length > 0 && (
                      <View style={styles.labelsLine}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <Text style={styles.labelsText}>
                            {item.labels.map(l => `${l.name} ${l.score.toFixed(2)}`).join('   ·   ')}
                          </Text>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              />
            </View>
          </View>
        )}

        {/* ── Sequences ── */}
        {sequences.length > 0 && (
          <View style={styles.card}>
            <CardHeader title="SEQUENCES" value={relevantOnly} onChange={setRelevantOnly} />
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colIdx]}>Noises</Text>
              <Text style={[styles.col, styles.colDur]}>Count</Text>
              <Text style={[styles.col, styles.colTimes]}>Start times</Text>
            </View>
            <FlatList
              data={sequences}
              keyExtractor={(_, i) => String(i)}
              scrollEnabled={false}
              renderItem={({ item, index }: { item: NoiseSequenceRow; index: number }) => (
                <View style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.col, styles.colIdx, styles.cellText]}>{item.noiseCount}</Text>
                  <Text style={[styles.col, styles.colDur, styles.cellText]}>{item.sequenceCount}×</Text>
                  <View style={styles.colTimes}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <Text style={styles.cellText}>
                        {item.startTimes.map(t => fmtTimeSec(t)).join('  ')}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* ── By hour ── */}
        {byHour.length > 0 && (
          <View style={styles.card}>
            <CardHeader title="NOISES BY HOUR" value={relevantOnly} onChange={setRelevantOnly} />
            {byHour.map(({ hour, noiseCount }: NoiseByHourRow, i: number) => {
              const firstHour = byHour[0].hour;
              const lastHour  = byHour[byHour.length - 1].hour;
              const from = hour === firstHour ? fmtHM(report.analyzeStartSec) : `${String(hour).padStart(2,'0')}:00`;
              const to   = hour === lastHour  ? fmtHM(report.analyzeEndSec)   : `${String(hour+1).padStart(2,'0')}:00`;
              return (
                <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.col, { flex: 2 }, styles.cellText]}>{from} – {to}</Text>
                  <Text style={[styles.col, styles.colIdx, styles.cellText, noiseCount > 0 && styles.noiseHighlight]}>
                    {noiseCount}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {events.length === 0 && (
          <View style={styles.card}>
            <CardHeader title="NOISE EVENTS (0)" value={relevantOnly} onChange={setRelevantOnly} />
            <Text style={styles.emptyText}>
              {relevantOnly && report.noiseEvents.length > 0
                ? `No relevant noises among ${report.noiseEvents.length} events. Turn off "Relevant" to see them all.`
                : 'No noise events detected above threshold.'}
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function CardHeader({ title, value, onChange }: {
  title: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Relevant</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: '#21262d', true: '#1f6feb' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

const C = {
  bg:       '#0d1117',
  card:     '#161b22',
  border:   '#21262d',
  text:     '#e6f4fe',
  muted:    '#8b949e',
  blue:     '#58a6ff',
  green:    '#3fb950',
  red:      '#da3633',
};

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },
  header:           { backgroundColor: C.card, borderBottomColor: C.border, borderBottomWidth: 1, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn:          { marginBottom: 8 },
  backText:         { color: C.blue, fontSize: 14 },
  fileName:         { color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  headerBtns:       { flexDirection: 'row', gap: 8 },
  hBtn:             { flex: 1, backgroundColor: '#21262d', borderWidth: 1, borderColor: C.border, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 6, alignItems: 'center' },
  hBtnDone:         { backgroundColor: '#238636', borderColor: '#238636' },
  hBtnText:         { color: '#fff', fontSize: 12, fontWeight: '600' },
  scroll:           { flex: 1 },
  scrollContent:    { padding: 16, gap: 16, paddingBottom: 40 },
  card:             { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTitle:        { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  cardHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 },
  filterGroup:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterLabel:      { color: C.muted, fontSize: 11, letterSpacing: 0.5 },
  row:              { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border },
  rowLabel:         { color: C.muted, fontSize: 13 },
  rowValue:         { color: C.text, fontSize: 13, fontFamily: 'monospace' },
  rowValueHighlight:{ color: C.blue },
  tableHeader:      { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  eventsTable:      { maxHeight: 420 },
  tableRow:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6 },
  tableRowAlt:      { backgroundColor: '#0d1117' },
  col:              { flex: 1, color: C.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  colIdx:           { flex: 0.6 },
  colTime:          { flex: 1.6 },
  colDur:           { flex: 0.9 },
  colDb:            { flex: 1.2 },
  colVerdict:       { flex: 1.4 },
  colTimes:         { flex: 3 },
  verdictSnore:     { color: C.blue },
  labelsLine:       { paddingHorizontal: 12, paddingBottom: 6, marginTop: -2 },
  labelsText:       { color: C.muted, fontSize: 10, fontFamily: 'monospace' },
  cellText:         { color: C.text, fontSize: 12, fontFamily: 'monospace', fontWeight: '400' },
  noiseHighlight:   { color: C.red },
  emptyText:        { color: C.muted, textAlign: 'center', padding: 20, fontSize: 14 },
});
