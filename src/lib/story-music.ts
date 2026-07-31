export interface StoryMusicTrack {
  id: string;
  title: string;
  mood: string;
  bpm: number;
  notes: number[];
  wave: OscillatorType;
}

/**
 * These short loops are generated in the browser from original note patterns.
 * No copyrighted recordings are bundled or streamed.
 */
export const STORY_MUSIC: StoryMusicTrack[] = [
  { id: "sunrise", title: "Sunrise", mood: "Warm pop", bpm: 104, notes: [60, 64, 67, 72, 67, 64, 62, 67], wave: "triangle" },
  { id: "night-drive", title: "Night Drive", mood: "Synth pulse", bpm: 116, notes: [45, 52, 57, 52, 48, 55, 60, 55], wave: "sawtooth" },
  { id: "soft-focus", title: "Soft Focus", mood: "Calm ambient", bpm: 82, notes: [57, 60, 64, 69, 64, 60, 55, 60], wave: "sine" },
  { id: "bright-day", title: "Bright Day", mood: "Upbeat", bpm: 124, notes: [65, 69, 72, 77, 74, 72, 69, 72], wave: "square" },
  { id: "afterglow", title: "Afterglow", mood: "Dreamy", bpm: 92, notes: [52, 59, 64, 66, 64, 59, 55, 59], wave: "triangle" },
];

function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function startStoryMusic(trackId: string | null | undefined): () => void {
  if (!trackId || typeof window === "undefined") return () => undefined;
  const track = STORY_MUSIC.find((item) => item.id === trackId);
  if (!track) return () => undefined;

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return () => undefined;

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.055;
  master.connect(context.destination);

  let stopped = false;
  let step = 0;
  const intervalMs = (60_000 / track.bpm) / 2;

  const play = () => {
    if (stopped) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = track.wave;
    oscillator.frequency.value = midiToFrequency(track.notes[step % track.notes.length]);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.75, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + Math.min(0.34, intervalMs / 1000));
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + Math.min(0.4, intervalMs / 1000));
    step += 1;
  };

  void context.resume();
  play();
  const timer = window.setInterval(play, intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    master.gain.setTargetAtTime(0.0001, context.currentTime, 0.025);
    window.setTimeout(() => void context.close(), 120);
  };
}
