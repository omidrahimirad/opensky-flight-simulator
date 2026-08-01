export type AircraftId = 'skylark' | 'horizon' | 'swift';
export type AirportId = 'alpine' | 'coast' | 'pine' | 'mesa';

export interface AirportDefinition {
  id: AirportId;
  code: string;
  name: string;
  region: string;
  x: number;
  z: number;
  heading: number;
  accent: number;
  climate: 'alpine' | 'coast' | 'forest' | 'desert';
}

export interface RouteSelection {
  originId: AirportId;
  destinationId: AirportId;
}

export interface AircraftDefinition {
  id: AircraftId;
  name: string;
  type: string;
  tagline: string;
  accent: number;
  accentCss: string;
  mass: number;
  wingArea: number;
  maxThrust: number;
  drag: number;
  stallSpeed: number;
  rotateSpeed: number;
  topSpeed: number;
  range: number;
  seats: number;
  scale: number;
  gearHeight: number;
  cockpitView: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
}

export interface Settings {
  sensitivity: number;
  volume: number;
}

export type CameraMode = 'CHASE' | 'COCKPIT' | 'SIDE';

export interface ControlState {
  throttleDelta: number;
  pitch: number;
  roll: number;
  yaw: number;
  brake: boolean;
}
