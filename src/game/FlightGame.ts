import * as THREE from 'three';
import { getAirport } from '../data/airports';
import type { AircraftDefinition, AirportDefinition, CameraMode, RouteSelection, Settings } from '../types';
import { animateAircraftParts, createAircraft, disposeObject } from '../scene/aircraftFactory';
import { buildAirport, type ScenicWorld } from './AirportScene';
import { AirTrafficRadio } from './AirTrafficRadio';
import { EngineAudio } from './EngineAudio';
import { FlightPhysics, type FlightTelemetry } from './FlightPhysics';
import { InputController } from './InputController';

interface FlightGameOptions {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  aircraft: AircraftDefinition;
  route: RouteSelection;
  settings: Settings;
  onPause: () => void;
}

export class FlightGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.35, 16000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly model: THREE.Group;
  private readonly physics: FlightPhysics;
  private readonly input: InputController;
  private readonly audio: EngineAudio;
  private readonly radio: AirTrafficRadio;
  private readonly origin: AirportDefinition;
  private readonly destination: AirportDefinition;
  private readonly world: ScenicWorld;
  private readonly resizeObserver: ResizeObserver;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraLookAt = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private raf = 0;
  private lastTime = 0;
  private paused = false;
  private cameraIndex = 0;
  private hudAccumulator = 0;
  private arrived = false;
  private flightElapsed = 0;
  private touchdownSpeed = 0;
  private touchdownVerticalSpeed = 0;
  private radioMessageTimer = 0;
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

    this.origin = getAirport(options.route.originId);
    this.destination = getAirport(options.route.destinationId);
    this.world = buildAirport(this.scene, this.origin, this.destination);
    this.model = createAircraft(options.aircraft);
    this.scene.add(this.model);
    this.physics = new FlightPhysics(options.aircraft, options.settings.sensitivity, this.origin);
    this.input = new InputController(options.container);
    this.audio = new EngineAudio(options.settings.volume);
    this.radio = new AirTrafficRadio({
      aircraftName: options.aircraft.name,
      origin: this.origin,
      destination: this.destination,
      volume: options.settings.volume,
      onTransmission: (message) => this.showRadioTransmission(message),
      onSquelch: () => this.audio.playRadioSquelch(),
    });

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
    this.radio.setPaused(paused);
  }

  reset(): void {
    this.physics.reset();
    this.arrived = false;
    this.flightElapsed = 0;
    this.touchdownSpeed = 0;
    this.touchdownVerticalSpeed = 0;
    this.input.setMobileThrottle(0);
    this.radio.reset();
    this.options.container.querySelector('#flight-complete')?.classList.remove('is-visible');
    this.syncModel();
    this.updateHud();
    this.showStatus(`Aircraft reset at ${this.origin.code}`);
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
    window.clearTimeout(this.radioMessageTimer);
    this.input.destroy();
    this.audio.destroy();
    this.radio.destroy();
    disposeObject(this.scene);
    this.renderer.dispose();
  }

  private animate = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000 || 0, 0.04);
    this.lastTime = time;
    if (!this.paused) {
      const controls = this.input.update(this.physics.throttle);
      const wasOnGround = this.physics.onGround;
      const verticalSpeedBeforeUpdate = this.physics.velocity.y;
      this.physics.update(dt, controls);
      this.flightElapsed += dt;
      if (!wasOnGround && this.physics.onGround) {
        this.touchdownSpeed = this.physics.velocity.length();
        this.touchdownVerticalSpeed = Math.max(0, -verticalSpeedBeforeUpdate);
      }
      this.syncModel();
      animateAircraftParts(this.model, dt * (9 + this.physics.throttle * 64));
      this.world.destinationBeacon.rotation.y += dt * 0.28;
      this.world.destinationBeacon.position.y = Math.sin(time * 0.0015) * 7;
      this.world.cloudLayer.position.x = Math.sin(time * 0.00004) * 90;
      this.world.updateAmbientTraffic(time * 0.001);
      this.updateCamera(dt);
      this.audio.update(this.physics.throttle, this.physics.velocity.length());
      this.hudAccumulator += dt;
      if (this.hudAccumulator > 0.08) {
        this.hudAccumulator = 0;
        this.updateHud();
      }
      const radioTelemetry = this.physics.getTelemetry();
      this.radio.update({
        elapsed: this.flightElapsed,
        altitude: radioTelemetry.altitude,
        speed: radioTelemetry.speed,
        throttle: radioTelemetry.throttle,
        onGround: radioTelemetry.onGround,
        destinationDistance: Math.hypot(
          this.destination.x - this.physics.position.x,
          this.destination.z - this.physics.position.z,
        ),
        arrived: this.arrived,
      });
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
      const cockpit = this.options.aircraft.cockpitView;
      this.cameraPosition.set(...cockpit.position).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.cameraTarget.set(...cockpit.target).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.camera.fov = cockpit.fov;
    } else {
      this.cameraPosition.set(19, 5.2, 3.5).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.cameraTarget.set(0, 0.45, -1.5).applyQuaternion(this.physics.orientation).add(this.physics.position);
      this.camera.fov = 55;
    }
    this.camera.near = mode === 'COCKPIT' ? 0.08 : 0.35;
    this.model.visible = mode !== 'COCKPIT';
    this.options.container.classList.toggle('is-cockpit-view', mode === 'COCKPIT');
    this.camera.position.lerp(this.cameraPosition, smoothing);
    if (dt >= 1) this.cameraLookAt.copy(this.cameraTarget);
    else this.cameraLookAt.lerp(this.cameraTarget, smoothing);
    this.camera.lookAt(this.cameraLookAt);
    this.camera.updateProjectionMatrix();
  }

  private updateHud(): void {
    const telemetry = this.physics.getTelemetry();
    const deltaX = this.destination.x - this.physics.position.x;
    const deltaZ = this.destination.z - this.physics.position.z;
    const destinationDistance = Math.hypot(deltaX, deltaZ);
    const destinationBearing = ((THREE.MathUtils.radToDeg(Math.atan2(deltaX, -deltaZ)) % 360) + 360) % 360;
    const relativeBearing = ((((destinationBearing - telemetry.heading) % 360) + 540) % 360) - 180;
    const destinationHeading = THREE.MathUtils.degToRad(this.destination.heading);
    const localX = -deltaX * Math.cos(destinationHeading) + deltaZ * Math.sin(destinationHeading);
    const localZ = -deltaX * Math.sin(destinationHeading) - deltaZ * Math.cos(destinationHeading);
    const insideDestinationAirfield = Math.abs(localX) < 230 && Math.abs(localZ) < 860;
    const wasArrived = this.arrived;
    const justArrived = insideDestinationAirfield && telemetry.onGround && telemetry.speed < 14;
    this.arrived ||= justArrived;
    this.setText('#hud-speed', String(Math.round(telemetry.speed * 3.6)));
    this.setText('#hud-altitude', String(Math.round(telemetry.altitude)));
    this.setText('#hud-heading', String(Math.round(telemetry.heading)).padStart(3, '0'));
    this.setText('#hud-throttle', `${Math.round(telemetry.throttle * 100)}%`);
    this.setText('#hud-vspeed', `${telemetry.verticalSpeed >= 0 ? '+' : ''}${telemetry.verticalSpeed.toFixed(1)}`);
    this.setText('#hud-gforce', `${telemetry.gForce.toFixed(1)} G`);
    this.setText('#camera-label', this.cameraModes[this.cameraIndex]);
    this.setText('#destination-code', this.destination.code);
    this.setText('#destination-distance', `${(destinationDistance / 1000).toFixed(1)} KM`);
    this.setText('#destination-bearing', `${String(Math.round(destinationBearing)).padStart(3, '0')}°`);
    this.drawNavigationDisplay(telemetry, destinationDistance, relativeBearing);
    const flightPhase = this.arrived
      ? 'COMPLETE'
      : insideDestinationAirfield && telemetry.onGround
        ? 'BRAKING'
        : destinationDistance < 1700
          ? 'APPROACH'
          : telemetry.onGround
            ? telemetry.speed > 2
              ? 'GROUND ROLL'
              : 'READY'
            : 'AIRBORNE';
    this.setText('#flight-phase', flightPhase);
    this.updateFlightCoach(telemetry, destinationDistance, insideDestinationAirfield);

    const throttleFill = this.options.container.querySelector<HTMLElement>('#throttle-fill');
    if (throttleFill) throttleFill.style.height = `${telemetry.throttle * 100}%`;
    const compass = this.options.container.querySelector<HTMLElement>('#compass-tape');
    if (compass) compass.style.transform = `translateX(calc(-50% + ${-telemetry.heading * 1.15}px))`;
    const stall = this.options.container.querySelector<HTMLElement>('#stall-warning');
    stall?.classList.toggle('is-visible', telemetry.stall);
    const pointer = this.options.container.querySelector<HTMLElement>('#destination-pointer');
    if (pointer) pointer.style.transform = `rotate(${THREE.MathUtils.clamp(relativeBearing, -110, 110)}deg)`;
    const routePanel = this.options.container.querySelector<HTMLElement>('.route-guidance');
    routePanel?.classList.toggle('is-near', destinationDistance < 1700);
    routePanel?.classList.toggle('is-arrived', this.arrived);
    if (!wasArrived && this.arrived) this.completeFlight(telemetry);
  }

  private completeFlight(telemetry: FlightTelemetry): void {
    const landingSpeed = this.touchdownSpeed || telemetry.speed;
    const headingDifference = Math.abs((((telemetry.heading - this.destination.heading) % 360) + 540) % 360 - 180);
    const runwayAlignment = Math.min(headingDifference, Math.abs(180 - headingDifference));
    const grade =
      this.touchdownVerticalSpeed < 1.8 && runwayAlignment < 8
        ? 'S'
        : this.touchdownVerticalSpeed < 3 && runwayAlignment < 15
          ? 'A'
          : this.touchdownVerticalSpeed < 4.8
            ? 'B'
            : 'C';
    this.setText('#complete-time', formatElapsedTime(this.flightElapsed));
    this.setText('#complete-landing-speed', `${Math.round(landingSpeed * 3.6)} KM/H`);
    this.setText('#complete-heading', `${String(Math.round(telemetry.heading)).padStart(3, '0')}°`);
    this.setText('#complete-grade', grade);
    this.options.container.querySelector('#flight-complete')?.classList.add('is-visible');
    this.audio.update(0, 0);
    this.radio.announceArrival(this.flightElapsed);
    this.setPaused(true);
  }

  private updateFlightCoach(
    telemetry: FlightTelemetry,
    destinationDistance: number,
    insideDestinationAirfield: boolean,
  ): void {
    let title = 'READY FOR DEPARTURE';
    let instruction = 'Advance throttle smoothly to 100% and keep the aircraft centered.';
    if (insideDestinationAirfield && telemetry.onGround) {
      title = 'LANDING ROLL';
      instruction = 'Hold SPACE or BRAKE, reduce throttle, and slow below 50 KM/H.';
    } else if (telemetry.onGround && telemetry.speed > this.options.aircraft.rotateSpeed * 0.82) {
      title = 'ROTATE';
      instruction = 'Hold Pitch Up gently to lift off without stalling.';
    } else if (telemetry.onGround && telemetry.speed > 2) {
      title = 'BUILD AIRSPEED';
      instruction = `Accelerate toward ${Math.round(this.options.aircraft.rotateSpeed * 3.6)} KM/H and steer with A / D.`;
    } else if (!telemetry.onGround && telemetry.altitude < 120) {
      title = 'INITIAL CLIMB';
      instruction = 'Climb smoothly, keep the wings level, and follow the orange route pointer.';
    } else if (destinationDistance < 1700) {
      title = 'FINAL APPROACH';
      instruction = 'Reduce throttle, align with the runway, and flare gently before touchdown.';
    } else if (!telemetry.onGround) {
      title = `NAVIGATE TO ${this.destination.code}`;
      instruction = 'Use the radar and bearing pointer; begin a gradual descent before the airport.';
    }
    this.setText('#coach-title', title);
    this.setText('#coach-text', instruction);
    this.options.container.querySelector('#flight-coach')?.classList.toggle('is-complete', this.arrived);
  }

  private drawNavigationDisplay(telemetry: FlightTelemetry, destinationDistance: number, relativeBearing: number): void {
    const canvas = this.options.container.querySelector<HTMLCanvasElement>('#nav-radar');
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.41;
    const radarRangeKm = destinationDistance > 12000 ? 20 : destinationDistance > 6000 ? 10 : destinationDistance > 3000 ? 5 : destinationDistance > 1200 ? 2 : 1;
    const radarRangeMeters = radarRangeKm * 1000;
    const sweep = (performance.now() * 0.00048) % (Math.PI * 2);
    context.fillStyle = '#041218';
    context.fillRect(0, 0, width, height);

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();
    const background = context.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius);
    background.addColorStop(0, 'rgba(19, 76, 66, 0.55)');
    background.addColorStop(0.66, 'rgba(5, 31, 31, 0.92)');
    background.addColorStop(1, 'rgba(2, 14, 18, 0.98)');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(92, 230, 195, 0.2)';
    context.lineWidth = 1;
    [0.33, 0.66, 1].forEach((ring) => {
      context.beginPath();
      context.arc(centerX, centerY, radius * ring, 0, Math.PI * 2);
      context.stroke();
    });
    for (let degrees = 0; degrees < 360; degrees += 30) {
      const angle = THREE.MathUtils.degToRad(degrees);
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(centerX + Math.sin(angle) * radius, centerY - Math.cos(angle) * radius);
      context.stroke();
    }

    context.fillStyle = 'rgba(75, 234, 194, 0.13)';
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, radius, sweep - 0.42, sweep + 0.02);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(99, 255, 212, 0.64)';
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(sweep) * radius, centerY + Math.sin(sweep) * radius);
    context.stroke();

    const waypointPosition = (airport: AirportDefinition): { x: number; y: number; distance: number; edge: boolean } => {
      const deltaX = airport.x - this.physics.position.x;
      const deltaZ = airport.z - this.physics.position.z;
      const distance = Math.hypot(deltaX, deltaZ);
      const bearing = ((THREE.MathUtils.radToDeg(Math.atan2(deltaX, -deltaZ)) % 360) + 360) % 360;
      const relative = ((((bearing - telemetry.heading) % 360) + 540) % 360) - 180;
      const angle = THREE.MathUtils.degToRad(relative);
      const normalizedDistance = Math.min(0.92, distance / radarRangeMeters);
      return {
        x: centerX + Math.sin(angle) * radius * normalizedDistance,
        y: centerY - Math.cos(angle) * radius * normalizedDistance,
        distance,
        edge: distance > radarRangeMeters,
      };
    };

    const originPoint = waypointPosition(this.origin);
    const destinationPoint = waypointPosition(this.destination);
    context.setLineDash([5, 4]);
    context.strokeStyle = 'rgba(247, 177, 64, 0.62)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(destinationPoint.x, destinationPoint.y);
    context.stroke();
    context.setLineDash([]);

    const drawAirport = (airport: AirportDefinition, point: ReturnType<typeof waypointPosition>, color: string): void => {
      const runwayAngle = THREE.MathUtils.degToRad(airport.heading - telemetry.heading);
      const runwayLength = point.edge ? 5 : 9;
      context.save();
      context.translate(point.x, point.y);
      context.rotate(runwayAngle);
      context.strokeStyle = color;
      context.lineWidth = 2.3;
      context.beginPath();
      context.moveTo(0, -runwayLength);
      context.lineTo(0, runwayLength);
      context.stroke();
      context.restore();
      context.fillStyle = color;
      context.font = '700 12px sans-serif';
      context.textAlign = point.x > centerX ? 'right' : 'left';
      context.fillText(airport.code, point.x + (point.x > centerX ? -6 : 6), point.y - 6);
    };
    if (originPoint.distance < radarRangeMeters * 1.1) drawAirport(this.origin, originPoint, 'rgba(119, 188, 202, 0.88)');
    drawAirport(this.destination, destinationPoint, '#ffb548');

    context.fillStyle = '#ecfbf7';
    context.strokeStyle = '#ecfbf7';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(centerX, centerY - 10);
    context.lineTo(centerX - 5, centerY + 6);
    context.lineTo(centerX, centerY + 3);
    context.lineTo(centerX + 5, centerY + 6);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(centerX - 11, centerY + 1);
    context.lineTo(centerX + 11, centerY + 1);
    context.stroke();

    context.fillStyle = 'rgba(218, 249, 242, 0.82)';
    context.font = '600 10px sans-serif';
    context.textAlign = 'center';
    const compassLabels: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let degrees = 0; degrees < 360; degrees += 30) {
      const relative = THREE.MathUtils.degToRad(degrees - telemetry.heading);
      const labelRadius = radius - 10;
      const label = compassLabels[degrees] ?? String(degrees / 10).padStart(2, '0');
      context.fillText(label, centerX + Math.sin(relative) * labelRadius, centerY - Math.cos(relative) * labelRadius + 3);
    }
    context.restore();

    context.strokeStyle = 'rgba(117, 241, 211, 0.7)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#ffb548';
    context.beginPath();
    context.moveTo(centerX, centerY - radius - 2);
    context.lineTo(centerX - 5, centerY - radius - 10);
    context.lineTo(centerX + 5, centerY - radius - 10);
    context.closePath();
    context.fill();

    const etaMinutes = telemetry.speed > 12 ? destinationDistance / telemetry.speed / 60 : Number.POSITIVE_INFINITY;
    this.setText('#radar-range', `RNG ${radarRangeKm} KM`);
    this.setText('#radar-dme', `DME ${(destinationDistance / 1000).toFixed(1)}`);
    this.setText('#radar-eta', Number.isFinite(etaMinutes) ? `ETA ${Math.max(1, Math.round(etaMinutes))}M` : 'ETA --');
    canvas.setAttribute(
      'aria-label',
      `${this.destination.code} navigation display, ${(destinationDistance / 1000).toFixed(1)} kilometers, ${Math.round(relativeBearing)} degrees relative bearing`,
    );
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

  private showRadioTransmission(message: string): void {
    this.setText('#radio-text', message);
    const element = this.options.container.querySelector<HTMLElement>('#radio-message');
    if (!element) return;
    element.classList.add('is-visible');
    window.clearTimeout(this.radioMessageTimer);
    this.radioMessageTimer = window.setTimeout(() => element.classList.remove('is-visible'), 5200);
  }

  private resize(): void {
    const width = Math.max(1, this.options.canvas.clientWidth);
    const height = Math.max(1, this.options.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
