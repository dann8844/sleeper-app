import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { configureAudioSession } from './src/sounds';
import { analyzeFile } from './src/analysis/runner';
import { AnalysisReport } from './src/analysis/types';
import RecordScreen from './src/screens/RecordScreen';
import ReportScreen from './src/screens/ReportScreen';

type Screen = 'record' | 'report';

export default function App() {
  const [screen, setScreen]   = useState<Screen>('record');
  const [report, setReport]   = useState<AnalysisReport | null>(null);

  useEffect(() => { configureAudioSession(); }, []);

  async function handleAnalysisReady(filePath: string, isSleepRecording: boolean, thresholdDb: number) {
    const result = await analyzeFile(filePath, { isSleepRecording, thresholdDb });
    setReport(result);
    setScreen('report');
  }

  function handleBack() {
    setReport(null);
    setScreen('record');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {screen === 'record' && (
        <RecordScreen onAnalysisReady={handleAnalysisReady} />
      )}
      {screen === 'report' && report && (
        <ReportScreen report={report} onBack={handleBack} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
});
