import { Audio } from 'expo-av';

const PLAY_COOLDOWN_MS = 1500;

// All sounds bundled as static assets — Metro resolves these at build time
const SOUND_ASSETS = [
  require('../../assets/sounds/dragon-studio-notification-sound-effect-372475.mp3'),
  require('../../assets/sounds/universfield-new-notification-022-370046.mp3'),
  require('../../assets/sounds/universfield-new-notification-033-480571.mp3'),
  require('../../assets/sounds/universfield-new-notification-036-485897.mp3'),
  require('../../assets/sounds/universfield-new-notification-051-494246.mp3'),
  require('../../assets/sounds/universfield-new-notification-057-494255.mp3'),
];

let lastPlayedAt = 0;
let activeSound: Audio.Sound | null = null;

/**
 * Plays a random bundled notification sound, non-blocking.
 * Respects PLAY_COOLDOWN_MS to avoid rapid-fire playback.
 * Unloads the previous sound before loading the next one.
 */
export async function playRandomSound(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayedAt < PLAY_COOLDOWN_MS) return;
  lastPlayedAt = now;

  try {
    if (activeSound) {
      await activeSound.unloadAsync();
      activeSound = null;
    }

    const asset = SOUND_ASSETS[Math.floor(Math.random() * SOUND_ASSETS.length)];
    const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true });
    activeSound = sound;

    // Auto-unload once playback finishes
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (activeSound === sound) activeSound = null;
      }
    });
  } catch {
    // Non-fatal — playback failure shouldn't interrupt recording
  }
}

/** Call once at app startup to configure audio session for playback during recording. */
export async function configureAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}
