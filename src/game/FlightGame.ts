import * as THREE from 'three';
import type { AircraftDefinition, CameraMode, Settings } from '../types';
import { animateAircraftParts, createAircraft, disposeObject } from '../scene/aircraftFactory';
import { buildAirport } from './AirportScene';
import { EngineAudio } from './EngineAudio';
import { FlightPhysics } from './FlightPhysics';
import { InputController } from './InputController';

interface FlightGameOptions {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  aircraft: AircraftDefinition;
  settings: Settings;
  onPause: () => void;
}

export class FlightGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.12, 7000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly model: THREE.Group;
  private readonly physics: FlightPhysics;
  private readonly input: InputController;
  private readonly audio: EngineAudio;
  private readonly resizeObserver: ResizeObserver;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private raf = 0;
  private lastTime = 0;
  private paused = false;
  private cameraIndex = 0;
  private hudAccumulator = 0;
  private readonly cameraModes: CameraMode[] = ['CHASE', 'COCKPIT', 'SIDE'];
  private readonly keyHandler: (event: KeyboardEvent) => void;

  constructor(private readonly options: FlightGameOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.6));
    this.renderer.setSize(options.canvas.clientWidth, options.canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    buildAirport(this.scene);
    this.model = createAircraft(options.aircraft);
    this.scene.add(this.model);
    this.physics = new FlightPhysics(options.aircraft, options.settings.sensitivity);
    this.input = new InputController(options.container);
    this.audio = new EngineAudio(options.settings.volume);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.canvas);
    this.keyHandler = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (event.code === 'KeyC') this.changeCamera();
      if (event.code === 'KeyR') this.reset();
      if (event.code === 'Escape' || event.code === 'KeyP') options.onPause();
    };
    window.addEventListener('keydown', this.keyHandler);

    this.syncModel();
    this.updateCamera(1);
    this.updateHud();
    this.raf = requestAnimationFrame(this.animate);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastTime = performance.now();
    if (!paused) this.audio.start();
  }

  reset(): void {
    this.physics.reset();
    this.input.setMobileThrottle(0);
    this.syncModel();
    this.updateHud();
    this.showStatus('Aircraft reset on runway 18');
  }

  changeCamera(): void {
    this.cameraIndex = (this.cameraIndex + 1) % this.cameraModes.length;
    this.updateCamera(1);
    this.showStatus(`${this.cameraModes[this.cameraIndex].toLowerCase()} camera`);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keyHandler);
    this.input.destroy();
    this.audio.destroy();
    disposeObject(this.model);
    this.renderer.dispose();
  }

  private animate = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000 || 0, 0.04);
    this.lastTime = time;
    if (!this.paused) {
      const controls = this.input.update(this.physics.throttle);
      this.physics.update(dt, controls);
      this.syncModel();
      animateAircraftParts(this.model, dt * (9 + this.physics.throttle * 64));
      this.updateCamera(dt);
      this.audio.update(this.physics.throttle, this.physics.velocity.length());
      this.hudAccumulator += dt;
      if (this.hudAccumulator > 0.08) {
        this.hudAccumulator = 0;
        this.updateHud();
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.animate);
  };

  private syncModel(): void {
    this.model.position.copy(this.physics.position);
    this.model.quaternion.copy(this.physics.orientation);
  }

  private updateCamera(dt: number): void {
    const mode = this.cameraModes[this.cameraIndex];
    const smoothing = dt >= 1 ? 1 : 1 - Math.pow(0.0008, dt);
    if (mode === 'CHASE') {
      this.cameraPosition.set(0, 5.2, 17.5).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.cameraTarget.set(0, 1.15, -9).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.camera.fov = 58 + Math.min(8, this.physics.velocity.length() * 0.055);
    } else if (mode === 'COCKPIT') {
      this.cameraPosition.set(0, 0.8, -3.1).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.cameraTarget.set(0, 0.55, -90).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.camera.fov = 67;
    } else {
      this.cameraPosition.set(19, 5.2, 3.5).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.cameraTarget.set(0, 0.45, -1.5).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.camera.fov = 55;
    }
    this.camera.position.lerp(this.cameraPosition, smoothing);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  }

  private updateHud(): void {
    const telemetry = this.physics.getTelemetry();
    this.setText('#hud-speed', String(Math.round(telemetry.speed * 3.6)));
    this.setText('#hud-altitude', String(Math.round(telemetry.altitude)));
    this.setText('#hud-heading', String(Math.round(telemetry.heading)).padStart(3, '0'));
    this.setText('#hud-throttle', `${Math.round(telemetry.throttle * 100)}%`);
    this.setText('#hud-vspeed', `${telemetry.verticalSpeed >= 0 ? '+' : ''}${telemetry.verticalSpeed.toFixed(1)}`);
    this.setText('#hud-gforce', `${telemetry.gForce.toFixed(1)} G`);
    this.setText('#camera-label', this.cameraModes[this.cameraIndex]);
    this.setText('#flight-phase', telemetry.onGround ? (telemetry.speed > 2 ? 'GROUND ROLL' : 'READY') : 'AIRBORNE');

    const throttleFill = this.options.container.querySelector<HTMLElement>('#throttle-fill');
    if (throttleFill) throttleFill.style.height = `${telemetry.throttle * 100}%`;
    const compass = this.options.container.querySelector<HTMLElement>('#compass-tape');
    if (compass) compass.style.transform = `translateX(calc(-50% + ${-telemetry.heading * 1.15}px))`;
    const stall = this.options.container.querySelector<HTMLElement>('#stall-warning');
    stall?.classList.toggle('is-visible', telemetry.stall);
  }

  private setText(selector: string, value: string): void {
    const element = this.options.container.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  }

  private showStatus(message: string): void {
    const element = this.options.container.querySelector<HTMLElement>('#flight-toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-visible');
    window.setTimeout(() => element.classList.remove('is-visible'), 1800);
  }

  private resize(): void {
    const width = Math.max(1, this.options.canvas.clientWidth);
    const height = Math.max(1, this.options.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
