import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEFAULT_START_OFFSET_MIN, DEFAULT_END_OFFSET_MIN } from '../analysis/engine';

interface Props {
  onConfirm: (startOffsetMin: number, endOffsetMin: number) => void;
  onBack: () => void;
}

export default function OffsetsScreen({ onConfirm, onBack }: Props) {
  const [start, setStart] = useState(String(DEFAULT_START_OFFSET_MIN));
  const [end,   setEnd]   = useState(String(DEFAULT_END_OFFSET_MIN));

  const startMin   = parseInt(start, 10);
  const endMin     = parseInt(end, 10);
  const validStart = !isNaN(startMin);
  const validEnd   = !isNaN(endMin);
  const valid      = validStart && validEnd;

  const digitsOnly = (t: string) => t.replace(/[^0-9]/g, '').slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OFFSETS</Text>
      <Text style={styles.subtitle}>Skip the start and end of the recording</Text>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>From end</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, !validEnd && styles.inputError]}
              value={end}
              onChangeText={t => setEnd(digitsOnly(t))}
              keyboardType="numeric"
              maxLength={3}
              selectTextOnFocus
            />
            <Text style={styles.inputUnit}>min</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>From start</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, !validStart && styles.inputError]}
              value={start}
              onChangeText={t => setStart(digitsOnly(t))}
              keyboardType="numeric"
              maxLength={3}
              selectTextOnFocus
            />
            <Text style={styles.inputUnit}>min</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, !valid && styles.btnDisabled]}
        onPress={() => valid && onConfirm(startMin, endMin)}
        disabled={!valid}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Analyze</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title:        { color: '#e6f4fe', fontSize: 20, fontWeight: '700', letterSpacing: 4, marginBottom: 8 },
  subtitle:     { color: '#8b949e', fontSize: 13, textAlign: 'center', marginBottom: 40 },
  row:          { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 48 },
  field:        { alignItems: 'center' },
  fieldLabel:   { color: '#8b949e', fontSize: 12, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input:        { backgroundColor: '#161b22', color: '#e6f4fe', fontSize: 20, fontFamily: 'monospace', borderWidth: 1, borderColor: '#30363d', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, width: 84, textAlign: 'center' },
  inputError:   { borderColor: '#da3633' },
  inputUnit:    { color: '#8b949e', fontSize: 12 },
  btn:          { width: '100%', paddingVertical: 16, borderRadius: 10, alignItems: 'center', backgroundColor: '#1f6feb' },
  btnDisabled:  { opacity: 0.5 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn:      { marginTop: 12, paddingVertical: 8 },
  backText:     { color: '#8b949e', fontSize: 13, textDecorationLine: 'underline' },
});
