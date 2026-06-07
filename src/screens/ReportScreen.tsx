import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { AnalysisReport, NoiseEvent, NoiseByHourRow, NoiseSequenceRow } from '../analysis/types';
import { fmtDb, fmtSec, fmtPct, fmtTime, fmtTimeSec, fmtHM } from '../utils/format';

interface Props {
  report: AnalysisReport;
  onBack: () => void;
}

export default function ReportScreen({ report, onBack }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const fileName = report.filePath.split('/').pop() ?? report.filePath;

  async function handleSave() {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Storage access is needed to save the recording.');
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(report.filePath);

      // copyAsset = true: copies into the album instead of moving,
      // which avoids the Android 10+ scoped-storage write-permission dialog.
      const album = await MediaLibrary.getAlbumAsync('Sleeper');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
      } else {
        await MediaLibrary.createAlbumAsync('Sleeper', asset, true);
      }

      setSaved(true);
      Alert.alert('Saved', 'Recording saved to the "Sleeper" album in your media library.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save the recording.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← New Recording</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || saved}
            style={[styles.saveBtn, saved && styles.saveBtnDone]}
          >
            <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : saving ? 'Saving…' : 'Save to device'}</Text>
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
            <FlatList
              data={report.noiseEvents}
              keyExtractor={(_, i) => String(i)}
              scrollEnabled={false}
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
        )}

        {/* ── Sequences ── */}
        {report.sequences.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SEQUENCES</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colIdx]}>Noises</Text>
              <Text style={[styles.col, styles.colDur]}>Count</Text>
              <Text style={[styles.col, { flex: 3 }]}>First start</Text>
            </View>
            <FlatList
              data={report.sequences}
              keyExtractor={(_, i) => String(i)}
              scrollEnabled={false}
              renderItem={({ item, index }: { item: NoiseSequenceRow; index: number }) => (
                <View style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.col, styles.colIdx, styles.cellText]}>{item.noiseCount}</Text>
                  <Text style={[styles.col, styles.colDur, styles.cellText]}>{item.sequenceCount}×</Text>
                  <Text style={[styles.col, { flex: 3 }, styles.cellText]}>{fmtTimeSec(item.startTimes[0])}</Text>
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
  headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fileName:         { color: C.text, fontSize: 15, fontWeight: '600', flex: 1 },
  saveBtn:          { backgroundColor: '#1f6feb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  saveBtnDone:      { backgroundColor: '#238636' },
  saveBtnText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  scroll:           { flex: 1 },
  scrollContent:    { padding: 16, gap: 16, paddingBottom: 40 },
  card:             { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTitle:        { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  row:              { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border },
  rowLabel:         { color: C.muted, fontSize: 13 },
  rowValue:         { color: C.text, fontSize: 13, fontFamily: 'monospace' },
  rowValueHighlight:{ color: C.blue },
  tableHeader:      { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6 },
  tableRowAlt:      { backgroundColor: '#0d1117' },
  col:              { flex: 1, color: C.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  colIdx:           { flex: 0.6 },
  colTime:          { flex: 2 },
  colDur:           { flex: 1 },
  colDb:            { flex: 1.4 },
  cellText:         { color: C.text, fontSize: 12, fontFamily: 'monospace', fontWeight: '400' },
  noiseHighlight:   { color: C.red },
  emptyText:        { color: C.muted, textAlign: 'center', padding: 20, fontSize: 14 },
});
