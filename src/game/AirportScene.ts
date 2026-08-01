import * as THREE from 'three';
import type { AirportDefinition } from '../types';

export interface ScenicWorld {
  destinationBeacon: THREE.Group;
  cloudLayer: THREE.Group;
}

const standardMaterial = (color: number, roughness = 0.78, metalness = 0.04): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function buildAirport(
  scene: THREE.Scene,
  origin: AirportDefinition,
  destination: AirportDefinition,
): ScenicWorld {
  scene.fog = new THREE.FogExp2(0xb3d4dd, 0.00011);
  createSky(scene);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), standardMaterial(0x718b58, 0.96));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  createTerrainPatches(scene, origin, destination);
  createAirportComplex(scene, origin, true);
  createAirportComplex(scene, destination, false);
  createLandscape(scene, origin, destination);
  const cloudLayer = createClouds(scene, origin, destination);
  const destinationBeacon = createDestinationBeacon(scene, destination);

  const hemisphere = new THREE.HemisphereLight(0xd8f3ff, 0x48523a, 2.45);
  const sun = new THREE.DirectionalLight(0xffedc2, 3.35);
  sun.position.set(-900, 1100, 500);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300;
  sun.shadow.camera.bottom = -300;
  sun.shadow.camera.far = 2400;
  sun.shadow.bias = -0.00025;
  scene.add(hemisphere, sun);
  return { destinationBeacon, cloudLayer };
}

function createSky(scene: THREE.Scene): void {
  const geometry = new THREE.SphereGeometry(11000, 24, 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x2e78a8) },
      horizonColor: { value: new THREE.Color(0xb8dce2) },
      bottomColor: { value: new THREE.Color(0xf2c990) },
    },
    vertexShader: `varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      void main() {
        float h = normalize(vPosition).y;
        vec3 color = mix(horizonColor, topColor, smoothstep(0.0, 0.7, h));
        color = mix(bottomColor, color, smoothstep(-0.18, 0.12, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(geometry, material));

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(95, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff0bf, fog: false }),
  );
  sun.position.set(-4200, 2100, -6500);
  scene.add(sun);
}

function createAirportComplex(scene: THREE.Scene, airport: AirportDefinition, isOrigin: boolean): void {
  const group = new THREE.Group();
  group.position.set(airport.x, 0, airport.z);
  group.rotation.y = -THREE.MathUtils.degToRad(airport.heading);
  createRunway(group, airport, isOrigin);
  createApronAndBuildings(group, airport, isOrigin);
  scene.add(group);
}

function createRunway(parent: THREE.Group, airport: AirportDefinition, isOrigin: boolean): void {
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(68, 1700), standardMaterial(0x242a2e, 0.9));
  runway.rotation.x = -Math.PI / 2;
  runway.position.y = 0.035;
  runway.receiveShadow = true;
  parent.add(runway);

  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0xaeb8b8, roughness: 0.88 });
  [-35.2, 35.2].forEach((x) => {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1700), shoulderMaterial);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(x, 0.045, 0);
    parent.add(shoulder);
  });

  const white = new THREE.MeshBasicMaterial({ color: 0xf2f3eb });
  for (let z = -735; z <= 735; z += 56) {
    const center = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 28), white);
    center.rotation.x = -Math.PI / 2;
    center.position.set(0, 0.06, z);
    parent.add(center);
  }
  [-765, 765].forEach((z) => {
    for (let x = -25; x <= 25; x += 8.2) {
      const threshold = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 31), white);
      threshold.rotation.x = -Math.PI / 2;
      threshold.position.set(x, 0.061, z);
      parent.add(threshold);
    }
  });

  const edgeLightGeometry = new THREE.BoxGeometry(0.3, 0.18, 0.3);
  const edgeLightMaterial = new THREE.MeshBasicMaterial({ color: 0xdaf5ff });
  for (let z = -825; z <= 825; z += 34) {
    [-36.7, 36.7].forEach((x) => {
      const light = new THREE.Mesh(edgeLightGeometry, edgeLightMaterial);
      light.position.set(x, 0.16, z);
      parent.add(light);
    });
  }

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 128;
  const context = signCanvas.getContext('2d');
  if (context) {
    context.fillStyle = '#07131d';
    context.fillRect(0, 0, 512, 128);
    context.fillStyle = `#${airport.accent.toString(16).padStart(6, '0')}`;
    context.font = '700 48px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${airport.code}  ${isOrigin ? 'DEPARTURE' : 'ARRIVAL'}`, 256, 64);
  }
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(38, 9.5), new THREE.MeshBasicMaterial({ map: signTexture }));
  sign.position.set(-58, 5, 430);
  parent.add(sign);
}

function createApronAndBuildings(parent: THREE.Group, airport: AirportDefinition, isOrigin: boolean): void {
  const accent = airport.accent;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), standardMaterial(0x767e7f, 0.86));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(245, 0.025, 110);
  apron.receiveShadow = true;
  parent.add(apron);

  const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(44, 250), standardMaterial(0x444b4e, 0.9));
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.rotation.z = Math.PI / 2;
  taxiway.position.set(112, 0.04, 240);
  parent.add(taxiway);

  const yellow = new THREE.MeshBasicMaterial({ color: 0xf0c75a });
  const taxiLine = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 250), yellow);
  taxiLine.rotation.x = -Math.PI / 2;
  taxiLine.rotation.z = Math.PI / 2;
  taxiLine.position.set(112, 0.055, 240);
  parent.add(taxiLine);

  const hangarColors = [0xc7d4d7, 0xaebfc4, 0xd5d9d5];
  const hangarCount = isOrigin ? 3 : 2;
  for (let index = 0; index < hangarCount; index += 1) {
    const hangar = new THREE.Group();
    const height = 18 + (index % 2) * 3;
    const body = new THREE.Mesh(new THREE.BoxGeometry(60, height, 50), standardMaterial(hangarColors[index]));
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(31, 31, 60, 16, 1, false, 0, Math.PI), standardMaterial(0x5d6f77, 0.7));
    roof.rotation.z = Math.PI / 2;
    roof.position.y = height;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(44, height - 3), standardMaterial(0x293b46, 0.55));
    door.position.set(0, height / 2, -25.01);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(48, 1, 0.4), new THREE.MeshBasicMaterial({ color: accent }));
    trim.position.set(0, height - 1.5, -25.3);
    hangar.add(body, roof, door, trim);
    hangar.position.set(185 + index * 78, 0, 260);
    parent.add(hangar);
  }

  const terminal = new THREE.Group();
  const terminalBody = new THREE.Mesh(new THREE.BoxGeometry(160, 19, 44), standardMaterial(0xd9dedf));
  terminalBody.position.y = 9.5;
  terminalBody.castShadow = true;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(151, 6.5, 0.55), standardMaterial(0x1d4154, 0.2, 0.25));
  windows.position.set(0, 10.5, -22.1);
  const terminalAccent = new THREE.Mesh(new THREE.BoxGeometry(160, 1.2, 1), new THREE.MeshBasicMaterial({ color: accent }));
  terminalAccent.position.set(0, 18, -22.2);
  terminal.add(terminalBody, windows, terminalAccent);
  terminal.position.set(278, 0, 78);
  parent.add(terminal);

  const tower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 8.2, 55, 10), standardMaterial(0xc3cbcc));
  stem.position.y = 27.5;
  stem.castShadow = true;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(13, 10, 8, 10), standardMaterial(0x183d50, 0.22, 0.2));
  cab.position.y = 58;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.5, 10), new THREE.MeshBasicMaterial({ color: accent }));
  roof.position.y = 62.6;
  tower.add(stem, cab, roof);
  tower.position.set(165, 0, 43);
  parent.add(tower);

  createCity(parent, airport, isOrigin ? 26 : 18);
}

function createCity(parent: THREE.Group, airport: AirportDefinition, count: number): void {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = standardMaterial(airport.climate === 'desert' ? 0xc89e72 : 0xaebbbc, 0.78);
  const buildings = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < count; index += 1) {
    const width = 16 + (index % 4) * 7;
    const height = 9 + (index % 7) * 7;
    const depth = 18 + (index % 3) * 7;
    dummy.position.set(470 + (index % 6) * 48, height / 2, -100 + Math.floor(index / 6) * 62);
    dummy.scale.set(width, height, depth);
    dummy.updateMatrix();
    buildings.setMatrixAt(index, dummy.matrix);
  }
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  parent.add(buildings);
}

function createTerrainPatches(scene: THREE.Scene, origin: AirportDefinition, destination: AirportDefinition): void {
  const midpointX = (origin.x + destination.x) / 2;
  const midpointZ = (origin.z + destination.z) / 2;
  const patchColors = [0x88a665, 0x6f955d, 0xa8a86b, 0x789465, 0xb4a36c];
  for (let index = 0; index < 30; index += 1) {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(420 + (index % 4) * 160, 300 + (index % 3) * 140),
      new THREE.MeshStandardMaterial({ color: patchColors[index % patchColors.length], roughness: 1 }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = (index % 5) * 0.13;
    patch.position.set(midpointX - 3600 + ((index * 641) % 7200), 0.012, midpointZ - 3300 + ((index * 883) % 6600));
    scene.add(patch);
  }

  if (origin.climate === 'coast' || destination.climate === 'coast') {
    const coast = origin.climate === 'coast' ? origin : destination;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(5200, 4200),
      new THREE.MeshStandardMaterial({ color: 0x3b8ca7, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.9 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(coast.x + 3000, -0.08, coast.z);
    scene.add(water);
  }
}

function createLandscape(scene: THREE.Scene, origin: AirportDefinition, destination: AirportDefinition): void {
  const midpointX = (origin.x + destination.x) / 2;
  const midpointZ = (origin.z + destination.z) / 2;
  const mountainMaterials = [standardMaterial(0x526e61, 1), standardMaterial(0x657765, 1), standardMaterial(0x7e7b68, 1)];
  for (let index = 0; index < 44; index += 1) {
    const angle = (index / 44) * Math.PI * 2;
    const distance = 6600 + Math.sin(index * 2.17) * 650;
    const height = 280 + (index % 8) * 78;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(290 + (index % 5) * 70, height, 7),
      mountainMaterials[index % mountainMaterials.length],
    );
    mountain.position.set(midpointX + Math.cos(angle) * distance, height / 2 - 15, midpointZ + Math.sin(angle) * distance);
    mountain.rotation.y = index * 0.77;
    scene.add(mountain);
  }

  const crownGeometry = new THREE.ConeGeometry(4.6, 12, 7);
  const treeGeometry = new THREE.BufferGeometry();
  treeGeometry.copy(crownGeometry);
  const trees = new THREE.InstancedMesh(treeGeometry, standardMaterial(0x3e6948, 1), 230);
  const dummy = new THREE.Object3D();
  const minX = Math.min(origin.x, destination.x) - 1800;
  const minZ = Math.min(origin.z, destination.z) - 1800;
  const spanX = Math.abs(destination.x - origin.x) + 3600;
  const spanZ = Math.abs(destination.z - origin.z) + 3600;
  let placed = 0;
  let candidate = 0;
  while (placed < 230 && candidate < 2000) {
    const x = minX + ((candidate * 733) % Math.max(spanX, 1));
    const z = minZ + ((candidate * 991) % Math.max(spanZ, 1));
    candidate += 1;
    const isAirportClearZone = [origin, destination].some(
      (airport) => Math.abs(x - airport.x) < 540 && Math.abs(z - airport.z) < 1250,
    );
    if (isAirportClearZone) continue;
    const scale = 0.7 + (placed % 7) * 0.11;
    dummy.position.set(x, 6 * scale, z);
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.y = placed * 0.61;
    dummy.updateMatrix();
    trees.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trees.castShadow = true;
  scene.add(trees);
}

function createClouds(scene: THREE.Scene, origin: AirportDefinition, destination: AirportDefinition): THREE.Group {
  const layer = new THREE.Group();
  const midpointX = (origin.x + destination.x) / 2;
  const midpointZ = (origin.z + destination.z) / 2;
  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf4f7f5, transparent: true, opacity: 0.72, depthWrite: false });
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  for (let index = 0; index < 28; index += 1) {
    const cloud = new THREE.Group();
    for (let puff = 0; puff < 5; puff += 1) {
      const piece = new THREE.Mesh(cloudGeometry, cloudMaterial);
      piece.position.set((puff - 2) * 34, Math.sin(puff * 1.7) * 11, (puff % 2) * 18);
      piece.scale.set(48 + puff * 6, 24 + (puff % 3) * 8, 32 + puff * 3);
      cloud.add(piece);
    }
    cloud.position.set(midpointX - 5000 + ((index * 821) % 10000), 520 + (index % 6) * 105, midpointZ - 4800 + ((index * 1171) % 9600));
    cloud.rotation.y = index * 0.43;
    layer.add(cloud);
  }
  scene.add(layer);
  return layer;
}

function createDestinationBeacon(scene: THREE.Scene, destination: AirportDefinition): THREE.Group {
  const beacon = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: destination.accent, transparent: true, opacity: 0.58, depthWrite: false });
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(32 + index * 18, 1.7, 8, 32), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 105 + index * 42;
    beacon.add(ring);
  }
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 6, 260, 8),
    new THREE.MeshBasicMaterial({ color: destination.accent, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  column.position.y = 130;
  beacon.add(column);
  beacon.position.set(destination.x, 0, destination.z);
  scene.add(beacon);
  return beacon;
}
