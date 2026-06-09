import { Audio } from 'expo-av';

const PLAY_COOLDOWN_MS = 1500;

const SOUND_ASSETS = [
  require('../../assets/sounds/dragon-studio-notification-sound-effect-372475.mp3'),
  require('../../assets/sounds/universfield-new-notification-022-370046.mp3'),
  require('../../assets/sounds/universfield-new-notification-033-480571.mp3'),
  require('../../assets/sounds/universfield-new-notification-036-485897.mp3'),
  require('../../assets/sounds/universfield-new-notification-051-494246.mp3'),
  require('../../assets/sounds/universfield-new-notification-057-494255.mp3'),
];

let preloaded: Audio.Sound[] = [];
let lastPlayedAt = 0;

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
}

export async function unloadSounds(): Promise<void> {
  await Promise.all(preloaded.map(s => s.unloadAsync().catch(() => {})));
  preloaded = [];
}

export async function playRandomSound(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayedAt < PLAY_COOLDOWN_MS || preloaded.length === 0) return;
  lastPlayedAt = now;

  try {
    const sound = preloaded[Math.floor(Math.random() * preloaded.length)];
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Non-fatal — playback failure shouldn't interrupt recording
  }
}
