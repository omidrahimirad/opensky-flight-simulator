import * as THREE from 'three';
import type { AircraftDefinition } from '../types';

const pearl = new THREE.MeshPhysicalMaterial({
  color: 0xf5f1e8,
  roughness: 0.28,
  metalness: 0.08,
  clearcoat: 0.58,
  clearcoatRoughness: 0.2,
  flatShading: true,
});
const underside = new THREE.MeshPhysicalMaterial({
  color: 0xbac9ce,
  roughness: 0.43,
  metalness: 0.1,
  clearcoat: 0.24,
  clearcoatRoughness: 0.32,
});
const dark = new THREE.MeshStandardMaterial({ color: 0x101921, roughness: 0.25, metalness: 0.42 });
const glass = new THREE.MeshPhysicalMaterial({
  color: 0x123c52,
  emissive: 0x061b29,
  emissiveIntensity: 0.34,
  roughness: 0.08,
  metalness: 0.22,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
});
const tire = new THREE.MeshStandardMaterial({ color: 0x0c0f12, roughness: 0.9 });
const metal = new THREE.MeshStandardMaterial({ color: 0xaeb8c0, roughness: 0.24, metalness: 0.82 });
const propellerMaterial = new THREE.MeshStandardMaterial({ color: 0x18242b, roughness: 0.25, metalness: 0.55 });
const panelLine = new THREE.MeshStandardMaterial({
  color: 0x667983,
  roughness: 0.46,
  metalness: 0.38,
  transparent: true,
  opacity: 0.42,
});

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

function createWingGeometry(halfSpan: number, rootChord: number, tipChord: number, sweep: number, thickness: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const rootLeading = -rootChord / 2;
  const rootTrailing = rootChord / 2;
  const tipLeading = sweep - tipChord / 2;
  const tipTrailing = sweep + tipChord / 2;

  [-1, 1].forEach((side) => {
    const offset = positions.length / 3;
    const tipX = side * halfSpan;
    positions.push(
      0, thickness / 2, rootLeading,
      0, thickness / 2, rootTrailing,
      tipX, thickness / 2, tipTrailing,
      tipX, thickness / 2, tipLeading,
      0, -thickness / 2, rootLeading,
      0, -thickness / 2, rootTrailing,
      tipX, -thickness / 2, tipTrailing,
      tipX, -thickness / 2, tipLeading,
    );
    const top = side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const bottom = side > 0 ? [4, 6, 5, 4, 7, 6] : [4, 5, 6, 4, 6, 7];
    const edges = [0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
    [...top, ...bottom, ...edges].forEach((index) => indices.push(offset + index));
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFinGeometry(height: number, rootChord: number, tipChord: number, sweep: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-rootChord / 2, 0);
  shape.lineTo(rootChord / 2, 0);
  shape.lineTo(sweep + tipChord / 2, height);
  shape.lineTo(sweep - tipChord / 2, height);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createRudderGeometry(
  height: number,
  rootChord: number,
  tipChord: number,
  sweep: number,
  thickness: number,
): THREE.BufferGeometry {
  const rootTrailing = rootChord / 2;
  const tipTrailing = sweep + tipChord / 2;
  const shape = new THREE.Shape();
  shape.moveTo(rootTrailing - rootChord * 0.28, height * 0.07);
  shape.lineTo(rootTrailing, height * 0.07);
  shape.lineTo(tipTrailing, height * 0.92);
  shape.lineTo(tipTrailing - tipChord * 0.62, height * 0.92);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addFuselage(group: THREE.Group, accent: THREE.Material, length: number, radius: number, windowCount: number): void {
  const body = mesh(
    new THREE.CylinderGeometry(radius * 0.56, radius, length, 20, 3),
    pearl,
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
  );
  const belly = mesh(new THREE.CylinderGeometry(radius * 0.48, radius * 0.64, length * 0.7, 16, 1), underside, [0, -0.2, -0.15], [
    Math.PI / 2,
    0,
    0,
  ]);
  const nose = mesh(new THREE.SphereGeometry(radius, 18, 10), pearl, [0, 0.02, -length / 2 - radius * 0.42]);
  nose.scale.set(1, 0.9, 1.55);
  const noseAccent = mesh(new THREE.SphereGeometry(radius * 0.73, 14, 8), accent, [0, -radius * 0.24, -length / 2 - radius * 0.82]);
  noseAccent.scale.set(1, 0.58, 1.08);
  const tailCone = mesh(new THREE.ConeGeometry(radius * 0.57, length * 0.18, 16), pearl, [0, 0.06, length / 2 + length * 0.09], [
    Math.PI / 2,
    0,
    0,
  ]);

  const canopy = mesh(new THREE.SphereGeometry(radius * 0.84, 14, 8), glass, [0, radius * 0.41, -length / 2 - radius * 0.2]);
  canopy.scale.set(0.92, 0.5, 1.22);
  const windshieldFrame = mesh(
    new THREE.BoxGeometry(0.055, radius * 0.62, radius * 1.1),
    pearl,
    [0, radius * 0.42, -length / 2 - radius * 0.31],
    [-0.2, 0, 0],
  );

  group.add(body, belly, nose, noseAccent, tailCone, canopy, windshieldFrame);
  [-0.2, 0.15, 0.34].forEach((offset) => {
    const seam = mesh(new THREE.TorusGeometry(radius * 1.006, 0.012, 5, 24), panelLine, [0, 0, length * offset]);
    seam.castShadow = false;
    group.add(seam);
  });
  addLivery(group, accent, length, radius);
  addWindows(group, windowCount, length, radius);
}

function addLivery(group: THREE.Group, accent: THREE.Material, length: number, radius: number): void {
  for (const side of [-1, 1]) {
    const mainStripe = mesh(
      new THREE.BoxGeometry(0.035, 0.18, length * 0.73),
      accent,
      [side * radius * 0.95, -0.08, length * 0.02],
      [0.025, 0, side * 0.025],
    );
    const darkStripe = mesh(
      new THREE.BoxGeometry(0.038, 0.065, length * 0.67),
      dark,
      [side * radius * 0.965, -0.29, length * 0.08],
    );
    group.add(mainStripe, darkStripe);
  }
}

function addWindows(group: THREE.Group, count: number, length: number, radius: number): void {
  const spacing = count > 5 ? 0.82 : 0.76;
  const startZ = -length * 0.3;
  const windowGeometry = new THREE.BoxGeometry(0.035, count > 5 ? 0.31 : 0.34, count > 5 ? 0.38 : 0.42);
  for (const side of [-1, 1]) {
    for (let index = 0; index < count; index += 1) {
      const windowMesh = mesh(windowGeometry, glass, [side * radius * 0.99, 0.28, startZ + index * spacing]);
      windowMesh.rotation.z = side * -0.04;
      group.add(windowMesh);
    }
  }
  const door = mesh(new THREE.BoxGeometry(0.038, 0.95, 0.62), dark, [radius * 0.995, -0.03, length * 0.27]);
  const doorInset = mesh(new THREE.BoxGeometry(0.041, 0.77, 0.5), pearl, [radius * 1.006, -0.03, length * 0.27]);
  group.add(door, doorInset);
}

function addTail(group: THREE.Group, accent: THREE.Material, z: number, size: number): void {
  const horizontal = mesh(createWingGeometry(size * 1.9, size * 0.82, size * 0.28, size * 0.3, 0.11), pearl, [0, 0.42, z]);
  const elevator = mesh(
    createWingGeometry(size * 1.72, size * 0.2, size * 0.12, size * 0.29, 0.125),
    underside,
    [0, 0.42, z + size * 0.37],
  );
  const fairing = mesh(
    createFinGeometry(size * 0.6, size * 1.16, size * 0.36, size * 0.23, 0.3),
    pearl,
    [0, 0.16, z - size * 0.13],
  );
  const finHeight = size * 1.55;
  const rootChord = size * 1.25;
  const tipChord = size * 0.36;
  const sweep = size * 0.46;
  const fin = mesh(createFinGeometry(finHeight, rootChord, tipChord, sweep, 0.17), accent, [0, 0.32, z + size * 0.08]);
  const rudder = mesh(
    createRudderGeometry(finHeight, rootChord, tipChord, sweep, 0.185),
    pearl,
    [0, 0.32, z + size * 0.08],
  );
  const tailLight = mesh(
    new THREE.SphereGeometry(size * 0.075, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xf7fbff }),
    [0, 0.36 + finHeight, z + size * 0.08 + sweep],
  );
  tailLight.name = 'navigation-light';
  group.add(horizontal, elevator, fairing, fin, rudder, tailLight);
}

function addWingDetails(group: THREE.Group, accent: THREE.Material, halfSpan: number, z: number): void {
  for (const side of [-1, 1]) {
    const tip = mesh(new THREE.BoxGeometry(0.34, 0.16, 0.86), accent, [side * (halfSpan - 0.16), 0.07, z + 0.35]);
    const flap = mesh(new THREE.BoxGeometry(halfSpan * 0.36, 0.045, 0.34), dark, [side * halfSpan * 0.42, -0.11, z + 0.65]);
    group.add(tip, flap);
  }
}

function addPropeller(group: THREE.Group, position: [number, number, number], radius: number, accent: THREE.Material): THREE.Group {
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  const disc = mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xa9d8e8, transparent: true, opacity: 0.075, depthWrite: false }),
  );
  disc.castShadow = false;
  disc.receiveShadow = false;
  propeller.add(disc);
  const bladeGeometry = new THREE.BoxGeometry(radius * 0.11, radius * 0.92, 0.045);
  for (let index = 0; index < 3; index += 1) {
    const arm = new THREE.Group();
    arm.rotation.z = (index / 3) * Math.PI * 2;
    arm.add(
      mesh(bladeGeometry, propellerMaterial, [0, radius * 0.42, 0.025]),
      mesh(new THREE.BoxGeometry(radius * 0.12, radius * 0.2, 0.052), accent, [0, radius * 0.82, 0.03]),
    );
    propeller.add(arm);
  }
  const spinner = mesh(new THREE.ConeGeometry(radius * 0.2, radius * 0.48, 14), metal, [0, 0, -0.18], [-Math.PI / 2, 0, 0]);
  propeller.add(spinner);
  propeller.position.set(...position);
  group.add(propeller);
  return propeller;
}

function addTurbopropEngine(group: THREE.Group, x: number, y: number, z: number, scale: number, accent: THREE.Material): void {
  const pylon = mesh(new THREE.BoxGeometry(0.62 * scale, 0.38 * scale, 1.1 * scale), underside, [x, y + 0.38 * scale, z + 0.18 * scale]);
  const nacelle = mesh(
    new THREE.CylinderGeometry(0.38 * scale, 0.58 * scale, 2.15 * scale, 16, 2),
    pearl,
    [x, y, z],
    [Math.PI / 2, 0, 0],
  );
  const cowling = mesh(new THREE.TorusGeometry(0.55 * scale, 0.09 * scale, 8, 18), dark, [x, y, z - 1.08 * scale]);
  const intake = mesh(new THREE.CircleGeometry(0.46 * scale, 18), dark, [x, y, z - 1.1 * scale]);
  group.add(pylon, nacelle, cowling, intake);
  addPropeller(group, [x, y, z - 1.32 * scale], 1.25 * scale, accent);
}

function addJetEngine(group: THREE.Group, x: number, y: number, z: number, scale: number): void {
  const engine = mesh(
    new THREE.CylinderGeometry(0.34 * scale, 0.48 * scale, 2.25 * scale, 18, 2),
    pearl,
    [x, y, z],
    [Math.PI / 2, 0, 0],
  );
  const intake = mesh(new THREE.TorusGeometry(0.46 * scale, 0.075 * scale, 8, 20), metal, [x, y, z - 1.12 * scale]);
  const fan = mesh(new THREE.CircleGeometry(0.38 * scale, 16), dark, [x, y, z - 1.14 * scale]);
  const exhaust = mesh(new THREE.CylinderGeometry(0.28 * scale, 0.34 * scale, 0.34 * scale, 14), dark, [x, y, z + 1.18 * scale], [
    Math.PI / 2,
    0,
    0,
  ]);
  group.add(engine, intake, fan, exhaust);
}

interface GearPosition {
  x: number;
  y: number;
  z: number;
  double?: boolean;
}

function addGear(group: THREE.Group, definition: AircraftDefinition, positions: GearPosition[], wheelRadius = 0.27): void {
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.18, 12);
  positions.forEach(({ x, y, z, double }) => {
    const assembly = new THREE.Group();
    const strut = mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.92, 8), metal, [0, -0.18, 0]);
    assembly.add(strut);
    const offsets = double ? [-0.17, 0.17] : [0];
    offsets.forEach((zOffset) => assembly.add(mesh(wheelGeometry, tire, [0, -0.68, zOffset], [0, 0, Math.PI / 2])));
    const door = mesh(new THREE.BoxGeometry(0.08, 0.48, 0.32), underside, [Math.sign(x || 1) * 0.12, -0.18, 0]);
    assembly.add(door);
    assembly.position.set(x, y, z);
    group.add(assembly);
  });
  group.userData.gearHeight = definition.gearHeight;
}

function createSkylark(definition: AircraftDefinition, accent: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  addFuselage(group, accent, 7.4, 0.7, 3);
  const wing = mesh(createWingGeometry(5.05, 1.55, 0.62, 0.45, 0.17), pearl, [0, 0.08, -0.15]);
  group.add(wing);
  addWingDetails(group, accent, 5.05, -0.15);
  addTail(group, accent, 4.05, 1.05);
  addTurbopropEngine(group, 0, 0.06, -3.68, 0.68, accent);
  addGear(
    group,
    definition,
    [
      { x: -1.38, y: -0.72, z: 0.72 },
      { x: 1.38, y: -0.72, z: 0.72 },
      { x: 0, y: -0.69, z: -2.72 },
    ],
    0.25,
  );
  return group;
}

function createHorizon(definition: AircraftDefinition, accent: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  addFuselage(group, accent, 12.4, 0.96, 8);
  const wing = mesh(createWingGeometry(7.45, 2.1, 0.72, 0.95, 0.22), pearl, [0, 0.1, -0.15]);
  group.add(wing);
  addWingDetails(group, accent, 7.45, -0.15);
  addTail(group, accent, 6.55, 1.48);
  addTurbopropEngine(group, -3.35, -0.02, -0.55, 1, accent);
  addTurbopropEngine(group, 3.35, -0.02, -0.55, 1, accent);
  addGear(
    group,
    definition,
    [
      { x: -2.72, y: -0.86, z: 0.62, double: true },
      { x: 2.72, y: -0.86, z: 0.62, double: true },
      { x: 0, y: -0.82, z: -4.65, double: true },
    ],
    0.3,
  );
  return group;
}

function createSwift(definition: AircraftDefinition, accent: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  addFuselage(group, accent, 10.7, 0.81, 5);
  const wing = mesh(createWingGeometry(5.65, 2.28, 0.46, 1.5, 0.17), pearl, [0, 0, 0.18]);
  group.add(wing);
  addWingDetails(group, accent, 5.65, 0.18);
  addTail(group, accent, 5.85, 1.28);
  addJetEngine(group, -1.18, 0.08, 3.48, 0.95);
  addJetEngine(group, 1.18, 0.08, 3.48, 0.95);
  addGear(
    group,
    definition,
    [
      { x: -1.48, y: -0.75, z: 0.82 },
      { x: 1.48, y: -0.75, z: 0.82 },
      { x: 0, y: -0.72, z: -3.68 },
    ],
    0.26,
  );
  return group;
}

export function createAircraft(definition: AircraftDefinition): THREE.Group {
  const accent = new THREE.MeshPhysicalMaterial({
    color: definition.accent,
    roughness: 0.24,
    metalness: 0.2,
    clearcoat: 0.64,
    clearcoatRoughness: 0.18,
    flatShading: true,
  });
  const aircraft =
    definition.id === 'skylark'
      ? createSkylark(definition, accent)
      : definition.id === 'horizon'
        ? createHorizon(definition, accent)
        : createSwift(definition, accent);
  aircraft.name = definition.name;
  const wingTip = definition.id === 'horizon' ? 7.42 : definition.id === 'swift' ? 5.62 : 5.02;
  const wingZ = definition.id === 'swift' ? 0.52 : 0.2;
  const redLight = mesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3545 }),
    [-wingTip, 0.16, wingZ],
  );
  const greenLight = mesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x43f5a0 }),
    [wingTip, 0.16, wingZ],
  );
  const landingLight = mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff4ce }),
    [0, -0.45, definition.id === 'horizon' ? -5.85 : definition.id === 'swift' ? -4.95 : -3.65],
  );
  redLight.name = 'navigation-light';
  greenLight.name = 'navigation-light';
  landingLight.name = 'navigation-light';
  aircraft.add(redLight, greenLight, landingLight);
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
    materials.forEach((material) => {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    });
  });
}
