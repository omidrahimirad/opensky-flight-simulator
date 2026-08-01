import { DEFAULT_ROUTE } from './data/airports';
import type { AircraftId, AirportId, RouteSelection, Settings } from './types';

const AIRCRAFT_KEY = 'opensky-selected-aircraft';
const SETTINGS_KEY = 'opensky-settings';
const ROUTE_KEY = 'opensky-route';

export function loadSelectedAircraft(): AircraftId | null {
  const value = localStorage.getItem(AIRCRAFT_KEY);
  return value === 'skylark' || value === 'horizon' || value === 'swift' ? value : null;
}

export function saveSelectedAircraft(id: AircraftId): void {
  localStorage.setItem(AIRCRAFT_KEY, id);
}

export function loadRoute(): RouteSelection {
  try {
    const saved = JSON.parse(localStorage.getItem(ROUTE_KEY) ?? '{}') as Partial<RouteSelection>;
    if (isAirportId(saved.originId) && isAirportId(saved.destinationId) && saved.originId !== saved.destinationId) {
      return { originId: saved.originId, destinationId: saved.destinationId };
    }
  } catch {
    // Fall through to the default route when stored data is malformed.
  }
  return { ...DEFAULT_ROUTE };
}

export function saveRoute(route: RouteSelection): void {
  localStorage.setItem(ROUTE_KEY, JSON.stringify(route));
}

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
    return {
      sensitivity: clamp(saved.sensitivity ?? 1, 0.55, 1.6),
      volume: clamp(saved.volume ?? 0.45, 0, 1),
    };
  } catch {
    return { sensitivity: 1, volume: 0.45 };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function isAirportId(value: unknown): value is AirportId {
  return value === 'alpine' || value === 'coast' || value === 'pine' || value === 'mesa';
}
