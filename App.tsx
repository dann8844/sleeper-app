import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { configureAudioSession, preloadSounds } from './src/sounds';
import { analyzeFile } from './src/analysis/runner';
import { AnalysisReport } from './src/analysis/types';
import RecordScreen from './src/screens/RecordScreen';
import PostRecordScreen from './src/screens/PostRecordScreen';
import ReportScreen from './src/screens/ReportScreen';

type Screen = 'record' | 'post-record' | 'analyzing' | 'report';

interface PostRecordState {
  filePath: string;
  thresholdDb: number;
}

export default function App() {
  const [screen, setScreen]         = useState<Screen>('record');
  const [postRecord, setPostRecord] = useState<PostRecordState | null>(null);
  const [report, setReport]         = useState<AnalysisReport | null>(null);

  useEffect(() => {
    configureAudioSession();
    preloadSounds();
  }, []);

  function handleRecordingDone(filePath: string, thresholdDb: number) {
    setPostRecord({ filePath, thresholdDb });
    setScreen('post-record');
  }

  async function handleAnalysisReady(filePath: string, isSleepRecording: boolean, thresholdDb: number) {
    setScreen('analyzing');
    try {
      const result = await analyzeFile(filePath, { isSleepRecording, thresholdDb });
      setReport(result);
      setScreen('report');
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? 'Unknown error');
      Alert.alert('Analysis failed', msg);
      setScreen('record');
    }
  }

  async function handleAnalyzePostRecord() {
    if (!postRecord) return;
    await handleAnalysisReady(postRecord.filePath, true, postRecord.thresholdDb);
  }

  function handleBack() {
    setReport(null);
    setPostRecord(null);
    setScreen('record');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {screen === 'record' && (
        <RecordScreen
          onRecordingDone={handleRecordingDone}
          onAnalysisReady={handleAnalysisReady}
        />
      )}

      {screen === 'post-record' && postRecord && (
        <PostRecordScreen
          filePath={postRecord.filePath}
          thresholdDb={postRecord.thresholdDb}
          onAnalyze={handleAnalyzePostRecord}
          onBack={handleBack}
        />
      )}

      {screen === 'analyzing' && (
        <View style={styles.analyzing}>
          <ActivityIndicator size="large" color="#1f6feb" />
          <Text style={styles.analyzingText}>Analyzing recording…</Text>
        </View>
      )}

      {screen === 'report' && report && (
        <ReportScreen report={report} onBack={handleBack} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0d1117' },
  analyzing:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  analyzingText: { color: '#8b949e', marginTop: 20, fontSize: 16 },
});
