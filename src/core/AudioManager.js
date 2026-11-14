/** Small original synthesizer. Audio starts only after a user gesture. */
export class AudioManager {
  constructor(settings = {}) {
    this.context = null;
    this.master = null;
    this.volume = 0.45;
    this.muted = false;
    this.voices = new Set();
    this.setSettings(settings);
  }

  setSettings(settings = {}) {
    const raw = Number(settings.volume ?? this.volume);
    if (Number.isFinite(raw)) this.volume = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
    if (typeof settings.muted === 'boolean') this.muted = settings.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.22, this.context.currentTime, 0.02);
    }
  }

  async unlock() {
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume * 0.22;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  tone(frequency, duration = 0.1, offset = 0, type = 'square', endFrequency) {
    if (!this.context || !this.master || this.context.state !== 'running' || this.muted) return;
    if (this.voices.size >= 24) return;
    const start = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.55, start + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  play(name) {
    if (!this.context || this.muted) return;
    switch (name) {
      case 'click': this.tone(780, 0.045, 0, 'triangle', 960); break;
      case 'jump': this.tone(230, 0.13, 0, 'square', 660); break;
      case 'land': this.tone(100, 0.065, 0, 'triangle', 52); break;
      case 'interact': this.tone(440, 0.08, 0, 'triangle'); this.tone(660, 0.11, 0.07, 'triangle'); break;
      case 'error': this.tone(180, 0.12, 0, 'sawtooth', 90); this.tone(130, 0.12, 0.13, 'square', 70); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, i * 0.075, 'triangle')); break;
      case 'collect': this.tone(880, 0.08, 0, 'sine'); this.tone(1320, 0.14, 0.06, 'triangle'); break;
      case 'door': this.tone(140, 0.3, 0, 'sawtooth', 430); this.tone(440, 0.16, 0.22, 'triangle'); break;
      case 'hurt': this.tone(260, 0.15, 0, 'sawtooth', 55); break;
      case 'win': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.26, i * 0.11, 'triangle')); break;
      default: break;
    }
  }

  destroy() {
    for (const oscillator of this.voices) {
      try { oscillator.stop(); } catch { /* The short voice may have already ended. */ }
    }
    this.voices.clear();
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
  }
}

export default AudioManager;
