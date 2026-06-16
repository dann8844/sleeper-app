import BackgroundService from 'react-native-background-actions';
import { Alert } from 'react-native';

let stopResolve: (() => void) | null = null;

const options = {
  taskName:             'SleepRecorder',
  taskTitle:            'Sleeper — Recording',
  taskDesc:             'Recording sleep audio. Tap to return to the app.',
  taskIcon:             { name: 'ic_launcher', type: 'mipmap' },
  color:                '#1f6feb',
  foregroundServiceType: ['microphone' as 'microphone'],
};

async function keepAliveTask(_taskData: unknown): Promise<void> {
  await new Promise<void>(resolve => { stopResolve = resolve; });
}

export async function startBackgroundService(): Promise<void> {
  try {
    await BackgroundService.start(keepAliveTask, options);
  } catch (e: any) {
    Alert.alert('Background service error', String(e?.message ?? e));
  }
}

export async function stopBackgroundService(): Promise<void> {
  try {
    stopResolve?.();
    stopResolve = null;
    await BackgroundService.stop();
  } catch {
    // ignore stop errors
  }
}

export function isRunning(): boolean {
  return BackgroundService.isRunning();
}
