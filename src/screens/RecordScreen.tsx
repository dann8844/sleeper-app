import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { requestMicPermission, startRecording, stopRecording } from '../recorder';
import { startBackgroundService, stopBackgroundService } from '../recorder/backgroundService';
import { pickAudioFile } from '../analysis/filePicker';
import { DEFAULT_THRESHOLD_DBFS } from '../analysis/engine';
import { fmtDb } from '../utils/format';
import { loadSettings, saveSettings } from '../utils/settings';

interface Props {
  onRecordingDone: (filePath: string, thresholdDb: number) => void;
  onAnalysisReady: (filePath: string, isSleepRecording: boolean, thresholdDb: number) => void;
}

export default function RecordScreen({ onRecordingDone, onAnalysisReady }: Props) {
  const [recording, setRecording]       = useState(false);
  const [noiseCount, setNoiseCount]     = useState(0);
  const [lastDb, setLastDb]             = useState<number | null>(null);
  const [isNoise, setIsNoise]           = useState(false);
  const [thresholdInput, setThreshold]  = useState(String(Math.abs(DEFAULT_THRESHOLD_DBFS)));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const cleanupRef                      = useRef<(() => void) | null>(null);
  const prevNoiseRef                    = useRef(false);

  useEffect(() => {
    loadSettings().then(s => setThreshold(String(s.thresholdAbs)));
  }, []);

  const threshold = -Math.abs(parseFloat(thresholdInput));
  const validThreshold = !isNaN(threshold);

  async function handleToggle() {
    try {
      if (recording) {
        cleanupRef.current?.();
        setRecording(false);
        await stopBackgroundService();
        const path = await stopRecording();
        setNoiseCount(0);
        setLastDb(null);
        setIsNoise(false);
        onRecordingDone(path, validThreshold ? threshold : DEFAULT_THRESHOLD_DBFS);
      } else {
        const granted = await requestMicPermission();
        if (!granted) {
          Alert.alert('Permission required', 'Microphone access is needed to record.');
          return;
        }
        setNoiseCount(0);
        setLastDb(null);
        setIsNoise(false);
        saveSettings({ thresholdAbs: Math.abs(threshold) });
        const cleanup = startRecording({
          thresholdDb: validThreshold ? threshold : DEFAULT_THRESHOLD_DBFS,
          soundEnabled,
          onNoise: (noise, db) => {
            setLastDb(db);
            setIsNoise(noise);
            if (noise && !prevNoiseRef.current) setNoiseCount(n => n + 1);
            prevNoiseRef.current = noise;
          },
        });
        cleanupRef.current = cleanup;
        setRecording(true);
        await startBackgroundService();
      }
    } catch (e: any) {
      setRecording(false);
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handlePickFile() {
    try {
      const file = await pickAudioFile();
      if (!file) return;
      saveSettings({ thresholdAbs: Math.abs(threshold) });
      onAnalysisReady(file.uri, true, validThreshold ? threshold : DEFAULT_THRESHOLD_DBFS);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not open file.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SLEEPER</Text>

      <TouchableOpacity
        style={[styles.btn, recording && styles.btnActive]}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>{recording ? 'Stop' : 'Record'}</Text>
      </TouchableOpacity>

      {/* Live stats while recording */}
      {recording && (
        <View style={styles.stats}>
          <View style={[styles.indicator, isNoise && styles.indicatorActive]} />
          <Text style={styles.statLabel}>{isNoise ? 'NOISE DETECTED' : 'Listening…'}</Text>
          <Text style={styles.dbText}>{lastDb != null ? fmtDb(lastDb) : '—'}</Text>
          <Text style={styles.countText}>{noiseCount} noise event{noiseCount !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Settings — hidden while recording */}
      {!recording && (
        <View style={styles.settings}>
          {/* Threshold input */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingLabel}>Noise threshold</Text>
              <Text style={styles.settingHint}>default: {Math.abs(DEFAULT_THRESHOLD_DBFS)}</Text>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputMinus}>−</Text>
              <TextInput
                style={[styles.input, !validThreshold && styles.inputError]}
                value={thresholdInput}
                onChangeText={t => setThreshold(t.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                maxLength={5}
                selectTextOnFocus
              />
              <Text style={styles.inputUnit}>dBFS</Text>
            </View>
          </View>

          {/* Sound toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingLabel}>Sound on noise</Text>
              <Text style={styles.settingHint}>play alert when noise detected</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: '#21262d', true: '#1f6feb' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.fileBtn} onPress={handlePickFile} activeOpacity={0.7}>
            <Text style={styles.fileBtnText}>Analyze existing recording…</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center' },
  title:             { color: '#e6f4fe', fontSize: 28, fontWeight: '700', letterSpacing: 6, marginBottom: 56 },
  btn:               { backgroundColor: '#1f6feb', width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  btnActive:         { backgroundColor: '#da3633' },
  btnText:           { color: '#fff', fontSize: 22, fontWeight: '600' },
  stats:             { alignItems: 'center', marginTop: 48, gap: 12 },
  indicator:         { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3fb950', opacity: 0.3 },
  indicatorActive:   { backgroundColor: '#da3633', opacity: 1 },
  statLabel:         { color: '#8b949e', fontSize: 13, letterSpacing: 1 },
  dbText:            { color: '#e6f4fe', fontSize: 20, fontFamily: 'monospace' },
  countText:         { color: '#58a6ff', fontSize: 16 },
  settings:          { width: '100%', marginTop: 40, paddingHorizontal: 32, gap: 0 },
  settingRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#21262d' },
  settingLabelGroup: { flex: 1, marginRight: 16 },
  settingLabel:      { color: '#e6f4fe', fontSize: 14 },
  settingHint:       { color: '#8b949e', fontSize: 11, marginTop: 2 },
  inputWrapper:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputMinus:        { color: '#e6f4fe', fontSize: 18, fontFamily: 'monospace' },
  input:             { backgroundColor: '#161b22', color: '#e6f4fe', fontSize: 15, fontFamily: 'monospace', borderWidth: 1, borderColor: '#30363d', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, width: 64, textAlign: 'right' },
  inputError:        { borderColor: '#da3633' },
  inputUnit:         { color: '#8b949e', fontSize: 12 },
  fileBtn:           { paddingVertical: 16, alignItems: 'center' },
  fileBtnText:       { color: '#8b949e', fontSize: 14, textDecorationLine: 'underline' },
});
