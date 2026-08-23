import { Audio } from 'expo-av';

const PLAY_COOLDOWN_MS = 1500;
/** Margin after playback ends — the speaker tail still bleeds into the mic. */
const ALERT_GUARD_MS = 300;
/** Used when expo-av cannot report a duration for an asset. */
const FALLBACK_DURATION_MS = 2000;

const SOUND_ASSETS = [
  require('../../assets/sounds/dragon-studio-notification-sound-effect-372475.mp3'),
  require('../../assets/sounds/universfield-new-notification-022-370046.mp3'),
  require('../../assets/sounds/universfield-new-notification-033-480571.mp3'),
  require('../../assets/sounds/universfield-new-notification-036-485897.mp3'),
  require('../../assets/sounds/universfield-new-notification-051-494246.mp3'),
  require('../../assets/sounds/universfield-new-notification-057-494255.mp3'),
];

let preloaded: Audio.Sound[] = [];
let durations: number[] = [];
let lastPlayedAt = 0;
let alertActiveUntil = 0;

export async function configureAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: true,
  });
}

export async function preloadSounds(): Promise<void> {
  const results = await Promise.all(
    SOUND_ASSETS.map(asset => Audio.Sound.createAsync(asset, { shouldPlay: false }))
  );
  preloaded = results.map(r => r.sound);
  durations = results.map(r =>
    (r.status.isLoaded && r.status.durationMillis) || FALLBACK_DURATION_MS
  );
}

export async function unloadSounds(): Promise<void> {
  await Promise.all(preloaded.map(s => s.unloadAsync().catch(() => {})));
  preloaded = [];
  durations = [];
  alertActiveUntil = 0;
}

/**
 * True while our own alert is audible. The mic is hearing the speaker during
 * this window, so its level says nothing about the room.
 */
export function isAlertActive(): boolean {
  return Date.now() < alertActiveUntil;
}

export async function playRandomSound(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayedAt < PLAY_COOLDOWN_MS || preloaded.length === 0) return;
  lastPlayedAt = now;

  const index = Math.floor(Math.random() * preloaded.length);
  alertActiveUntil = now + durations[index] + ALERT_GUARD_MS;

  try {
    const sound = preloaded[index];
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Non-fatal — but nothing is playing, so stop blinding the detector.
    alertActiveUntil = 0;
  }
}
