import type { AirportDefinition, AirportId, RouteSelection } from '../types';

export const AIRPORTS: AirportDefinition[] = [
  {
    id: 'alpine',
    code: 'ALP',
    name: 'Alpine Gateway',
    region: 'Emerald Valley',
    x: 0,
    z: 0,
    heading: 0,
    accent: 0x33c7b7,
    climate: 'alpine',
  },
  {
    id: 'coast',
    code: 'CBY',
    name: 'Coastline Bay',
    region: 'Azure Coast',
    x: 5200,
    z: -4200,
    heading: 0,
    accent: 0x48a8e8,
    climate: 'coast',
  },
  {
    id: 'pine',
    code: 'PNR',
    name: 'Pine Ridge',
    region: 'Northern Highlands',
    x: -4300,
    z: -5600,
    heading: 0,
    accent: 0x73c878,
    climate: 'forest',
  },
  {
    id: 'mesa',
    code: 'DMS',
    name: 'Desert Mesa',
    region: 'Copper Basin',
    x: 4700,
    z: 4700,
    heading: 0,
    accent: 0xf2a052,
    climate: 'desert',
  },
];

export const DEFAULT_ROUTE: RouteSelection = { originId: 'alpine', destinationId: 'coast' };

export function getAirport(id: AirportId): AirportDefinition {
  return AIRPORTS.find((airport) => airport.id === id) ?? AIRPORTS[0];
}

export function getRouteDistance(route: RouteSelection): number {
  const origin = getAirport(route.originId);
  const destination = getAirport(route.destinationId);
  return Math.hypot(destination.x - origin.x, destination.z - origin.z);
}
