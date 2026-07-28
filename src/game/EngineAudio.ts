export class EngineAudio {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  constructor(private volume: number) {}

  start(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext;
    this.context = new AudioContextClass();
    this.oscillator = this.context.createOscillator();
    this.gain = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.oscillator.type = 'sawtooth';
    this.oscillator.frequency.value = 38;
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 180;
    this.gain.gain.value = 0;
    this.oscillator.connect(this.filter).connect(this.gain).connect(this.context.destination);
    this.oscillator.start();
  }

  update(throttle: number, speed: number): void {
    if (!this.context || !this.oscillator || !this.gain || !this.filter) return;
    const now = this.context.currentTime;
    this.oscillator.frequency.setTargetAtTime(36 + throttle * 62 + speed * 0.09, now, 0.08);
    this.filter.frequency.setTargetAtTime(140 + throttle * 520, now, 0.08);
    this.gain.gain.setTargetAtTime(this.volume * (0.012 + throttle * 0.045), now, 0.12);
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  destroy(): void {
    this.oscillator?.stop();
    void this.context?.close();
    this.context = null;
    this.oscillator = null;
    this.gain = null;
    this.filter = null;
  }
}
