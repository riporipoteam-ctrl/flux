/**
 * Flux Farm — audio engine.
 *
 * Sound is synthesised live with the Web Audio API rather than shipped as
 * files: no downloads, no licensing ambiguity, works offline and on GitHub
 * Pages, and the music can react to the clock, the season and the weather in
 * ways a fixed loop cannot.
 *
 * Drop-in override: if real recordings are preferred, put OGG/MP3 files in
 * `public/audio/flux-farm/` using the SAMPLE_NAMES keys below (for example
 * `public/audio/flux-farm/harvest.ogg`). Anything found there is preloaded and
 * played instead of the synthesised version — use CC0 packs such as Kenney's
 * or OpenGameArt's public-domain sets so redistribution stays clear.
 */

import { WEATHER_INFO, type Season, type Weather } from "./content";

export const SAMPLE_NAMES = [
  "till",
  "plant",
  "water",
  "harvest",
  "coin",
  "levelup",
  "click",
  "deny",
  "step",
  "thunder",
] as const;
export type SampleName = (typeof SAMPLE_NAMES)[number];

const SAMPLE_BASE = "/audio/flux-farm";

/* -------------------------------------------------------------------------- */
/* Musical material                                                            */
/* -------------------------------------------------------------------------- */

/** Scale degrees (semitones from the root) per season. */
const SCALES: Record<Season, number[]> = {
  spring: [0, 2, 4, 7, 9, 12, 14, 16],
  summer: [0, 2, 4, 5, 7, 9, 11, 12],
  autumn: [0, 2, 3, 5, 7, 8, 10, 12],
  winter: [0, 2, 3, 5, 7, 8, 11, 12],
};

/** Four-bar chord progressions, as scale-degree triads. */
const PROGRESSIONS: Record<Season, number[][]> = {
  spring: [
    [0, 2, 4],
    [3, 5, 7],
    [4, 6, 8],
    [0, 2, 4],
  ],
  summer: [
    [0, 2, 4],
    [4, 6, 8],
    [5, 7, 9],
    [3, 5, 7],
  ],
  autumn: [
    [0, 2, 4],
    [5, 7, 9],
    [3, 5, 7],
    [4, 6, 8],
  ],
  winter: [
    [0, 2, 4],
    [2, 4, 6],
    [5, 7, 9],
    [0, 2, 4],
  ],
};

const ROOT_HZ: Record<Season, number> = {
  spring: 261.63, // C4
  summer: 293.66, // D4
  autumn: 220.0, // A3
  winter: 196.0, // G3
};

function degreeToHz(root: number, scale: number[], degree: number) {
  const safe = Number.isFinite(degree) ? Math.round(degree) : 0;
  const octave = Math.floor(safe / scale.length);
  const step = ((safe % scale.length) + scale.length) % scale.length;
  const hz = root * Math.pow(2, (scale[step] + octave * 12) / 12);
  return Number.isFinite(hz) ? hz : root;
}

/* -------------------------------------------------------------------------- */
/* Engine                                                                      */
/* -------------------------------------------------------------------------- */

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  muted: boolean;
}

export class FarmAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;

  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private rainSource: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private samples = new Map<SampleName, AudioBuffer>();

  private schedulerTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;

  private season: Season = "spring";
  private night = false;
  private weather: Weather = "clear";
  private intensity = 1;

  settings: AudioSettings = { master: 0.75, music: 0.5, sfx: 0.85, ambience: 0.6, muted: false };

  get started() {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture — browsers block audio otherwise. */
  async start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }

    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.settings.muted ? 0 : this.settings.master;

    // A gentle limiter keeps layered synths from clipping on loud moments.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 22;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;

    master.connect(compressor).connect(ctx.destination);
    this.master = master;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.settings.music;
    this.musicGain.connect(master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfx;
    this.sfxGain.connect(master);

    this.ambienceGain = ctx.createGain();
    this.ambienceGain.gain.value = this.settings.ambience;
    this.ambienceGain.connect(master);

    this.noiseBuffer = this.makeNoiseBuffer(ctx, 3);
    this.startAmbience();
    this.startMusic();
    void this.preloadSamples();
  }

  stop() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.windSource?.stop();
    this.rainSource?.stop();
    this.windSource = null;
    this.rainSource = null;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  setSettings(next: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...next };
    const now = this.ctx?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.05);
    this.musicGain?.gain.setTargetAtTime(this.settings.music, now, 0.05);
    this.sfxGain?.gain.setTargetAtTime(this.settings.sfx, now, 0.05);
    this.ambienceGain?.gain.setTargetAtTime(this.settings.ambience, now, 0.05);
  }

  /** Called every frame by the game loop; cheap and idempotent. */
  update(season: Season, night: boolean, weather: Weather, windSpeed: number) {
    this.season = season;
    this.night = night;
    this.weather = weather;
    this.intensity = night ? 0.7 : 1;

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Wind: brown-ish noise through a lowpass whose cutoff and gain track speed.
    if (this.windFilter && this.windGain) {
      const target = Math.min(0.22, 0.02 + windSpeed * 0.05);
      this.windGain.gain.setTargetAtTime(target, now, 0.6);
      this.windFilter.frequency.setTargetAtTime(220 + windSpeed * 260, now, 0.6);
    }

    // Rain: white noise through a bandpass; storms open it up and get louder.
    if (this.rainGain && this.rainFilter) {
      const raining = weather === "rain" || weather === "storm";
      const target = raining ? (weather === "storm" ? 0.3 : 0.17) : 0;
      this.rainGain.gain.setTargetAtTime(target, now, 0.8);
      this.rainFilter.frequency.setTargetAtTime(weather === "storm" ? 2400 : 3600, now, 0.8);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Buffers                                                                 */
  /* ---------------------------------------------------------------------- */

  private makeNoiseBuffer(ctx: AudioContext, seconds: number) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      // Light integration turns white noise into a softer, wind-like spectrum.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  private async preloadSamples() {
    if (typeof fetch !== "function") return;
    const base = (process.env.NEXT_PUBLIC_BASE_PATH || "") + SAMPLE_BASE;

    await Promise.all(
      SAMPLE_NAMES.map(async (name) => {
        for (const extension of ["ogg", "mp3", "wav"]) {
          try {
            const response = await fetch(`${base}/${name}.${extension}`, { cache: "force-cache" });
            if (!response.ok) continue;
            const bytes = await response.arrayBuffer();
            const decoded = await this.ctx!.decodeAudioData(bytes);
            this.samples.set(name, decoded);
            return;
          } catch {
            // No override present for this name — the synthesised voice is used.
          }
        }
      })
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Ambience                                                                */
  /* ---------------------------------------------------------------------- */

  private startAmbience() {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.ambienceGain) return;

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 320;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.04;

    // Slow LFO on the cutoff makes the wind breathe instead of hiss.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();

    wind.connect(windFilter).connect(windGain).connect(this.ambienceGain);
    wind.start();
    this.windSource = wind;
    this.windFilter = windFilter;
    this.windGain = windGain;

    const rain = ctx.createBufferSource();
    rain.buffer = this.makeNoiseBuffer(ctx, 2);
    rain.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 3400;
    rainFilter.Q.value = 0.5;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rain.connect(rainFilter).connect(rainGain).connect(this.ambienceGain);
    rain.start();
    this.rainSource = rain;
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;
  }

  /** Dawn birdsong / night crickets, called from the day/night transition. */
  wildlife(kind: "birds" | "crickets") {
    const ctx = this.ctx;
    if (!ctx || !this.ambienceGain) return;
    const now = ctx.currentTime;

    if (kind === "birds") {
      for (let i = 0; i < 4; i += 1) {
        const at = now + i * 0.24 + Math.random() * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const base = 1800 + Math.random() * 900;
        osc.frequency.setValueAtTime(base, at);
        osc.frequency.exponentialRampToValueAtTime(base * 1.6, at + 0.07);
        osc.frequency.exponentialRampToValueAtTime(base * 0.9, at + 0.15);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.05, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        osc.connect(gain).connect(this.ambienceGain);
        osc.start(at);
        osc.stop(at + 0.22);
      }
      return;
    }

    for (let i = 0; i < 6; i += 1) {
      const at = now + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 4200 + Math.random() * 400;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.012, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      osc.connect(gain).connect(this.ambienceGain);
      osc.start(at);
      osc.stop(at + 0.06);
    }
  }

  thunder() {
    const ctx = this.ctx;
    if (!ctx || !this.ambienceGain || !this.noiseBuffer) return;
    const now = ctx.currentTime + 0.2;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 2.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start(now);
    source.stop(now + 2.8);
  }

  /* ---------------------------------------------------------------------- */
  /* Music                                                                   */
  /* ---------------------------------------------------------------------- */

  private startMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.schedulerTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  /**
   * A 16-step look-ahead sequencer. Each bar picks a chord from the season's
   * progression and layers a pad, a bass note, an arpeggio and light
   * percussion. Night drops the arp and softens the pad.
   */
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;

    const bpm = this.night ? 68 : 88;
    const stepDuration = 60 / bpm / 2;

    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      const time = this.nextNoteTime;
      const scale = SCALES[this.season];
      const root = ROOT_HZ[this.season];
      const bar = Math.floor(this.step / 8) % 4;
      const chord = PROGRESSIONS[this.season][bar];
      const inBar = this.step % 8;
      const stormy = this.weather === "storm" || this.weather === "frost";

      if (inBar === 0) {
        for (let i = 0; i < chord.length; i += 1) {
          this.pad(degreeToHz(root, scale, chord[i]) / 2, time, stepDuration * 8, 0.05 * this.intensity);
        }
        this.bass(degreeToHz(root, scale, chord[0]) / 4, time, stepDuration * 4);
      }

      if (!this.night && !stormy && inBar % 2 === 1) {
        const degree = chord[Math.floor(inBar / 2) % chord.length] + (inBar > 4 ? scale.length : 0);
        this.pluck(degreeToHz(root, scale, degree), time, 0.16 * this.intensity);
      }

      if (this.night && inBar === 4) {
        this.pluck(degreeToHz(root, scale, chord[2]), time, 0.1);
      }

      if (!stormy && (inBar === 0 || inBar === 4)) this.percussion(time, inBar === 0);

      this.nextNoteTime += stepDuration;
      this.step += 1;
    }
  }

  private pad(frequency: number, time: number, duration: number, gainValue: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const detuned = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const hz = Number.isFinite(frequency) ? Math.max(20, frequency) : 220;
    osc.type = "triangle";
    detuned.type = "sine";
    osc.frequency.value = hz;
    detuned.frequency.value = hz * 1.005;

    filter.type = "lowpass";
    filter.frequency.value = this.night ? 900 : 1800;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + duration * 0.3);
    gain.gain.linearRampToValueAtTime(gainValue * 0.7, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    detuned.connect(filter);
    filter.connect(gain).connect(this.musicGain);
    osc.start(time);
    detuned.start(time);
    osc.stop(time + duration + 0.05);
    detuned.stop(time + duration + 0.05);
  }

  private bass(frequency: number, time: number, duration: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = Number.isFinite(frequency) ? Math.max(20, frequency) : 110;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.11 * this.intensity, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private pluck(frequency: number, time: number, gainValue: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.value = Number.isFinite(frequency) ? Math.max(20, frequency) : 440;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, time);
    filter.frequency.exponentialRampToValueAtTime(700, time + 0.35);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
    osc.connect(filter).connect(gain).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.46);
  }

  private percussion(time: number, accent: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = accent ? 220 : 1600;
    filter.Q.value = accent ? 1.2 : 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(accent ? 0.09 : 0.035, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.16 : 0.07));
    source.connect(filter).connect(gain).connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.2);
  }

  /* ---------------------------------------------------------------------- */
  /* Sound effects                                                           */
  /* ---------------------------------------------------------------------- */

  play(name: SampleName, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.settings.muted) return;

    const override = this.samples.get(name);
    if (override) {
      const source = ctx.createBufferSource();
      source.buffer = override;
      source.playbackRate.value = pitch;
      source.connect(this.sfxGain);
      source.start();
      return;
    }

    const now = ctx.currentTime;
    switch (name) {
      case "till":
        this.noiseHit(now, 260 * pitch, 0.22, 0.26, "lowpass");
        this.tone(now, 90 * pitch, 70, 0.1, 0.12, "triangle");
        break;
      case "plant":
        this.tone(now, 420 * pitch, 620 * pitch, 0.09, 0.14, "sine");
        this.noiseHit(now, 900, 0.05, 0.08, "highpass");
        break;
      case "water":
        this.noiseSweep(now, 900, 3200, 0.32, 0.13);
        this.tone(now + 0.04, 620, 340, 0.05, 0.22, "sine");
        break;
      case "harvest":
        this.tone(now, 520 * pitch, 780 * pitch, 0.12, 0.14, "triangle");
        this.tone(now + 0.06, 780 * pitch, 1040 * pitch, 0.09, 0.16, "sine");
        this.noiseHit(now, 1800, 0.06, 0.09, "bandpass");
        break;
      case "coin":
        this.tone(now, 1180, 1180, 0.1, 0.09, "square");
        this.tone(now + 0.07, 1560, 1560, 0.09, 0.16, "square");
        break;
      case "levelup":
        [0, 4, 7, 12].forEach((semitone, index) => {
          this.tone(now + index * 0.09, 440 * Math.pow(2, semitone / 12), 440 * Math.pow(2, semitone / 12), 0.11, 0.3, "triangle");
        });
        break;
      case "click":
        this.tone(now, 900, 700, 0.05, 0.05, "square");
        break;
      case "deny":
        this.tone(now, 220, 150, 0.09, 0.2, "sawtooth");
        break;
      case "step":
        this.noiseHit(now, 420 * pitch, 0.045, 0.06, "lowpass");
        break;
      case "thunder":
        this.thunder();
        break;
      default:
        break;
    }
  }

  private tone(
    at: number,
    startHz: number,
    endHz: number,
    gainValue: number,
    duration: number,
    type: OscillatorType
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const from = Number.isFinite(startHz) ? Math.max(20, startHz) : 220;
    const to = Number.isFinite(endHz) ? Math.max(20, endHz) : from;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(at);
    osc.stop(at + duration + 0.03);
  }

  private noiseHit(at: number, frequency: number, gainValue: number, duration: number, type: BiquadFilterType) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(at);
    source.stop(at + duration + 0.05);
  }

  private noiseSweep(at: number, fromHz: number, toHz: number, gainValue: number, duration: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(fromHz, at);
    filter.frequency.exponentialRampToValueAtTime(toHz, at + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(at);
    source.stop(at + duration + 0.05);
  }
}

export function weatherWantsThunder(weather: Weather) {
  return WEATHER_INFO[weather].hazard > 0.1 && weather === "storm";
}
