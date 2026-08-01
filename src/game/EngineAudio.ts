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

  playRadioSquelch(): void {
    if (!this.context || this.volume <= 0.01) return;
    const duration = 0.12;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 1850;
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume * 0.055), this.context.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start();
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
