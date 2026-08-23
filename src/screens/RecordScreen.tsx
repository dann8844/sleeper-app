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
import { LiveClassification, requestMicPermission, startRecording, stopRecording } from '../recorder';
import { startBackgroundService, stopBackgroundService } from '../recorder/backgroundService';
import { pickAudioFile, pickReportFile } from '../analysis/filePicker';
import { loadReportFile } from '../analysis/reportLoader';
import { AnalysisReport } from '../analysis/types';
import { DEFAULT_THRESHOLD_DBFS } from '../analysis/engine';
import { fmtDb } from '../utils/format';
import { loadSettings, saveSettings } from '../utils/settings';

interface Props {
  onRecordingDone: (filePath: string, thresholdDb: number, classifyFailures: number) => void;
  onAnalysisReady: (filePath: string, isSleepRecording: boolean, thresholdDb: number, displayName?: string) => void;
  onReportLoaded: (report: AnalysisReport) => void;
}

export default function RecordScreen({ onRecordingDone, onAnalysisReady, onReportLoaded }: Props) {
  const [recording, setRecording]       = useState(false);
  const [noiseCount, setNoiseCount]     = useState(0);
  const [lastDb, setLastDb]             = useState<number | null>(null);
  const [isNoise, setIsNoise]           = useState(false);
  const [thresholdInput, setThreshold]  = useState(String(Math.abs(DEFAULT_THRESHOLD_DBFS)));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bonnet, setBonnet]             = useState(false);
  const [headphones, setHeadphones]     = useState(false);
  const [noiseSupp, setNoiseSupp]       = useState(true);
  const [live, setLive]                 = useState<LiveClassification | null>(null);
  const [failures, setFailures]         = useState(0);
  const cleanupRef                      = useRef<(() => void) | null>(null);
  const prevNoiseRef                    = useRef(false);

  useEffect(() => {
    loadSettings().then(s => {
      setThreshold(String(s.thresholdAbs));
      setBonnet(s.bonnet);
      setHeadphones(s.headphones);
      setNoiseSupp(s.noiseSuppression);
    });
  }, []);

  const threshold = -Math.abs(parseFloat(thresholdInput));
  const validThreshold = !isNaN(threshold);

  async function handleToggle() {
    try {
      if (recording) {
        cleanupRef.current?.();
        setRecording(false);
        setLive(null);
        await stopBackgroundService();
        const path = await stopRecording();
        setNoiseCount(0);
        setLastDb(null);
        setIsNoise(false);
        onRecordingDone(path, validThreshold ? threshold : DEFAULT_THRESHOLD_DBFS, failures);
      } else {
        const granted = await requestMicPermission();
        if (!granted) {
          Alert.alert('Permission required', 'Microphone access is needed to record.');
          return;
        }
        setNoiseCount(0);
        setLastDb(null);
        setIsNoise(false);
        setLive(null);
        setFailures(0);
        saveSettings({ thresholdAbs: Math.abs(threshold), bonnet, headphones, noiseSuppression: noiseSupp });
        const cleanup = startRecording({
          thresholdDb: validThreshold ? threshold : DEFAULT_THRESHOLD_DBFS,
          soundEnabled,
          bonnet,
          headphones,
          noiseSuppression: noiseSupp,
          onClassified: setLive,
          onClassifyFailure: setFailures,
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
      saveSettings({ thresholdAbs: Math.abs(threshold), bonnet, headphones, noiseSuppression: noiseSupp });
      onAnalysisReady(file.uri, true, validThreshold ? threshold : DEFAULT_THRESHOLD_DBFS, file.name);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not open file.');
    }
  }

  async function handleOpenReport() {
    try {
      const file = await pickReportFile();
      if (!file) return;
      onReportLoaded(await loadReportFile(file.uri));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not open report.');
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

          {failures > 0 && (
            <Text style={styles.classifierDown}>
              {failures} classification{failures !== 1 ? 's' : ''} failed — alerted anyway
            </Text>
          )}

          {live && (
            <View style={styles.liveBox}>
              {live.relevant && <Text style={styles.relevantTag}>RELEVANT</Text>}
              {live.labels.map(label => (
                <Text
                  key={label.name}
                  style={[styles.labelRow, live.relevant && styles.labelRowRelevant]}
                >
                  {label.name}  {label.score.toFixed(2)}
                </Text>
              ))}
            </View>
          )}
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

          {/* Bonnet toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingLabel}>Bonnet</Text>
              <Text style={styles.settingHint}>wearing a sleep bonnet</Text>
            </View>
            <Switch
              value={bonnet}
              onValueChange={setBonnet}
              trackColor={{ false: '#21262d', true: '#1f6feb' }}
              thumbColor="#fff"
            />
          </View>

          {/* Headphones toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingLabel}>Headphones</Text>
              <Text style={styles.settingHint}>wearing headphones or earbuds</Text>
            </View>
            <Switch
              value={headphones}
              onValueChange={setHeadphones}
              trackColor={{ false: '#21262d', true: '#1f6feb' }}
              thumbColor="#fff"
            />
          </View>

          {/* Noise suppression toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingLabel}>Noise suppression</Text>
              <Text style={styles.settingHint}>less room tone; may alter levels</Text>
            </View>
            <Switch
              value={noiseSupp}
              onValueChange={setNoiseSupp}
              trackColor={{ false: '#21262d', true: '#1f6feb' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.fileBtn} onPress={handlePickFile} activeOpacity={0.7}>
            <Text style={styles.fileBtnText}>Analyze existing recording…</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.fileBtn} onPress={handleOpenReport} activeOpacity={0.7}>
            <Text style={styles.fileBtnText}>Open saved report…</Text>
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
  classifierDown:    { color: '#d29922', fontSize: 11, marginTop: 4, textAlign: 'center' },
  liveBox:           { alignItems: 'center', marginTop: 8, gap: 2 },
  relevantTag:       { color: '#3fb950', fontSize: 15, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  labelRow:          { color: '#8b949e', fontSize: 12, fontFamily: 'monospace' },
  labelRowRelevant:  { color: '#e6f4fe' },
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
