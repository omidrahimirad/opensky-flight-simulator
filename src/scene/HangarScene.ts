import * as THREE from 'three';
import type { AircraftDefinition } from '../types';
import { animateAircraftParts, createAircraft, disposeObject } from './aircraftFactory';

export class HangarScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 250);
  private readonly renderer: THREE.WebGLRenderer;
  private aircraft: THREE.Group | null = null;
  private raf = 0;
  private lastTime = 0;
  private displayMode: 'menu' | 'selection' = 'menu';
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement, definition: AircraftDefinition) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x07131d);
    this.scene.fog = new THREE.Fog(0x07131d, 30, 95);

    this.buildHangar();
    this.setAircraft(definition);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.animate(0);
  }

  setMode(mode: 'menu' | 'selection'): void {
    this.displayMode = mode;
  }

  setAircraft(definition: AircraftDefinition): void {
    if (this.aircraft) {
      this.scene.remove(this.aircraft);
      disposeObject(this.aircraft);
    }
    this.aircraft = createAircraft(definition);
    this.aircraft.position.set(3.5, 1.65, 0);
    this.aircraft.rotation.y = -0.62;
    this.scene.add(this.aircraft);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    if (this.aircraft) disposeObject(this.aircraft);
  }

  private buildHangar(): void {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x263039, roughness: 0.78, metalness: 0.08 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 80), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(80, 40, 0x466174, 0x243746);
    grid.position.y = 0.015;
    this.scene.add(grid);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x111d27, roughness: 0.8 });
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(64, 24, 0.6), wallMaterial);
    rearWall.position.set(0, 12, -14);
    rearWall.receiveShadow = true;
    this.scene.add(rearWall);

    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x304454, metalness: 0.45, roughness: 0.5 });
    for (let x = -26; x <= 26; x += 13) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 20, 0.45), beamMaterial);
      beam.position.set(x, 10, -13.2);
      this.scene.add(beam);
    }
    for (let y = 4; y <= 20; y += 4) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(55, 0.32, 0.4), beamMaterial);
      beam.position.set(0, y, -13.05);
      this.scene.add(beam);
    }

    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 16),
      new THREE.MeshBasicMaterial({ color: 0x163c4c }),
    );
    doorGlow.position.set(0, 8, -13);
    this.scene.add(doorGlow);

    const ambient = new THREE.HemisphereLight(0x89c8e6, 0x17202a, 1.65);
    const sun = new THREE.DirectionalLight(0xffe0ae, 3.4);
    sun.position.set(-8, 18, -8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    const rim = new THREE.PointLight(0x33c7b7, 90, 28);
    rim.position.set(12, 8, 7);
    const warm = new THREE.PointLight(0xf2a93b, 70, 24);
    warm.position.set(-14, 5, 8);
    this.scene.add(ambient, sun, rim, warm);
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000 || 0, 0.05);
    this.lastTime = time;
    if (this.aircraft) {
      animateAircraftParts(this.aircraft, dt * 12);
      const targetRotation = this.displayMode === 'selection' ? -0.25 + Math.sin(time * 0.00035) * 0.25 : -0.62;
      this.aircraft.rotation.y += (targetRotation - this.aircraft.rotation.y) * Math.min(1, dt * 2.4);
      this.aircraft.position.y = 1.65 + Math.sin(time * 0.0012) * (this.displayMode === 'selection' ? 0.05 : 0);
    }

    const targetPosition =
      this.displayMode === 'selection' ? new THREE.Vector3(0, 7.1, 22) : new THREE.Vector3(-2.5, 6.2, 24);
    this.camera.position.lerp(targetPosition, Math.min(1, dt * 2.2));
    this.camera.lookAt(this.displayMode === 'selection' ? 1.5 : 2.5, 2.1, 0);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.animate);
  };
}
