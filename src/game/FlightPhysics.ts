import * as THREE from 'three';
import type { AircraftDefinition, AirportDefinition, ControlState } from '../types';

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const AIR_DENSITY = 1.18;

export interface FlightTelemetry {
  altitude: number;
  speed: number;
  verticalSpeed: number;
  heading: number;
  throttle: number;
  stall: boolean;
  onGround: boolean;
  gForce: number;
}

export class FlightPhysics {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly orientation = new THREE.Quaternion();
  throttle = 0;
  onGround = true;
  stall = false;
  private yaw = 0;
  private pitch = 0;
  private roll = 0;
  private lastVerticalAcceleration = 0;

  constructor(
    readonly definition: AircraftDefinition,
    private readonly sensitivity: number,
    private readonly origin: AirportDefinition,
  ) {
    this.reset();
  }

  reset(): void {
    this.yaw = -THREE.MathUtils.degToRad(this.origin.heading);
    const runwayForward = FORWARD.clone().applyAxisAngle(UP, this.yaw);
    this.position.set(
      this.origin.x - runwayForward.x * 680,
      this.definition.gearHeight * this.definition.scale,
      this.origin.z - runwayForward.z * 680,
    );
    this.velocity.set(0, 0, 0);
    this.orientation.setFromEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    this.throttle = 0;
    this.onGround = true;
    this.stall = false;
    this.pitch = 0;
    this.roll = 0;
  }

  update(dt: number, controls: ControlState): void {
    const step = Math.min(dt, 0.033);
    this.throttle = THREE.MathUtils.clamp(this.throttle + controls.throttleDelta * step * 0.34, 0, 1);

    if (this.onGround) {
      this.updateGround(step, controls);
    } else {
      this.updateAir(step, controls);
    }
    this.position.addScaledVector(this.velocity, step);
    this.resolveGroundContact();
  }

  getTelemetry(): FlightTelemetry {
    const heading = ((THREE.MathUtils.radToDeg(-this.yaw) % 360) + 360) % 360;
    return {
      altitude: Math.max(0, this.position.y - this.definition.gearHeight * this.definition.scale),
      speed: this.velocity.length(),
      verticalSpeed: this.velocity.y,
      heading,
      throttle: this.throttle,
      stall: this.stall,
      onGround: this.onGround,
      gForce: THREE.MathUtils.clamp(1 + this.lastVerticalAcceleration / 9.81, -1, 4.5),
    };
  }

  private updateGround(dt: number, controls: ControlState): void {
    const forward = FORWARD.clone().applyQuaternion(this.orientation);
    forward.y = 0;
    forward.normalize();
    const speed = Math.max(0, this.velocity.dot(forward));
    const steeringAuthority = THREE.MathUtils.clamp(0.32 + speed / 35, 0.32, 1);
    this.yaw += controls.yaw * 0.62 * this.sensitivity * steeringAuthority * dt;

    if (speed > this.definition.rotateSpeed * 0.72) {
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + controls.pitch * 0.5 * this.sensitivity * dt,
        -0.04,
        THREE.MathUtils.degToRad(13),
      );
    } else {
      this.pitch *= Math.pow(0.15, dt);
    }
    this.roll *= Math.pow(0.04, dt);
    this.orientation.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'));

    const thrustAcceleration = (this.definition.maxThrust * this.throttle) / this.definition.mass;
    const rollingResistance = 0.16 + speed * speed * this.definition.drag * 0.00024;
    const brakeAcceleration = controls.brake ? 8.5 : 0;
    const nextSpeed = Math.max(0, speed + (thrustAcceleration - rollingResistance - brakeAcceleration) * dt);
    this.velocity.copy(FORWARD).applyQuaternion(this.orientation);
    this.velocity.y = 0;
    this.velocity.normalize().multiplyScalar(nextSpeed);

    const liftRatio = this.calculateLift(nextSpeed) / (this.definition.mass * 9.81);
    if (this.pitch > 0.045 && nextSpeed > this.definition.rotateSpeed * 0.82 && liftRatio > 0.76) {
      this.onGround = false;
      this.velocity.y = Math.max(1.4, Math.sin(this.pitch) * nextSpeed * 0.45);
    }
    this.stall = false;
    this.lastVerticalAcceleration = 0;
  }

  private updateAir(dt: number, controls: ControlState): void {
    const speed = this.velocity.length();
    const authority = THREE.MathUtils.clamp(speed / this.definition.stallSpeed, 0.18, 1.2);
    const pitchRate = controls.pitch * 0.62 * this.sensitivity * authority;
    const rollRate = -controls.roll * 0.92 * this.sensitivity * authority;
    const yawRate = controls.yaw * 0.32 * this.sensitivity * authority;

    const rotationDelta = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitchRate * dt, yawRate * dt, rollRate * dt, 'XYZ'),
    );
    this.orientation.multiply(rotationDelta).normalize();

    const forward = FORWARD.clone().applyQuaternion(this.orientation).normalize();
    const aircraftUp = UP.clone().applyQuaternion(this.orientation).normalize();
    const thrust = forward.multiplyScalar(this.definition.maxThrust * this.throttle);
    const gravity = new THREE.Vector3(0, -this.definition.mass * 9.81, 0);

    const localVelocity = this.velocity.clone().applyQuaternion(this.orientation.clone().invert());
    const angleOfAttack = Math.atan2(-localVelocity.y, Math.max(0.1, -localVelocity.z));
    const liftCoefficient = THREE.MathUtils.clamp(0.24 + angleOfAttack * 4.2, -0.65, 1.42);
    const stallFactor = THREE.MathUtils.smoothstep(speed, this.definition.stallSpeed * 0.58, this.definition.stallSpeed);
    this.stall = speed < this.definition.stallSpeed * 0.92 && this.position.y > 4;
    const dynamicPressure = 0.5 * AIR_DENSITY * speed * speed;
    const liftMagnitude = dynamicPressure * this.definition.wingArea * liftCoefficient * stallFactor;

    const velocityDirection = speed > 0.1 ? this.velocity.clone().normalize() : forward.clone();
    const liftDirection = aircraftUp.addScaledVector(velocityDirection, -aircraftUp.dot(velocityDirection)).normalize();
    const lift = liftDirection.multiplyScalar(liftMagnitude);
    const dragCoefficient = this.definition.drag * (0.034 + Math.abs(angleOfAttack) * 0.12);
    const drag = velocityDirection.multiplyScalar(-dynamicPressure * this.definition.wingArea * dragCoefficient);

    const totalForce = thrust.add(gravity).add(lift).add(drag);
    const acceleration = totalForce.multiplyScalar(1 / this.definition.mass);
    this.lastVerticalAcceleration = acceleration.y;
    this.velocity.addScaledVector(acceleration, dt);

    if (this.stall) {
      const noseDrop = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.22 * dt);
      this.orientation.multiply(noseDrop).normalize();
    }

    const euler = new THREE.Euler().setFromQuaternion(this.orientation, 'YXZ');
    this.pitch = euler.x;
    this.yaw = euler.y;
    this.roll = euler.z;
  }

  private calculateLift(speed: number): number {
    const angleOfAttack = Math.max(0, this.pitch);
    const coefficient = THREE.MathUtils.clamp(0.24 + angleOfAttack * 4.2, 0.24, 1.42);
    return 0.5 * AIR_DENSITY * speed * speed * this.definition.wingArea * coefficient;
  }

  private resolveGroundContact(): void {
    const floor = this.definition.gearHeight * this.definition.scale;
    if (this.position.y > floor || this.velocity.y > 0) return;
    const landingSpeed = -this.velocity.y;
    this.position.y = floor;
    this.velocity.y = 0;
    this.onGround = true;

    const euler = new THREE.Euler().setFromQuaternion(this.orientation, 'YXZ');
    this.yaw = euler.y;
    this.pitch = landingSpeed > 8 ? 0 : THREE.MathUtils.clamp(euler.x, -0.03, 0.09);
    this.roll = 0;
    this.orientation.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
}
