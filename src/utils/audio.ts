// Procedural Web Audio API sound synthesizer for Ashen Realm
// 100% offline, zero external audio asset dependencies, low latency.

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private isMusicPlaying = false;
  private ambientInterval: any = null;
  private bossInterval: any = null;
  public isMuted = false;
  public sfxVolume = 0.8;
  public musicVolume = 0.6;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
        this.masterGainNode.connect(this.ctx.destination);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);

        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        this.musicGainNode.connect(this.masterGainNode);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.ctx) {
      if (this.sfxGainNode) this.sfxGainNode.gain.setValueAtTime(sfx, this.ctx.currentTime);
      if (this.musicGainNode) this.musicGainNode.gain.setValueAtTime(music, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Sword light swing whoosh
  public playSwing(pitch = 1.0) {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      // White noise buffer for wind/whoosh
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600 * pitch, t);
      filter.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.08);
      filter.frequency.exponentialRampToValueAtTime(300 * pitch, t + 0.18);
      filter.Q.value = 3.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGainNode);

      noise.start(t);
      noise.stop(t + 0.18);
    } catch (e) {
      // Ignore audio context glitch
    }
  }

  // Heavy cleave charging and whoosh
  public playHeavyCleave() {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.35);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);
      osc.start(t);
      osc.stop(t + 0.35);

      this.playSwing(0.7);
    } catch (e) {}
  }

  // Metal impact / Hit spark
  public playHit(isCrit = false) {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;

      // Heavy metallic clash
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isCrit ? 520 : 380, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(isCrit ? 980 : 740, t);
      osc2.frequency.exponentialRampToValueAtTime(220, t + 0.12);

      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.18);
      osc2.stop(t + 0.18);
    } catch (e) {}
  }

  // Shield parry clang - high metallic harmonic resonance
  public playParry() {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      [1200, 1800, 2400].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const duration = 0.4 + idx * 0.15;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(this.sfxGainNode!);
        osc.start(t);
        osc.stop(t + duration);
      });
    } catch (e) {}
  }

  // Rune Burst AoE explosion
  public playRuneBurst() {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      // Sub-bass thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.45);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);
      osc.start(t);
      osc.stop(t + 0.45);

      // Shimmering mystical rune chime
      [880, 1320, 1760].forEach((f, i) => {
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t + i * 0.05);
        g.gain.setValueAtTime(0.2, t + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g);
        g.connect(this.sfxGainNode!);
        o.start(t + i * 0.05);
        o.stop(t + 0.6);
      });
    } catch (e) {}
  }

  // Dodge roll swoosh
  public playDodge() {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.22);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);
      osc.start(t);
      osc.stop(t + 0.22);
    } catch (e) {}
  }

  // Estus flask / Potion heal drink
  public playPotion() {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      [440, 554, 659, 880].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.07);
        gain.gain.setValueAtTime(0.25, t + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGainNode!);
        osc.start(t + idx * 0.07);
        osc.stop(t + idx * 0.07 + 0.3);
      });
    } catch (e) {}
  }

  // Player hurt groan
  public playHurt() {
    this.init();
    if (!this.ctx || !this.sfxGainNode || this.isMuted) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) {}
  }

  // Ambient Dark Fantasy Music Generator Loop
  public startAmbientMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.init();

    const playChord = () => {
      if (!this.ctx || !this.musicGainNode || !this.isMusicPlaying || this.isMuted) return;
      try {
        const rootNotes = [65.41, 77.78, 87.31, 98.00, 110.00]; // C2, D#2, F2, G2, A2
        const root = rootNotes[Math.floor(Math.random() * rootNotes.length)];
        const chordFreqs = [root, root * 1.2, root * 1.5, root * 2.0];

        const t = this.ctx.currentTime;
        chordFreqs.forEach(freq => {
          const osc = this.ctx!.createOscillator();
          const filter = this.ctx!.createBiquadFilter();
          const gain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(350, t);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.08, t + 2.0);
          gain.gain.linearRampToValueAtTime(0.001, t + 6.0);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.musicGainNode!);

          osc.start(t);
          osc.stop(t + 6.2);
        });
      } catch (e) {}
    };

    playChord();
    this.ambientInterval = setInterval(playChord, 5500);
  }

  public stopAmbientMusic() {
    this.isMusicPlaying = false;
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }
}

export const soundManager = new SoundSynthesizer();
