import type { AirportDefinition, FlightRadioTelemetry } from '../types';

interface AirTrafficRadioOptions {
  aircraftName: string;
  origin: AirportDefinition;
  destination: AirportDefinition;
  volume: number;
  onTransmission: (message: string) => void;
  onSquelch: () => void;
}

export class AirTrafficRadio {
  private stage = 0;
  private paused = true;
  private lastTransmission = Number.NEGATIVE_INFINITY;
  private nextTrafficCall = 32;

  constructor(private readonly options: AirTrafficRadioOptions) {}

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  reset(): void {
    this.stage = 0;
    this.lastTransmission = Number.NEGATIVE_INFINITY;
    this.nextTrafficCall = 32;
    window.speechSynthesis?.cancel();
  }

  update(telemetry: FlightRadioTelemetry): void {
    if (this.paused) return;
    const ready = telemetry.elapsed - this.lastTransmission > 6;
    if (this.stage === 0 && telemetry.elapsed > 1.2) {
      this.transmit(
        `${this.options.aircraftName}, ${this.options.origin.code} ground. Taxi to the active runway. Wind calm.`,
        telemetry.elapsed,
      );
      this.stage = 1;
      return;
    }
    if (this.stage === 1 && ready && telemetry.onGround && telemetry.throttle > 0.55 && telemetry.speed > 4) {
      this.transmit(`${this.options.aircraftName}, cleared for takeoff. Have a good flight.`, telemetry.elapsed);
      this.stage = 2;
      return;
    }
    if (this.stage <= 2 && ready && !telemetry.onGround && telemetry.altitude > 24) {
      this.transmit(
        `${this.options.aircraftName}, radar contact. Proceed direct ${this.options.destination.code}.`,
        telemetry.elapsed,
      );
      this.stage = 3;
      return;
    }
    if (this.stage <= 3 && ready && !telemetry.onGround && telemetry.destinationDistance < 1800) {
      this.transmit(
        `${this.options.aircraftName}, ${this.options.destination.code} tower. Continue approach. Runway is clear.`,
        telemetry.elapsed,
      );
      this.stage = 4;
      return;
    }
    if (this.stage <= 4 && ready && telemetry.arrived) {
      this.transmit(
        `${this.options.aircraftName}, welcome to ${this.options.destination.name}. Vacate the runway when able.`,
        telemetry.elapsed,
      );
      this.stage = 5;
      return;
    }
    if (ready && telemetry.elapsed > this.nextTrafficCall && this.stage > 1 && this.stage < 5) {
      const side = Math.floor(telemetry.elapsed / 32) % 2 === 0 ? 'your left' : 'your right';
      this.transmit(`Traffic advisory. Light aircraft reported two miles off ${side}. Maintain visual separation.`, telemetry.elapsed);
      this.nextTrafficCall = telemetry.elapsed + 38;
    }
  }

  announceArrival(elapsed: number): void {
    if (this.stage >= 5) return;
    this.transmit(
      `${this.options.aircraftName}, welcome to ${this.options.destination.name}. Vacate the runway when able.`,
      elapsed,
    );
    this.stage = 5;
  }

  destroy(): void {
    window.speechSynthesis?.cancel();
  }

  private transmit(message: string, elapsed: number): void {
    this.lastTransmission = elapsed;
    this.options.onTransmission(message);
    this.options.onSquelch();
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window) || this.options.volume <= 0.01) return;
    const utterance = new SpeechSynthesisUtterance(message);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? null;
    utterance.lang = 'en-US';
    utterance.rate = 1.08;
    utterance.pitch = 0.82;
    utterance.volume = Math.min(1, this.options.volume * 0.78);
    utterance.onend = () => {
      this.options.onSquelch();
    };
    window.speechSynthesis.speak(utterance);
  }
}
