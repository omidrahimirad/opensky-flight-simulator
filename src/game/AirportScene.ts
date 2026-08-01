import * as THREE from 'three';
import type { AirportDefinition } from '../types';

export interface ScenicWorld {
  destinationBeacon: THREE.Group;
  cloudLayer: THREE.Group;
  updateAmbientTraffic: (time: number) => void;
}

const standardMaterial = (color: number, roughness = 0.78, metalness = 0.04): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const surfaceOverlayMaterial = (color: number, roughness = 0.9): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
const decalMaterial = (color: number, opacity = 1): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });

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
  const updateAmbientTraffic = createAmbientTraffic(scene, origin, destination);

  const hemisphere = new THREE.HemisphereLight(0xd8f3ff, 0x48523a, 2.45);
  const sun = new THREE.DirectionalLight(0xffedc2, 3.35);
  sun.position.set(origin.x - 900, 1100, origin.z + 500);
  sun.target.position.set(origin.x, 0, origin.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300;
  sun.shadow.camera.bottom = -300;
  sun.shadow.camera.far = 2400;
  sun.shadow.bias = -0.00025;
  scene.add(hemisphere, sun, sun.target);
  return { destinationBeacon, cloudLayer, updateAmbientTraffic };
}

function createSky(scene: THREE.Scene): void {
  const geometry = new THREE.SphereGeometry(11000, 24, 12);
  const sunDirection = new THREE.Vector3(-4200, 2100, -6500).normalize();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x175c91) },
      horizonColor: { value: new THREE.Color(0xaed6df) },
      bottomColor: { value: new THREE.Color(0xf5c58c) },
      sunDirection: { value: sunDirection },
    },
    vertexShader: `varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDirection;
      void main() {
        vec3 direction = normalize(vPosition);
        float h = direction.y;
        vec3 color = mix(horizonColor, topColor, smoothstep(0.0, 0.7, h));
        color = mix(bottomColor, color, smoothstep(-0.18, 0.12, h));
        float horizonHaze = 1.0 - smoothstep(0.0, 0.28, abs(h));
        color = mix(color, vec3(0.91, 0.78, 0.62), horizonHaze * 0.16);
        float solarGlow = pow(max(dot(direction, sunDirection), 0.0), 18.0);
        float solarCore = pow(max(dot(direction, sunDirection), 0.0), 420.0);
        color += vec3(1.0, 0.58, 0.24) * solarGlow * 0.38;
        color += vec3(1.0, 0.92, 0.66) * solarCore * 1.5;
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

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(360, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd69c, transparent: true, opacity: 0.12, depthWrite: false, fog: false }),
  );
  halo.position.copy(sun.position).multiplyScalar(0.985);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
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
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(68, 1700), surfaceOverlayMaterial(0x242a2e, 0.9));
  runway.rotation.x = -Math.PI / 2;
  runway.position.y = 0.035;
  runway.receiveShadow = true;
  parent.add(runway);

  const patchMaterials = [surfaceOverlayMaterial(0x20272a, 0.94), surfaceOverlayMaterial(0x2b3133, 0.94), surfaceOverlayMaterial(0x252c2f, 0.94)];
  for (let index = 0; index < 18; index += 1) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(18 + (index % 4) * 8, 38 + (index % 3) * 22), patchMaterials[index % 3]);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = (index % 5) * 0.035;
    patch.position.set(-23 + ((index * 19) % 48), 0.044, -710 + index * 83);
    parent.add(patch);
  }

  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0xaeb8b8, roughness: 0.88 });
  [-35.2, 35.2].forEach((x) => {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1700), shoulderMaterial);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(x, 0.045, 0);
    parent.add(shoulder);
  });

  const white = decalMaterial(0xf2f3eb);
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

  [-470, 470].forEach((z) => {
    [-18, 18].forEach((x) => {
      const aimingPoint = new THREE.Mesh(new THREE.PlaneGeometry(7, 46), white);
      aimingPoint.rotation.x = -Math.PI / 2;
      aimingPoint.position.set(x, 0.064, z);
      parent.add(aimingPoint);
    });
  });
  [-610, -555, -390, -335, 335, 390, 555, 610].forEach((z, index) => {
    const bars = index % 4 < 2 ? 3 : 2;
    for (let lane = 0; lane < bars; lane += 1) {
      [-1, 1].forEach((side) => {
        const touchdown = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 18), white);
        touchdown.rotation.x = -Math.PI / 2;
        touchdown.position.set(side * (12 + lane * 6), 0.064, z);
        parent.add(touchdown);
      });
    }
  });
  createRunwayNumber(parent, '18', -690, false);
  createRunwayNumber(parent, '36', 690, true);

  const edgeLightGeometry = new THREE.BoxGeometry(0.3, 0.18, 0.3);
  const edgeLightMaterial = new THREE.MeshBasicMaterial({ color: 0xdaf5ff });
  const edgePositions: THREE.Vector3[] = [];
  for (let z = -825; z <= 825; z += 34) {
    [-36.7, 36.7].forEach((x) => {
      edgePositions.push(new THREE.Vector3(x, 0.16, z));
    });
  }
  const edgeLights = new THREE.InstancedMesh(edgeLightGeometry, edgeLightMaterial, edgePositions.length);
  const lightDummy = new THREE.Object3D();
  edgePositions.forEach((position, index) => {
    lightDummy.position.copy(position);
    lightDummy.updateMatrix();
    edgeLights.setMatrixAt(index, lightDummy.matrix);
  });
  parent.add(edgeLights);

  const thresholdGreen = new THREE.MeshBasicMaterial({ color: 0x53ffab });
  const runwayRed = new THREE.MeshBasicMaterial({ color: 0xff554f });
  const greenLights = new THREE.InstancedMesh(edgeLightGeometry, thresholdGreen, 11);
  const redLights = new THREE.InstancedMesh(edgeLightGeometry, runwayRed, 11);
  for (let index = 0; index < 11; index += 1) {
    lightDummy.position.set(-30 + index * 6, 0.18, 831);
    lightDummy.updateMatrix();
    greenLights.setMatrixAt(index, lightDummy.matrix);
    lightDummy.position.z = -831;
    lightDummy.updateMatrix();
    redLights.setMatrixAt(index, lightDummy.matrix);
  }
  parent.add(greenLights, redLights);
  createApproachLights(parent);
  createPapiLights(parent);
  createWindsock(parent, airport.accent);

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

function createRunwayNumber(parent: THREE.Group, label: string, z: number, reverse: boolean): void {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f5f5ed';
    context.font = '900 210px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 128, 168);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const marking = new THREE.Mesh(
    new THREE.PlaneGeometry(27, 34),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -7,
      polygonOffsetUnits: -7,
    }),
  );
  marking.rotation.x = -Math.PI / 2;
  marking.rotation.z = reverse ? Math.PI : 0;
  marking.position.set(0, 0.068, z);
  parent.add(marking);
}

function createApproachLights(parent: THREE.Group): void {
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.12, 0.75, 6);
  const lampGeometry = new THREE.SphereGeometry(0.18, 6, 4);
  const poleMaterial = standardMaterial(0x717c7f, 0.72, 0.35);
  const whiteLamp = new THREE.MeshBasicMaterial({ color: 0xfff2cd });
  const redLamp = new THREE.MeshBasicMaterial({ color: 0xff4c44 });
  const positionRecords: Array<{ x: number; z: number; red: boolean }> = [];
  [-1, 1].forEach((direction) => {
    for (let step = 0; step < 12; step += 1) {
      const z = direction * (865 + step * 26);
      const crossbarPositions = step === 5 || step === 10 ? [-18, -12, -6, 0, 6, 12, 18] : [0];
      crossbarPositions.forEach((x) => positionRecords.push({ x, z, red: step > 9 }));
    }
  });
  const poleInstances = new THREE.InstancedMesh(poleGeometry, poleMaterial, positionRecords.length);
  const whitePositions = positionRecords.filter((position) => !position.red);
  const redPositions = positionRecords.filter((position) => position.red);
  const whiteInstances = new THREE.InstancedMesh(lampGeometry, whiteLamp, whitePositions.length);
  const redInstances = new THREE.InstancedMesh(lampGeometry, redLamp, redPositions.length);
  const dummy = new THREE.Object3D();
  positionRecords.forEach((position, index) => {
    dummy.position.set(position.x, 0.37, position.z);
    dummy.updateMatrix();
    poleInstances.setMatrixAt(index, dummy.matrix);
  });
  whitePositions.forEach((position, index) => {
    dummy.position.set(position.x, 0.82, position.z);
    dummy.updateMatrix();
    whiteInstances.setMatrixAt(index, dummy.matrix);
  });
  redPositions.forEach((position, index) => {
    dummy.position.set(position.x, 0.82, position.z);
    dummy.updateMatrix();
    redInstances.setMatrixAt(index, dummy.matrix);
  });
  parent.add(poleInstances, whiteInstances, redInstances);
}

function createPapiLights(parent: THREE.Group): void {
  const housing = standardMaterial(0x30383c, 0.5, 0.25);
  for (let index = 0; index < 4; index += 1) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.4, 0.7), housing);
    box.position.set(43 + index * 2.1, 0.34, -500);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 8),
      new THREE.MeshBasicMaterial({ color: index < 2 ? 0xfff6d3 : 0xff4b43 }),
    );
    lens.position.set(43 + index * 2.1, 0.38, -500.36);
    parent.add(box, lens);
  }
}

function createWindsock(parent: THREE.Group, accent: number): void {
  const windsock = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 12, 8), standardMaterial(0xb9c3c5, 0.48, 0.48));
  pole.position.y = 6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.13, 0.13), standardMaterial(0x9da9ac, 0.45, 0.5));
  arm.position.set(1.6, 11.8, 0);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 4.6, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8, side: THREE.DoubleSide }),
  );
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(4.1, 11.75, 0);
  windsock.add(pole, arm, sock);
  windsock.position.set(86, 0, -590);
  windsock.rotation.y = 0.35;
  parent.add(windsock);
}

function createApronAndBuildings(parent: THREE.Group, airport: AirportDefinition, isOrigin: boolean): void {
  const accent = airport.accent;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), surfaceOverlayMaterial(0x767e7f, 0.86));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(245, 0.025, 110);
  apron.receiveShadow = true;
  parent.add(apron);

  const seamMaterial = decalMaterial(0x4f595b, 0.65);
  for (let offset = -160; offset <= 160; offset += 40) {
    const verticalSeam = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 400), seamMaterial);
    verticalSeam.rotation.x = -Math.PI / 2;
    verticalSeam.position.set(245 + offset, 0.048, 110);
    const horizontalSeam = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.45), seamMaterial);
    horizontalSeam.rotation.x = -Math.PI / 2;
    horizontalSeam.position.set(245, 0.048, 110 + offset);
    parent.add(verticalSeam, horizontalSeam);
  }

  const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(44, 250), surfaceOverlayMaterial(0x444b4e, 0.9));
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.rotation.z = Math.PI / 2;
  taxiway.position.set(112, 0.04, 240);
  parent.add(taxiway);

  const secondTaxiway = taxiway.clone();
  secondTaxiway.position.z = -35;
  parent.add(secondTaxiway);

  const yellow = decalMaterial(0xf0c75a);
  const taxiLine = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 250), yellow);
  taxiLine.rotation.x = -Math.PI / 2;
  taxiLine.rotation.z = Math.PI / 2;
  taxiLine.position.set(112, 0.055, 240);
  parent.add(taxiLine);

  const secondTaxiLine = taxiLine.clone();
  secondTaxiLine.position.z = -35;
  parent.add(secondTaxiLine);

  [130, 205, 280, 355].forEach((x, index) => {
    const standCenter = new THREE.Mesh(new THREE.PlaneGeometry(1, 92), yellow);
    standCenter.rotation.x = -Math.PI / 2;
    standCenter.position.set(x, 0.061, 66 + (index % 2) * 95);
    const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(28, 1.1), yellow);
    stopBar.rotation.x = -Math.PI / 2;
    stopBar.position.set(x, 0.062, 29 + (index % 2) * 95);
    const standRing = new THREE.Mesh(new THREE.RingGeometry(8, 8.7, 24), yellow);
    standRing.rotation.x = -Math.PI / 2;
    standRing.position.set(x, 0.063, 100 + (index % 2) * 95);
    parent.add(standCenter, stopBar, standRing);
  });

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
    for (let panel = -4; panel <= 4; panel += 1) {
      const doorRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, height - 4, 0.12), standardMaterial(0x53646d, 0.62, 0.25));
      doorRail.position.set(panel * 5, height / 2, -25.12);
      hangar.add(doorRail);
    }
    for (let skylightIndex = -2; skylightIndex <= 2; skylightIndex += 1) {
      const skylight = new THREE.Mesh(new THREE.BoxGeometry(7, 0.16, 2.6), standardMaterial(0xa8d7df, 0.2, 0.25));
      skylight.position.set(skylightIndex * 9, height + 5.2, 2);
      skylight.rotation.x = -0.5;
      hangar.add(skylight);
    }
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
  for (let mullion = -7; mullion <= 7; mullion += 1) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.8, 0.3), standardMaterial(0xced7d8, 0.4, 0.25));
    frame.position.set(mullion * 10, 10.5, -22.5);
    terminal.add(frame);
  }
  for (let unit = -2; unit <= 2; unit += 1) {
    const rooftop = new THREE.Mesh(new THREE.BoxGeometry(13, 3.5, 8), standardMaterial(0x9ca9aa, 0.72, 0.18));
    rooftop.position.set(unit * 27, 20.75, 4);
    terminal.add(rooftop);
  }
  terminal.position.set(278, 0, 78);
  parent.add(terminal);

  [-52, 0, 52].forEach((offset, index) => {
    const bridge = new THREE.Group();
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 16 + index * 2), standardMaterial(0xc5ced0, 0.58, 0.16));
    cabin.position.set(0, 5.8, -8);
    const bridgeWindows = new THREE.Mesh(new THREE.BoxGeometry(8.15, 2.1, 12 + index * 2), standardMaterial(0x214859, 0.22, 0.32));
    bridgeWindows.position.set(0, 6.6, -8);
    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 5.5, 8), standardMaterial(0x7d898b, 0.55, 0.35));
    support.position.set(0, 2.75, -12);
    bridge.add(cabin, bridgeWindows, support);
    bridge.position.set(278 + offset, 0, 48);
    parent.add(bridge);
  });

  const tower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 8.2, 55, 10), standardMaterial(0xc3cbcc));
  stem.position.y = 27.5;
  stem.castShadow = true;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(13, 10, 8, 10), standardMaterial(0x183d50, 0.22, 0.2));
  cab.position.y = 58;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.5, 10), new THREE.MeshBasicMaterial({ color: accent }));
  roof.position.y = 62.6;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 10, 6), standardMaterial(0x98a5a8, 0.35, 0.6));
  antenna.position.y = 68.2;
  const radar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.45, 1.1), new THREE.MeshBasicMaterial({ color: 0xf2f5ef }));
  radar.position.y = 73;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 5), new THREE.MeshBasicMaterial({ color: 0x53ffc1 }));
  beacon.position.y = 64;
  tower.add(stem, cab, roof, antenna, radar, beacon);
  tower.position.set(165, 0, 43);
  parent.add(tower);

  createGroundEquipment(parent, accent, isOrigin);
  createPerimeterFence(parent);
  createCity(parent, airport, isOrigin ? 96 : 80);
}

function createGroundEquipment(parent: THREE.Group, accent: number, isOrigin: boolean): void {
  const equipment = new THREE.Group();
  const vehicleWhite = standardMaterial(0xe6ece9, 0.48, 0.18);
  const vehicleDark = standardMaterial(0x26343b, 0.4, 0.32);
  const rubber = standardMaterial(0x13171a, 0.9, 0.02);

  const addVehicle = (x: number, z: number, color: number, long = false): void => {
    const vehicle = new THREE.Group();
    const length = long ? 12 : 7;
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.5, length), standardMaterial(color, 0.48, 0.16));
    body.position.y = 2.15;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 3.2), vehicleWhite);
    cabin.position.set(0, 3.4, -length / 2 + 1.7);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.25, 0.18), vehicleDark);
    windshield.position.set(0, 3.65, -length / 2 + 0.05);
    vehicle.add(body, cabin, windshield);
    [-1.9, 1.9].forEach((wheelX) => {
      [-length * 0.31, length * 0.31].forEach((wheelZ) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.45, 10), rubber);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wheelX, 1.05, wheelZ);
        vehicle.add(wheel);
      });
    });
    vehicle.position.set(x, 0, z);
    vehicle.rotation.y = x % 2 ? 0.1 : -0.08;
    equipment.add(vehicle);
  };

  addVehicle(378, 160, accent, true);
  addVehicle(330, -5, 0xf3c951);
  if (isOrigin) addVehicle(215, 204, 0xd8e1df);

  for (let index = 0; index < 5; index += 1) {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.2, 3.4), standardMaterial(index % 2 ? 0x68818b : 0xcbd5d4, 0.7));
    cart.position.set(382 + (index % 2) * 7, 1.45, 34 + Math.floor(index / 2) * 6);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 2.8), new THREE.MeshBasicMaterial({ color: accent }));
    cover.position.set(cart.position.x, 2.6, cart.position.z);
    equipment.add(cart, cover);
  }

  const coneGeometry = new THREE.ConeGeometry(0.34, 1.2, 8);
  const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xff7f32, roughness: 0.72 });
  const cones = new THREE.InstancedMesh(coneGeometry, coneMaterial, 18);
  const coneDummy = new THREE.Object3D();
  for (let index = 0; index < 18; index += 1) {
    coneDummy.position.set(112 + (index % 6) * 24, 0.6, 16 + Math.floor(index / 6) * 92);
    coneDummy.updateMatrix();
    cones.setMatrixAt(index, coneDummy.matrix);
  }
  equipment.add(cones);

  [96, 420].forEach((x) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 25, 7), standardMaterial(0xa7b2b3, 0.45, 0.45));
    mast.position.set(x, 12.5, 300);
    const lampBar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.45, 0.7), vehicleDark);
    lampBar.position.set(x, 25, 300);
    for (let lampIndex = -1; lampIndex <= 1; lampIndex += 1) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffe8b5 }));
      lamp.position.set(x + lampIndex * 2, 24.7, 299.55);
      equipment.add(lamp);
    }
    equipment.add(mast, lampBar);
  });
  parent.add(equipment);
}

function createPerimeterFence(parent: THREE.Group): void {
  const postGeometry = new THREE.BoxGeometry(0.16, 2.8, 0.16);
  const fenceMaterial = standardMaterial(0x879395, 0.56, 0.5);
  const posts = new THREE.InstancedMesh(postGeometry, fenceMaterial, 43);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (let x = 52; x <= 472; x += 20) {
    dummy.position.set(x, 1.4, 336);
    dummy.updateMatrix();
    posts.setMatrixAt(index, dummy.matrix);
    index += 1;
  }
  for (let z = -84; z <= 316; z += 20) {
    dummy.position.set(472, 1.4, z);
    dummy.updateMatrix();
    posts.setMatrixAt(index, dummy.matrix);
    index += 1;
  }
  parent.add(posts);
  [0.7, 1.6, 2.5].forEach((y) => {
    const northRail = new THREE.Mesh(new THREE.BoxGeometry(420, 0.055, 0.055), fenceMaterial);
    northRail.position.set(262, y, 336);
    const eastRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 400), fenceMaterial);
    eastRail.position.set(472, y, 116);
    parent.add(northRail, eastRail);
  });
}

function createCity(parent: THREE.Group, airport: AirportDefinition, count: number): void {
  const palettes: Record<AirportDefinition['climate'], number[]> = {
    alpine: [0xc8cfca, 0xaebbb7, 0xddd8ca, 0x8fa3a4],
    coast: [0xe4dfd1, 0xb7cbd0, 0xd8b99d, 0x9fb4bd],
    forest: [0xc4c7b7, 0xa8b4a4, 0xd7cbb4, 0x8fa29a],
    desert: [0xd6ad7c, 0xc58f67, 0xe0c49b, 0xaf8061],
  };
  const palette = palettes[airport.climate];
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), standardMaterial(0xffffff, 0.82), count);
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), standardMaterial(0x56636a, 0.72, 0.16), count);
  const facades = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 1), standardMaterial(0x284653, 0.25, 0.2), count);
  const buildingDummy = new THREE.Object3D();
  const roofDummy = new THREE.Object3D();
  const facadeDummy = new THREE.Object3D();
  const rows = Math.ceil(count / 8);
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const sideIndex = Math.floor(index / 2);
    const column = sideIndex % 4;
    const row = Math.floor(sideIndex / 4);
    const width = 34 + seededUnit(index * 7 + 3) * 34;
    const depth = 38 + seededUnit(index * 11 + 5) * 46;
    const isTower = sideIndex % 13 === 0 || (column >= 2 && sideIndex % 9 === 0);
    const height = isTower ? 52 + seededUnit(index * 17 + 9) * 52 : 10 + seededUnit(index * 19 + 4) * (20 + column * 5);
    const x = side * (660 + column * 145 + seededUnit(index * 23 + 6) * 38);
    const z = (row - (rows - 1) / 2) * 150 + (seededUnit(index * 29 + 8) - 0.5) * 36;

    buildingDummy.position.set(x, height / 2, z);
    buildingDummy.scale.set(width, height, depth);
    buildingDummy.rotation.y = (seededUnit(index * 31 + 7) - 0.5) * 0.08;
    buildingDummy.updateMatrix();
    buildings.setMatrixAt(index, buildingDummy.matrix);
    buildings.setColorAt(index, new THREE.Color(palette[index % palette.length]));

    roofDummy.position.set(x, height + 1.1, z);
    roofDummy.scale.set(width * 0.82, 2.2, depth * 0.82);
    roofDummy.rotation.copy(buildingDummy.rotation);
    roofDummy.updateMatrix();
    roofs.setMatrixAt(index, roofDummy.matrix);

    facadeDummy.position.set(x - side * (width / 2 + 0.12), height * 0.58, z);
    facadeDummy.scale.set(1, height * 0.46, depth * 0.68);
    facadeDummy.rotation.copy(buildingDummy.rotation);
    facadeDummy.updateMatrix();
    facades.setMatrixAt(index, facadeDummy.matrix);
  }
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  roofs.castShadow = true;
  facades.receiveShadow = true;
  parent.add(buildings, roofs, facades);

  const roadMaterial = surfaceOverlayMaterial(0x4d5556, 0.96);
  for (const side of [-1, 1]) {
    [590, 1160].forEach((offset) => {
      const avenue = new THREE.Mesh(new THREE.PlaneGeometry(22, rows * 158), roadMaterial);
      avenue.rotation.x = -Math.PI / 2;
      avenue.position.set(side * offset, 0.018, 0);
      avenue.receiveShadow = true;
      parent.add(avenue);
    });
    for (let row = 0; row < rows; row += 2) {
      const crossStreet = new THREE.Mesh(new THREE.PlaneGeometry(670, 14), roadMaterial);
      crossStreet.rotation.x = -Math.PI / 2;
      crossStreet.position.set(side * 875, 0.019, (row - (rows - 1) / 2) * 150 + 68);
      crossStreet.receiveShadow = true;
      parent.add(crossStreet);
    }
    const park = new THREE.Mesh(new THREE.CircleGeometry(92, 18), surfaceOverlayMaterial(airport.climate === 'desert' ? 0x9a9564 : 0x4f7953, 1));
    park.rotation.x = -Math.PI / 2;
    park.position.set(side * 1020, 0.022, rows * 54);
    parent.add(park);
  }
}

function createTerrainPatches(scene: THREE.Scene, origin: AirportDefinition, destination: AirportDefinition): void {
  const midpointX = (origin.x + destination.x) / 2;
  const midpointZ = (origin.z + destination.z) / 2;
  const patchColors = [0x88a665, 0x6f955d, 0xa8a86b, 0x789465, 0xb4a36c];
  for (let index = 0; index < 30; index += 1) {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(420 + (index % 4) * 160, 300 + (index % 3) * 140),
      surfaceOverlayMaterial(patchColors[index % patchColors.length], 1),
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
  const mountainColors = [0x425c52, 0x566b5d, 0x6c7162];
  for (let paletteIndex = 0; paletteIndex < mountainColors.length; paletteIndex += 1) {
    const count = 16;
    const mountains = new THREE.InstancedMesh(
      createMountainGeometry(13, paletteIndex * 41 + 5),
      new THREE.MeshStandardMaterial({ color: mountainColors[paletteIndex], roughness: 1, flatShading: true }),
      count,
    );
    const mountainDummy = new THREE.Object3D();
    for (let instance = 0; instance < count; instance += 1) {
      const index = paletteIndex + instance * mountainColors.length;
      const angle = (index / (count * mountainColors.length)) * Math.PI * 2 + seededUnit(index * 5 + 2) * 0.09;
      const distance = 5900 + seededUnit(index * 7 + 8) * 1700;
      const radius = 250 + seededUnit(index * 11 + 3) * 310;
      const height = 300 + seededUnit(index * 13 + 4) * 650;
      mountainDummy.position.set(midpointX + Math.cos(angle) * distance, -18, midpointZ + Math.sin(angle) * distance);
      mountainDummy.rotation.set(0, seededUnit(index * 17 + 9) * Math.PI * 2, 0);
      mountainDummy.scale.set(radius, height, radius * (0.68 + seededUnit(index * 19 + 1) * 0.48));
      mountainDummy.updateMatrix();
      mountains.setMatrixAt(instance, mountainDummy.matrix);
    }
    mountains.receiveShadow = true;
    scene.add(mountains);
  }

  const mobileScene = matchMedia('(pointer: coarse)').matches;
  const desertRoute = origin.climate === 'desert' || destination.climate === 'desert';
  const treeCount = Math.round((mobileScene ? 480 : 700) * (desertRoute ? 0.72 : 1));
  const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.72, 6, 6);
  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, standardMaterial(0x554735, 1), treeCount);
  const foliageMaterials = [standardMaterial(0x294e35, 1), standardMaterial(0x3b6742, 1), standardMaterial(0x56794b, 1)];
  const foliageGeometries: THREE.BufferGeometry[] = [
    new THREE.ConeGeometry(3.5, 10.5, 7),
    new THREE.ConeGeometry(4.2, 9.4, 8),
    new THREE.DodecahedronGeometry(4.2, 0),
  ];
  const foliageMeshes = foliageMaterials.map(
    (material, index) => new THREE.InstancedMesh(foliageGeometries[index], material, Math.ceil(treeCount / 3)),
  );
  const foliageIndices = [0, 0, 0];
  const trunkDummy = new THREE.Object3D();
  const foliageDummy = new THREE.Object3D();
  const minX = Math.min(origin.x, destination.x) - 1800;
  const minZ = Math.min(origin.z, destination.z) - 1800;
  const spanX = Math.abs(destination.x - origin.x) + 3600;
  const spanZ = Math.abs(destination.z - origin.z) + 3600;
  let placed = 0;
  let candidate = 0;
  while (placed < treeCount && candidate < treeCount * 14) {
    const cluster = candidate % 24;
    const centerX = minX + seededUnit(cluster * 31 + 7) * spanX;
    const centerZ = minZ + seededUnit(cluster * 43 + 5) * spanZ;
    const spread = 80 + Math.sqrt(seededUnit(candidate * 47 + 11)) * 470;
    const angle = seededUnit(candidate * 53 + 13) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * spread;
    const z = centerZ + Math.sin(angle) * spread;
    candidate += 1;
    const isAirportClearZone = [origin, destination].some(
      (airport) => Math.abs(x - airport.x) < 560 && Math.abs(z - airport.z) < 1320,
    );
    if (isAirportClearZone) continue;
    const scale = 0.72 + seededUnit(candidate * 59 + 17) * 0.76;
    const paletteIndex = placed % foliageMeshes.length;
    trunkDummy.position.set(x, 3 * scale, z);
    trunkDummy.scale.set(scale, scale, scale);
    trunkDummy.rotation.set(0, seededUnit(candidate * 61 + 19) * Math.PI * 2, 0);
    trunkDummy.updateMatrix();
    trunkMesh.setMatrixAt(placed, trunkDummy.matrix);

    foliageDummy.position.set(x, (paletteIndex === 2 ? 8 : 7.4) * scale, z);
    foliageDummy.scale.set(scale, scale, scale);
    foliageDummy.rotation.copy(trunkDummy.rotation);
    foliageDummy.updateMatrix();
    foliageMeshes[paletteIndex].setMatrixAt(foliageIndices[paletteIndex], foliageDummy.matrix);
    foliageIndices[paletteIndex] += 1;
    placed += 1;
  }
  trunkMesh.count = placed;
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  foliageMeshes.forEach((foliage, index) => {
    foliage.count = foliageIndices[index];
    foliage.castShadow = true;
    foliage.receiveShadow = true;
  });
  scene.add(trunkMesh, ...foliageMeshes);
}

function createMountainGeometry(segments: number, seed: number): THREE.BufferGeometry {
  const ringHeights = [0, 0.2, 0.44, 0.67, 0.84];
  const ringRadii = [1, 0.82, 0.57, 0.34, 0.16];
  const positions: number[] = [];
  const indices: number[] = [];
  ringHeights.forEach((height, ring) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const radialNoise = 0.78 + seededUnit(seed + ring * 97 + segment * 17) * 0.38;
      const radius = ringRadii[ring] * radialNoise;
      const verticalNoise = ring === 0 ? 0 : (seededUnit(seed + ring * 131 + segment * 23) - 0.5) * 0.055;
      positions.push(Math.cos(angle) * radius, height + verticalNoise, Math.sin(angle) * radius);
    }
  });
  for (let ring = 0; ring < ringHeights.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const currentRing = ring * segments;
      const nextRing = (ring + 1) * segments;
      indices.push(currentRing + segment, nextRing + next, currentRing + next, currentRing + segment, nextRing + segment, nextRing + next);
    }
  }
  const peakIndex = positions.length / 3;
  positions.push((seededUnit(seed * 7 + 2) - 0.5) * 0.16, 1, (seededUnit(seed * 11 + 4) - 0.5) * 0.16);
  const topRing = (ringHeights.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(topRing + segment, peakIndex, topRing + ((segment + 1) % segments));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createAmbientTraffic(
  scene: THREE.Scene,
  origin: AirportDefinition,
  destination: AirportDefinition,
): (time: number) => void {
  const ambient = new THREE.Group();
  const mobileScene = matchMedia('(pointer: coarse)').matches;
  const birdCount = mobileScene ? 22 : 36;
  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0.24, -0.3, -1.8, 0, 0.72, -0.16, 0, 0.06,
        0, 0.24, -0.3, 0.16, 0, 0.06, 1.8, 0, 0.72,
      ],
      3,
    ),
  );
  birdGeometry.computeVertexNormals();
  const birds = new THREE.InstancedMesh(
    birdGeometry,
    new THREE.MeshBasicMaterial({ color: 0x263436, side: THREE.DoubleSide, fog: true }),
    birdCount,
  );
  const birdDummy = new THREE.Object3D();
  const birdStates = Array.from({ length: birdCount }, (_, index) => {
    const airport = index % 2 === 0 ? origin : destination;
    const cluster = Math.floor(index / 6);
    const centerAngle = seededUnit(cluster * 17 + 4) * Math.PI * 2;
    const centerDistance = 520 + seededUnit(cluster * 23 + 8) * 980;
    return {
      centerX: airport.x + Math.cos(centerAngle) * centerDistance,
      centerZ: airport.z + Math.sin(centerAngle) * centerDistance,
      radius: 90 + seededUnit(index * 29 + 3) * 330,
      altitude: 48 + seededUnit(index * 31 + 7) * 105,
      phase: seededUnit(index * 37 + 5) * Math.PI * 2,
      speed: 0.055 + seededUnit(index * 41 + 2) * 0.075,
      scale: 1.1 + seededUnit(index * 43 + 9) * 1.1,
    };
  });
  ambient.add(birds);

  const trafficMaterial = standardMaterial(0xd9e1df, 0.58, 0.18);
  const trafficAccentMaterials = [standardMaterial(0x4ca6c8, 0.42, 0.22), standardMaterial(0xe39a43, 0.42, 0.22), standardMaterial(0x7b8fc5, 0.42, 0.22)];
  const trafficStates = Array.from({ length: mobileScene ? 2 : 3 }, (_, index) => {
    const aircraft = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.82, 9.5, 9, 1), trafficMaterial);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.7, 9), trafficMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -5.55;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.18, 2.2), trafficAccentMaterials[index]);
    wing.position.z = 0.25;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.16, 1.15), trafficMaterial);
    tail.position.set(0, 0.48, 3.65);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.5, 4), trafficAccentMaterials[index]);
    fin.position.set(0, 1.2, 3.55);
    fin.rotation.y = Math.PI / 4;
    const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3e49 }));
    redLight.position.set(-6.75, 0, 0.25);
    const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 4), new THREE.MeshBasicMaterial({ color: 0x4dffac }));
    greenLight.position.set(6.75, 0, 0.25);
    aircraft.add(body, nose, wing, tail, fin, redLight, greenLight);
    aircraft.scale.setScalar(1.45 + index * 0.2);
    ambient.add(aircraft);

    const angle = 0.48 + index * 1.83;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    return {
      aircraft,
      redLight,
      greenLight,
      direction,
      centerX: (origin.x + destination.x) / 2 + (index - 1) * 620,
      centerZ: (origin.z + destination.z) / 2 + (index % 2 ? 880 : -720),
      altitude: 520 + index * 190,
      speed: 72 + index * 18,
      offset: index * 3700,
      yaw: Math.atan2(-direction.x, -direction.z),
    };
  });
  scene.add(ambient);

  return (time: number): void => {
    birdStates.forEach((bird, index) => {
      const angle = time * bird.speed + bird.phase;
      birdDummy.position.set(
        bird.centerX + Math.cos(angle) * bird.radius,
        bird.altitude + Math.sin(time * 1.7 + bird.phase) * 5,
        bird.centerZ + Math.sin(angle) * bird.radius,
      );
      birdDummy.rotation.set(
        Math.sin(time * 2.1 + bird.phase) * 0.06,
        Math.PI - angle,
        Math.sin(time * 4.8 + bird.phase) * 0.16,
      );
      const flap = 0.72 + Math.abs(Math.sin(time * 6.4 + bird.phase)) * 0.42;
      birdDummy.scale.set(bird.scale, bird.scale * flap, bird.scale);
      birdDummy.updateMatrix();
      birds.setMatrixAt(index, birdDummy.matrix);
    });
    birds.instanceMatrix.needsUpdate = true;

    trafficStates.forEach((traffic, index) => {
      const distance = ((time * traffic.speed + traffic.offset) % 12000) - 6000;
      traffic.aircraft.position.set(
        traffic.centerX + traffic.direction.x * distance,
        traffic.altitude + Math.sin(time * 0.12 + index) * 28,
        traffic.centerZ + traffic.direction.z * distance,
      );
      traffic.aircraft.rotation.set(0, traffic.yaw, Math.sin(time * 0.16 + index) * 0.035);
      const lightsOn = Math.floor(time * 1.7 + index) % 2 === 0;
      traffic.redLight.visible = lightsOn;
      traffic.greenLight.visible = lightsOn;
    });
  };
}

function createClouds(scene: THREE.Scene, origin: AirportDefinition, destination: AirportDefinition): THREE.Group {
  const layer = new THREE.Group();
  const midpointX = (origin.x + destination.x) / 2;
  const midpointZ = (origin.z + destination.z) / 2;
  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: 0xf7faf8,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    flatShading: true,
  });
  const cloudShadowMaterial = new THREE.MeshLambertMaterial({
    color: 0x8fa9b1,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    flatShading: true,
  });
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  const puffCount = 28 * 7;
  const cloudPieces = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, puffCount);
  const cloudShadows = new THREE.InstancedMesh(cloudGeometry, cloudShadowMaterial, puffCount);
  const dummy = new THREE.Object3D();
  const clusterPosition = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const cloudScale = new THREE.Vector3();
  let instance = 0;
  for (let index = 0; index < 28; index += 1) {
    const rotation = index * 0.43;
    clusterPosition.set(
      midpointX - 5000 + ((index * 821) % 10000),
      520 + (index % 6) * 105,
      midpointZ - 4800 + ((index * 1171) % 9600),
    );
    for (let puff = 0; puff < 7; puff += 1) {
      localPosition
        .set((puff - 3) * 31, Math.sin(puff * 1.7) * 12, (puff % 2) * 20)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      cloudScale.set(46 + puff * 5, 23 + (puff % 3) * 9, 30 + puff * 3);
      dummy.position.copy(clusterPosition).add(localPosition);
      dummy.rotation.set(0, rotation, 0);
      dummy.scale.copy(cloudScale);
      dummy.updateMatrix();
      cloudPieces.setMatrixAt(instance, dummy.matrix);
      dummy.position.y -= 11;
      dummy.scale.set(cloudScale.x * 0.94, cloudScale.y * 0.62, cloudScale.z * 0.94);
      dummy.updateMatrix();
      cloudShadows.setMatrixAt(instance, dummy.matrix);
      instance += 1;
    }
  }
  layer.add(cloudShadows, cloudPieces);

  const cirrusTexture = createCirrusTexture();
  const cirrusMaterial = new THREE.MeshBasicMaterial({
    map: cirrusTexture,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const cirrusClouds = new THREE.InstancedMesh(new THREE.PlaneGeometry(760, 190), cirrusMaterial, 14);
  for (let index = 0; index < 14; index += 1) {
    dummy.position.set(
      midpointX - 4800 + ((index * 1051) % 9600),
      1250 + (index % 4) * 110,
      midpointZ - 4500 + ((index * 1543) % 9000),
    );
    dummy.rotation.set(Math.PI / 2, 0, index * 0.38);
    dummy.scale.set(1 + ((index % 3) * 180) / 760, 1, 1);
    dummy.updateMatrix();
    cirrusClouds.setMatrixAt(index, dummy.matrix);
  }
  layer.add(cirrusClouds);
  scene.add(layer);
  return layer;
}

function createCirrusTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 11; index += 1) {
      const x = 20 + index * 47;
      const y = 42 + Math.sin(index * 1.7) * 22;
      const gradient = context.createRadialGradient(x, y, 3, x, y, 65 + (index % 3) * 15);
      gradient.addColorStop(0, 'rgba(255,255,255,0.42)');
      gradient.addColorStop(0.42, 'rgba(255,255,255,0.16)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.save();
      context.translate(x, y);
      context.scale(2.5, 0.42);
      context.beginPath();
      context.arc(0, 0, 70, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
