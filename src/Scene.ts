// src/Scene.ts
import * as THREE from 'three';
import { createArenaFloor, createArenaWalls, createCrate, createBuilding, ARENA_SIZE } from './map/MapGenerator.js';

export class CustomScene extends THREE.Scene {
  private meshes: THREE.Object3D[] = [];
  private lights: THREE.Light[] = [];

  constructor(private world: any) {
    super();
    console.log("🏗️ Creating CustomScene...");
    this.setupDefaultLighting();
    this.createMap();
    console.log("✅ CustomScene created with", this.meshes.length, "meshes");
  }

  addMesh(mesh: THREE.Object3D): void {
    this.meshes.push(mesh);
    this.add(mesh);
  }

  addLight(light: THREE.Light): void {
    this.lights.push(light);
    this.add(light);
  }

  setupDefaultLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(50, 80, 50);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    this.addLight(ambient);
    this.addLight(dir);
  }

  private createMap(): void {
    // Floor
    const floor = createArenaFloor(this, this.world);
    this.addMesh(floor);

    // Walls
    const walls = createArenaWalls(this, this.world);
    for (const w of walls) {
      this.addMesh(w);
    }

    // Crates
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * (ARENA_SIZE - 20);
      const z = (Math.random() - 0.5) * (ARENA_SIZE - 20);
      const crate = createCrate(this, this.world, x, z);
      this.addMesh(crate);
    }

    // Buildings
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * (ARENA_SIZE - 40);
      const z = (Math.random() - 0.5) * (ARENA_SIZE - 40);
      const building = createBuilding(this, this.world, x, z);
      this.addMesh(building);
    }
  }


}
