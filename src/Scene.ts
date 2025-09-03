// src/Scene.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createArenaFloor, createArenaWalls, createCrate, createBuilding, ARENA_SIZE } from './map/MapGenerator.js';

export class CustomScene extends THREE.Scene {
  private meshes: THREE.Object3D[] = [];
  private lights: THREE.Light[] = [];
  private gltfLoader: GLTFLoader;
  private mapModel?: THREE.Group;

  constructor(private world: any) {
    super();
    console.log("🏗️ Creating CustomScene...");
    this.gltfLoader = new GLTFLoader();
    this.setupDefaultLighting();
    this.loadMapModel();
    console.log("✅ CustomScene created");
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

  private async loadMapModel(): Promise<void> {
    try {
      console.log("🗺️ Loading 3D map model...");
      
      const gltf = await new Promise<any>((resolve, reject) => {
        this.gltfLoader.load(
          '/newtown__krunker_map__game_map.glb',
          (gltf) => resolve(gltf),
          (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
          },
          (error) => reject(error)
        );
      });

      // Add the loaded model to the scene
      this.mapModel = gltf.scene;
      this.mapModel.position.set(0, 0, 0);
      
      // Scale the model if needed (adjust as necessary)
      this.mapModel.scale.setScalar(1);
      
      // Enable shadows for the model
      this.mapModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Ensure materials are properly set up
          if (child.material) {
            child.material.needsUpdate = true;
          }
        }
      });

      this.addMesh(this.mapModel);
      console.log("✅ 3D map model loaded successfully!");
      
      // Create physics colliders for the model
      this.createModelPhysics();
      
    } catch (error) {
      console.error("❌ Failed to load 3D map model:", error);
      console.log("🔄 Falling back to procedural map...");
      this.createFallbackMap();
    }
  }

  private createModelPhysics(): void {
    if (!this.mapModel) return;
    
    console.log("🔧 Creating physics colliders for 3D model...");
    
    // For now, create a simple ground plane physics collider
    // You can enhance this later with more detailed collision meshes
    const RAPIER = (globalThis as any).RAPIER;
    if (RAPIER) {
      const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0);
      const groundBody = this.world.createRigidBody(groundBodyDesc);
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
      this.world.createCollider(groundColliderDesc, groundBody);
      console.log("✅ Basic ground physics created");
    }
  }

  private createFallbackMap(): void {
    console.log("🏗️ Creating fallback procedural map...");
    
    // Floor
    const floor = createArenaFloor(this, this.world);
    this.addMesh(floor);

    // Walls
    const walls = createArenaWalls(this, this.world);
    for (const w of walls) {
      this.addMesh(w);
    }

    // Some crates for cover
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * (ARENA_SIZE - 20);
      const z = (Math.random() - 0.5) * (ARENA_SIZE - 20);
      const crate = createCrate(this, this.world, x, z);
      this.addMesh(crate);
    }
  }


}
