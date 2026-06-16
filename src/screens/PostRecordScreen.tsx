import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';

interface Props {
  filePath: string;
  thresholdDb: number;
  onAnalyze: () => void;
  onBack: () => void;
}

export default function PostRecordScreen({ filePath, onAnalyze, onBack }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const fileName = filePath.split('/').pop() ?? filePath;

  async function handleSave() {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Storage access is needed to save the recording.');
        return;
      }
      await MediaLibrary.createAssetAsync(filePath);
      setSaved(true);
      Alert.alert('Saved', 'Recording saved to your media library.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save the recording.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RECORDING COMPLETE</Text>

      <Text style={styles.fileName} numberOfLines={2}>{fileName}</Text>

      <TouchableOpacity
        style={[styles.btn, styles.btnSave, (saving || saved) && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving || saved}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{saved ? '✓ Saved to device' : 'Save to device'}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnAnalyze]}
        onPress={onAnalyze}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Analyze</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backText}>Discard &amp; go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title:       { color: '#e6f4fe', fontSize: 20, fontWeight: '700', letterSpacing: 4, marginBottom: 24 },
  fileName:    { color: '#8b949e', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', marginBottom: 48 },
  btn:         { width: '100%', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
  btnSave:     { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
  btnAnalyze:  { backgroundColor: '#1f6feb' },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn:     { marginTop: 12, paddingVertical: 8 },
  backText:    { color: '#8b949e', fontSize: 13, textDecorationLine: 'underline' },
});
