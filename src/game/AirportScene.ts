import * as THREE from 'three';

const shadowMaterial = (color: number, roughness = 0.78): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });

export function buildAirport(scene: THREE.Scene): void {
  scene.background = new THREE.Color(0x8fc8dd);
  scene.fog = new THREE.FogExp2(0xa9d2df, 0.00032);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), shadowMaterial(0x6e8856, 0.95));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  createRunway(scene);
  createApronAndBuildings(scene);
  createLandscape(scene);

  const hemisphere = new THREE.HemisphereLight(0xc9eeff, 0x435034, 2.25);
  const sun = new THREE.DirectionalLight(0xfff0cc, 3.1);
  sun.position.set(-350, 520, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -230;
  sun.shadow.camera.right = 230;
  sun.shadow.camera.top = 230;
  sun.shadow.camera.bottom = -230;
  sun.shadow.camera.far = 1200;
  scene.add(hemisphere, sun);
}

function createRunway(scene: THREE.Scene): void {
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(62, 1640), shadowMaterial(0x252b30, 0.88));
  runway.rotation.x = -Math.PI / 2;
  runway.position.y = 0.035;
  runway.receiveShadow = true;
  scene.add(runway);

  const shoulderMaterial = new THREE.MeshBasicMaterial({ color: 0xaeb9bd });
  [-32.2, 32.2].forEach((x) => {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1640), shoulderMaterial);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(x, 0.045, 0);
    scene.add(shoulder);
  });

  const white = new THREE.MeshBasicMaterial({ color: 0xf4f6ef });
  for (let z = -720; z <= 720; z += 55) {
    const center = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 27), white);
    center.rotation.x = -Math.PI / 2;
    center.position.set(0, 0.06, z);
    scene.add(center);
  }

  [-750, 750].forEach((z, runwayIndex) => {
    for (let x = -23; x <= 23; x += 7.5) {
      const threshold = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 30), white);
      threshold.rotation.x = -Math.PI / 2;
      threshold.position.set(x, 0.061, z);
      scene.add(threshold);
    }
    const designator = createRunwayNumber(runwayIndex === 0 ? '18' : '36');
    designator.position.set(0, 0.07, runwayIndex === 0 ? -695 : 695);
    designator.rotation.x = -Math.PI / 2;
    designator.rotation.z = runwayIndex === 0 ? 0 : Math.PI;
    scene.add(designator);
  });

  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xe5f7ff });
  const lightGeometry = new THREE.BoxGeometry(0.25, 0.18, 0.25);
  for (let z = -800; z <= 800; z += 32) {
    [-33.8, 33.8].forEach((x) => {
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(x, 0.16, z);
      scene.add(light);
    });
  }
}

function createRunwayNumber(text: string): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xf3f5ed });
  const patterns: Record<string, number[][]> = {
    '1': [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 1],
    ],
    '8': [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    '3': [
      [1, 1, 1],
      [0, 0, 1],
      [0, 1, 1],
      [0, 0, 1],
      [1, 1, 1],
    ],
    '6': [
      [1, 1, 1],
      [1, 0, 0],
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
  };
  [...text].forEach((digit, digitIndex) => {
    patterns[digit].forEach((row, rowIndex) => {
      row.forEach((filled, columnIndex) => {
        if (!filled) return;
        const square = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.1), material);
        square.position.set((digitIndex * 11 - 5.5) + columnIndex * 2.8 - 2.8, 8 - rowIndex * 3.3, 0);
        group.add(square);
      });
    });
  });
  return group;
}

function createApronAndBuildings(scene: THREE.Scene): void {
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(390, 420), shadowMaterial(0x737b7c, 0.86));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(230, 0.025, 130);
  apron.receiveShadow = true;
  scene.add(apron);

  const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(42, 220), shadowMaterial(0x454d50, 0.9));
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.rotation.z = Math.PI / 2;
  taxiway.position.set(105, 0.04, 250);
  scene.add(taxiway);

  const hangarColors = [0xc6d3d6, 0xaabdc2, 0xd2d7d4];
  const hangarPositions: Array<[number, number, number, number]> = [
    [175, 22, 250, 0],
    [255, 20, 245, 0],
    [330, 18, 235, 0],
  ];
  hangarPositions.forEach(([x, height, z, index]) => {
    const hangar = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(58, height, 48), shadowMaterial(hangarColors[index]));
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(30, 30, 58, 16, 1, false, 0, Math.PI),
      shadowMaterial(0x61727a, 0.7),
    );
    roof.rotation.z = Math.PI / 2;
    roof.position.y = height;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(42, height - 3), shadowMaterial(0x30404a));
    door.position.set(0, height / 2, -24.01);
    hangar.add(body, roof, door);
    hangar.position.set(x, 0, z);
    scene.add(hangar);
  });

  const terminal = new THREE.Group();
  const terminalBody = new THREE.Mesh(new THREE.BoxGeometry(150, 18, 42), shadowMaterial(0xd8dde0));
  terminalBody.position.y = 9;
  terminalBody.castShadow = true;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(142, 6, 0.5), shadowMaterial(0x23475b, 0.25));
  windows.position.set(0, 10, -21.1);
  terminal.add(terminalBody, windows);
  terminal.position.set(260, 0, 85);
  scene.add(terminal);

  const tower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 8, 54, 10), shadowMaterial(0xc0c8c9));
  stem.position.y = 27;
  stem.castShadow = true;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(13, 10, 8, 10), shadowMaterial(0x244758, 0.25));
  cab.position.y = 57;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.5, 10), shadowMaterial(0xe28d37));
  roof.position.y = 61.8;
  tower.add(stem, cab, roof);
  tower.position.set(155, 0, 55);
  scene.add(tower);

  for (let index = 0; index < 16; index += 1) {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(18 + (index % 3) * 7, 8 + (index % 5) * 5, 18 + (index % 2) * 8),
      shadowMaterial(index % 2 ? 0xb7c1c1 : 0x9faeae),
    );
    building.position.set(430 + (index % 4) * 42, building.geometry.parameters.height / 2, -40 + Math.floor(index / 4) * 55);
    building.castShadow = true;
    scene.add(building);
  }
}

function createLandscape(scene: THREE.Scene): void {
  const mountainMaterial = shadowMaterial(0x58705d, 1);
  for (let index = 0; index < 34; index += 1) {
    const angle = (index / 34) * Math.PI * 2;
    const distance = 1200 + Math.sin(index * 2.17) * 190;
    const height = 120 + (index % 7) * 38;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(150 + (index % 5) * 34, height, 7), mountainMaterial);
    mountain.position.set(Math.cos(angle) * distance, height / 2 - 8, Math.sin(angle) * distance);
    mountain.rotation.y = index * 0.77;
    scene.add(mountain);
  }

  const trunkMaterial = shadowMaterial(0x5a4533, 1);
  const crownMaterial = shadowMaterial(0x3f6545, 1);
  const trunkGeometry = new THREE.CylinderGeometry(0.6, 0.9, 5, 6);
  const crownGeometry = new THREE.ConeGeometry(4, 11, 7);
  for (let index = 0; index < 90; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (100 + ((index * 73) % 680));
    const z = -900 + ((index * 127) % 1800);
    if (x > 70 && x < 560 && z > -130 && z < 380) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2.5;
    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.position.y = 9;
    tree.add(trunk, crown);
    tree.position.set(x, 0, z);
    const scale = 0.75 + (index % 5) * 0.12;
    tree.scale.setScalar(scale);
    scene.add(tree);
  }
}
