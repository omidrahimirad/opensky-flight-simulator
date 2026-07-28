import * as THREE from 'three';
import type { AircraftDefinition } from '../types';

const white = new THREE.MeshStandardMaterial({ color: 0xe7eef3, roughness: 0.38, metalness: 0.14 });
const dark = new THREE.MeshStandardMaterial({ color: 0x101a24, roughness: 0.3, metalness: 0.35 });
const glass = new THREE.MeshStandardMaterial({
  color: 0x18394d,
  emissive: 0x07131d,
  roughness: 0.18,
  metalness: 0.3,
});
const tire = new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.82 });
const metal = new THREE.MeshStandardMaterial({ color: 0x8e9aa4, roughness: 0.3, metalness: 0.75 });

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position?: [number, number, number],
  rotation?: [number, number, number],
): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  if (position) item.position.set(...position);
  if (rotation) item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function addGear(group: THREE.Group, definition: AircraftDefinition): void {
  const strutMaterial = metal;
  const wheelGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 10);
  const strutGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.9, 8);
  const positions: [number, number, number][] = [
    [-1.55, -0.75, 1.3],
    [1.55, -0.75, 1.3],
    [0, -0.72, -3.15],
  ];
  positions.forEach(([x, y, z]) => {
    const assembly = new THREE.Group();
    const strut = mesh(strutGeometry, strutMaterial, [0, -0.15, 0]);
    const wheel = mesh(wheelGeometry, tire, [0, -0.62, 0], [0, 0, Math.PI / 2]);
    assembly.add(strut, wheel);
    assembly.position.set(x, y, z);
    group.add(assembly);
  });
  group.userData.gearHeight = definition.gearHeight;
}

function addWindows(group: THREE.Group, count: number, startZ: number, spacing: number): void {
  const windowGeometry = new THREE.BoxGeometry(0.03, 0.24, 0.36);
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < count; index += 1) {
      const windowMesh = mesh(windowGeometry, glass, [side * 0.78, 0.28, startZ + index * spacing]);
      group.add(windowMesh);
    }
  }
}

function addCommonBody(group: THREE.Group, accent: THREE.Material, length = 9, radius = 0.9): void {
  const fuselage = mesh(
    new THREE.CylinderGeometry(radius * 0.82, radius, length, 16, 1),
    white,
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
  );
  const nose = mesh(new THREE.SphereGeometry(radius, 16, 10), white, [0, 0, -length / 2]);
  nose.scale.set(0.96, 0.86, 1.55);
  const tailCone = mesh(new THREE.ConeGeometry(radius * 0.82, 2.8, 14), white, [0, 0, length / 2 + 1.4], [
    -Math.PI / 2,
    0,
    0,
  ]);
  const stripe = mesh(new THREE.BoxGeometry(radius * 1.72, 0.12, length * 0.78), accent, [0, -0.12, -0.1]);
  const cockpit = mesh(new THREE.BoxGeometry(radius * 1.5, 0.42, 0.82), glass, [0, 0.37, -length / 2 - 0.48], [
    -0.28,
    0,
    0,
  ]);
  group.add(fuselage, nose, tailCone, stripe, cockpit);
}

function addPropeller(group: THREE.Group, z: number, scale = 1): THREE.Group {
  const prop = new THREE.Group();
  prop.name = 'propeller';
  const hub = mesh(new THREE.SphereGeometry(0.2 * scale, 10, 8), metal);
  const bladeGeometry = new THREE.BoxGeometry(0.13 * scale, 1.65 * scale, 0.07 * scale);
  prop.add(hub, mesh(bladeGeometry, dark), mesh(bladeGeometry, dark, undefined, [0, 0, Math.PI / 2]));
  prop.position.z = z;
  group.add(prop);
  return prop;
}

function createSkylark(definition: AircraftDefinition, accent: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  addCommonBody(group, accent, 7.1, 0.68);
  group.add(
    mesh(new THREE.BoxGeometry(9.8, 0.18, 1.15), white, [0, 0.1, -0.15]),
    mesh(new THREE.BoxGeometry(3.5, 0.13, 0.72), white, [0, 0.38, 3.15]),
    mesh(new THREE.BoxGeometry(0.16, 2.35, 1.48), accent, [0, 1.05, 3.4], [-0.08, 0, 0]),
  );
  addPropeller(group, -4.42, 1.05);
  addWindows(group, 2, -1.25, 0.72);
  addGear(group, definition);
  return group;
}

function createHorizon(definition: AircraftDefinition, accent: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  addCommonBody(group, accent, 11.8, 0.93);
  const wing = mesh(new THREE.BoxGeometry(14.5, 0.22, 1.48), white, [0, 0.04, 0.2]);
  const tailWing = mesh(new THREE.BoxGeometry(5.1, 0.16, 0.9), white, [0, 0.46, 5.05]);
  const tail = mesh(new THREE.BoxGeometry(0.2, 3.1, 2.05), accent, [0, 1.35, 4.95], [-0.14, 0, 0]);
  group.add(wing, tailWing, tail);

  [-3.35, 3.35].forEach((x) => {
    const nacelle = mesh(new THREE.CylinderGeometry(0.48, 0.56, 1.8, 14), dark, [x, -0.2, -0.1], [
      Math.PI / 2,
      0,
      0,
    ]);
    group.add(nacelle);
    const prop = addPropeller(group, -1.05, 0.84);
    prop.position.x = x;
    prop.position.y = -0.2;
  });
  addWindows(group, 7, -3.3, 0.88);
  addGear(group, definition);
  return group;
}

function createSwift(definition: AircraftDefinition, accent: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  addCommonBody(group, accent, 10.2, 0.78);
  const wing = mesh(new THREE.BoxGeometry(10.8, 0.18, 1.25), white, [0, 0.02, 0.32], [0, 0.05, 0]);
  wing.geometry.rotateY(-0.08);
  group.add(
    wing,
    mesh(new THREE.BoxGeometry(4.25, 0.14, 0.72), white, [0, 0.52, 4.18]),
    mesh(new THREE.BoxGeometry(0.18, 2.75, 1.75), accent, [0, 1.18, 4.2], [-0.14, 0, 0]),
  );
  [-1.12, 1.12].forEach((x) => {
    const engine = mesh(new THREE.CylinderGeometry(0.4, 0.47, 2.05, 14), dark, [x, 0.18, 3.23], [
      Math.PI / 2,
      0,
      0,
    ]);
    const intake = mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 14), metal, [x, 0.18, 2.18]);
    group.add(engine, intake);
  });
  addWindows(group, 4, -2.4, 0.9);
  addGear(group, definition);
  return group;
}

export function createAircraft(definition: AircraftDefinition): THREE.Group {
  const accent = new THREE.MeshStandardMaterial({
    color: definition.accent,
    roughness: 0.34,
    metalness: 0.24,
  });
  const aircraft =
    definition.id === 'skylark'
      ? createSkylark(definition, accent)
      : definition.id === 'horizon'
        ? createHorizon(definition, accent)
        : createSwift(definition, accent);
  aircraft.name = definition.name;
  aircraft.scale.setScalar(definition.scale);
  aircraft.userData.definition = definition;
  return aircraft;
}

export function animateAircraftParts(aircraft: THREE.Object3D, speed: number): void {
  aircraft.traverse((object) => {
    if (object.name === 'propeller') object.rotation.z += speed;
  });
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}
