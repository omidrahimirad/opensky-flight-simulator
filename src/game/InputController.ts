import type { ControlState } from '../types';

export class InputController {
  readonly state: ControlState = {
    throttleDelta: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    brake: false,
  };

  private readonly keys = new Set<string>();
  private mobilePitch = 0;
  private mobileRoll = 0;
  private mobileYaw = 0;
  private mobileThrottle = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly container: HTMLElement) {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      this.keys.delete(event.code);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    this.cleanups.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
    );
    this.bindMobileControls();
  }

  update(currentThrottle: number): ControlState {
    this.state.throttleDelta = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    this.state.pitch =
      (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0) + this.mobilePitch;
    this.state.roll =
      (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0) + this.mobileRoll;
    this.state.yaw = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.mobileYaw;
    this.state.brake = this.keys.has('Space') || this.container.querySelector('[data-control="brake"].is-pressed') !== null;

    const throttleInput = this.container.querySelector<HTMLInputElement>('#mobile-throttle');
    if (throttleInput && Math.abs(Number(throttleInput.value) - this.mobileThrottle) > 0.001) {
      this.mobileThrottle = Number(throttleInput.value);
    }
    if (throttleInput && (matchMedia('(pointer: coarse)').matches || window.innerWidth <= 760)) {
      this.state.throttleDelta = THREEClamp((this.mobileThrottle - currentThrottle) * 6, -1, 1);
    }
    if (this.state.brake) {
      this.state.throttleDelta = -1;
      this.mobileThrottle = 0;
      if (throttleInput) throttleInput.value = '0';
    }
    this.state.pitch = THREEClamp(this.state.pitch, -1, 1);
    this.state.roll = THREEClamp(this.state.roll, -1, 1);
    this.state.yaw = THREEClamp(this.state.yaw, -1, 1);
    return this.state;
  }

  setMobileThrottle(value: number): void {
    this.mobileThrottle = value;
    const input = this.container.querySelector<HTMLInputElement>('#mobile-throttle');
    if (input) input.value = String(value);
  }

  destroy(): void {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups.length = 0;
  }

  private bindMobileControls(): void {
    const bindHold = (selector: string, setter: (value: number) => void, value: number): void => {
      this.container.querySelectorAll<HTMLElement>(selector).forEach((button) => {
        const press = (event: PointerEvent): void => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          button.classList.add('is-pressed');
          setter(value);
        };
        const release = (event: PointerEvent): void => {
          event.preventDefault();
          button.classList.remove('is-pressed');
          setter(0);
        };
        button.addEventListener('pointerdown', press);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        this.cleanups.push(
          () => button.removeEventListener('pointerdown', press),
          () => button.removeEventListener('pointerup', release),
          () => button.removeEventListener('pointercancel', release),
        );
      });
    };
    bindHold('[data-control="pitch-up"]', (value) => (this.mobilePitch = value), 1);
    bindHold('[data-control="pitch-down"]', (value) => (this.mobilePitch = value), -1);
    bindHold('[data-control="roll-left"]', (value) => (this.mobileRoll = value), -1);
    bindHold('[data-control="roll-right"]', (value) => (this.mobileRoll = value), 1);
    bindHold('[data-control="yaw-left"]', (value) => (this.mobileYaw = value), -1);
    bindHold('[data-control="yaw-right"]', (value) => (this.mobileYaw = value), 1);

    const brake = this.container.querySelector<HTMLElement>('[data-control="brake"]');
    if (brake) {
      const press = (event: PointerEvent): void => {
        event.preventDefault();
        brake.setPointerCapture(event.pointerId);
        brake.classList.add('is-pressed');
      };
      const release = (): void => brake.classList.remove('is-pressed');
      brake.addEventListener('pointerdown', press);
      brake.addEventListener('pointerup', release);
      brake.addEventListener('pointercancel', release);
      this.cleanups.push(
        () => brake.removeEventListener('pointerdown', press),
        () => brake.removeEventListener('pointerup', release),
        () => brake.removeEventListener('pointercancel', release),
      );
    }
  }
}

function THREEClamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
