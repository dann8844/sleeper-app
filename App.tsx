import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { configureAudioSession, preloadSounds } from './src/sounds';
import { analyzeFile } from './src/analysis/runner';
import { AnalysisReport } from './src/analysis/types';
import RecordScreen from './src/screens/RecordScreen';
import PostRecordScreen from './src/screens/PostRecordScreen';
import ReportScreen from './src/screens/ReportScreen';
import OffsetsScreen from './src/screens/OffsetsScreen';

type Screen = 'record' | 'post-record' | 'offsets' | 'analyzing' | 'report';

interface PostRecordState {
  filePath: string;
  thresholdDb: number;
  classifyFailures: number;
}

/** An analysis staged on the offsets screen, waiting to be confirmed. */
interface PendingAnalysis {
  filePath: string;
  thresholdDb: number;
  isSleepRecording: boolean;
  displayName?: string;
}

export default function App() {
  const [screen, setScreen]         = useState<Screen>('record');
  const [postRecord, setPostRecord] = useState<PostRecordState | null>(null);
  const [report, setReport]         = useState<AnalysisReport | null>(null);
  const [reportSource, setSource]   = useState<'analysis' | 'file'>('analysis');
  const [pending, setPending]       = useState<PendingAnalysis | null>(null);
  const [progress, setProgress]     = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    configureAudioSession();
    preloadSounds();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'record') { handleBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, postRecord]);

  function handleRecordingDone(filePath: string, thresholdDb: number, classifyFailures: number) {
    setPostRecord({ filePath, thresholdDb, classifyFailures });
    setScreen('post-record');
  }

  function handleAnalysisReady(filePath: string, isSleepRecording: boolean, thresholdDb: number, displayName?: string) {
    setPending({ filePath, thresholdDb, isSleepRecording, displayName });
    setScreen('offsets');
  }

  function handleAnalyzePostRecord() {
    if (!postRecord) return;
    setPending({ filePath: postRecord.filePath, thresholdDb: postRecord.thresholdDb, isSleepRecording: true });
    setScreen('offsets');
  }

  async function handleOffsetsConfirm(startOffsetMin: number, endOffsetMin: number) {
    if (!pending) return;
    setProgress(null);
    setScreen('analyzing');
    try {
      const result = await analyzeFile(pending.filePath, {
        isSleepRecording: pending.isSleepRecording,
        thresholdDb:      pending.thresholdDb,
        displayName:      pending.displayName,
        startOffsetMin,
        endOffsetMin,
        onClassifyProgress: (done, total) => setProgress({ done, total }),
      });
      setReport(result);
      setSource('analysis');
      setScreen('report');
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? 'Unknown error');
      Alert.alert('Analysis failed', msg);
      setScreen('record');
    }
  }

  function handleReportLoaded(loaded: AnalysisReport) {
    setReport(loaded);
    setSource('file');
    setScreen('report');
  }

  function handleBack() {
    // Backing out of offsets returns to the recording it was staged from,
    // rather than discarding it.
    if (screen === 'offsets' && postRecord) {
      setPending(null);
      setScreen('post-record');
      return;
    }
    setReport(null);
    setPostRecord(null);
    setPending(null);
    setScreen('record');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {screen === 'record' && (
        <RecordScreen
          onRecordingDone={handleRecordingDone}
          onAnalysisReady={handleAnalysisReady}
          onReportLoaded={handleReportLoaded}
        />
      )}

      {screen === 'post-record' && postRecord && (
        <PostRecordScreen
          filePath={postRecord.filePath}
          thresholdDb={postRecord.thresholdDb}
          classifyFailures={postRecord.classifyFailures}
          onAnalyze={handleAnalyzePostRecord}
          onBack={handleBack}
        />
      )}

      {screen === 'offsets' && (
        <OffsetsScreen onConfirm={handleOffsetsConfirm} onBack={handleBack} />
      )}

      {screen === 'analyzing' && (
        <View style={styles.analyzing}>
          <ActivityIndicator size="large" color="#1f6feb" />
          <Text style={styles.analyzingText}>
            {progress
              ? `Classifying ${progress.done}/${progress.total} events…`
              : 'Analyzing recording…'}
          </Text>
        </View>
      )}

      {screen === 'report' && report && (
        <ReportScreen report={report} onBack={handleBack} source={reportSource} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0d1117' },
  analyzing:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  analyzingText: { color: '#8b949e', marginTop: 20, fontSize: 16 },
});
