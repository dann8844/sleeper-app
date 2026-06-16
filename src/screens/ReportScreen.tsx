import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { AnalysisReport, NoiseEvent, NoiseByHourRow, NoiseSequenceRow } from '../analysis/types';
import { fmtDb, fmtSec, fmtPct, fmtTime, fmtTimeSec, fmtHM } from '../utils/format';
import { saveReport, getReportJson } from '../analysis/reportSaver';

interface Props {
  report: AnalysisReport;
  onBack: () => void;
}

export default function ReportScreen({ report, onBack }: Props) {
  const [savingWav,    setSavingWav]    = useState(false);
  const [savedWav,     setSavedWav]     = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport,  setSavedReport]  = useState(false);
  const fileName = report.filePath.split('/').pop() ?? report.filePath;

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
          <TouchableOpacity
            onPress={handleSaveWav}
            disabled={savingWav || savedWav}
            style={[styles.hBtn, savedWav && styles.hBtnDone]}
          >
            <Text style={styles.hBtnText}>{savedWav ? '✓ Recording' : savingWav ? '…' : 'Save recording'}</Text>
          </TouchableOpacity>

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
          <Text style={styles.cardTitle}>SUMMARY</Text>
          <Row label="Duration"     value={fmtSec(report.totalDurationSec)} />
          <Row label="Analyzed"     value={`${fmtSec(report.analyzeStartSec)} → ${fmtSec(report.analyzeEndSec)}`} />
          <Row label="Peak level"   value={fmtDb(report.overallPeakDb)} />
          <Row label="Avg level"    value={fmtDb(report.overallAvgDb)} />
          <Row label="Threshold"    value={fmtDb(report.thresholdDb)} />
          <Row label="Noise events" value={String(report.noiseEventCount)} highlight />
          <Row label="Noise time"   value={fmtSec(report.totalNoiseTimeSec)} />
          <Row label="Noise %"      value={fmtPct(report.percentageNoise)} highlight />
        </View>

        {/* ── Events ── */}
        {report.noiseEvents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOISE EVENTS ({report.noiseEventCount})</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colIdx]}>#</Text>
              <Text style={[styles.col, styles.colTime]}>Start</Text>
              <Text style={[styles.col, styles.colDur]}>Dur</Text>
              <Text style={[styles.col, styles.colDb]}>Peak</Text>
            </View>
            <View style={styles.eventsTable}>
              <FlatList
                data={report.noiseEvents}
                keyExtractor={(_, i) => String(i)}
                nestedScrollEnabled
                renderItem={({ item, index }: { item: NoiseEvent; index: number }) => (
                  <View style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.col, styles.colIdx, styles.cellText]}>{index + 1}</Text>
                    <Text style={[styles.col, styles.colTime, styles.cellText]}>{fmtTime(item.startSec)}</Text>
                    <Text style={[styles.col, styles.colDur, styles.cellText]}>{fmtSec(item.durationSec)}</Text>
                    <Text style={[styles.col, styles.colDb, styles.cellText]}>{fmtDb(item.peakDb)}</Text>
                  </View>
                )}
              />
            </View>
          </View>
        )}

        {/* ── Sequences ── */}
        {report.sequences.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SEQUENCES</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colIdx]}>Noises</Text>
              <Text style={[styles.col, styles.colDur]}>Count</Text>
              <Text style={[styles.col, styles.colTimes]}>Start times</Text>
            </View>
            <FlatList
              data={report.sequences}
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
        {report.noiseByHour.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOISES BY HOUR</Text>
            {report.noiseByHour.map(({ hour, noiseCount }: NoiseByHourRow, i: number) => {
              const firstHour = report.noiseByHour[0].hour;
              const lastHour  = report.noiseByHour[report.noiseByHour.length - 1].hour;
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

        {report.noiseEvents.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No noise events detected above threshold.</Text>
          </View>
        )}

      </ScrollView>
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
  row:              { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border },
  rowLabel:         { color: C.muted, fontSize: 13 },
  rowValue:         { color: C.text, fontSize: 13, fontFamily: 'monospace' },
  rowValueHighlight:{ color: C.blue },
  tableHeader:      { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  eventsTable:      { maxHeight: 300 },
  tableRow:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6 },
  tableRowAlt:      { backgroundColor: '#0d1117' },
  col:              { flex: 1, color: C.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  colIdx:           { flex: 0.6 },
  colTime:          { flex: 2 },
  colDur:           { flex: 1 },
  colDb:            { flex: 1.4 },
  colTimes:         { flex: 3 },
  cellText:         { color: C.text, fontSize: 12, fontFamily: 'monospace', fontWeight: '400' },
  noiseHighlight:   { color: C.red },
  emptyText:        { color: C.muted, textAlign: 'center', padding: 20, fontSize: 14 },
});
