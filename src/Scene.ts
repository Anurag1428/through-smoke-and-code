import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createTerrain, createHouse, createTree, createRock, heightAt, TERRAIN_SIZE } from './map/MapGenerator.js';

export class CustomScene extends THREE.Scene {
  private meshes: THREE.Object3D[] = [];
  private lights: THREE.Light[] = [];
  private terrainCollider?: any;

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
    console.log("➕ Added mesh:", mesh.type, "Total meshes:", this.meshes.length);
  }

  addLight(light: THREE.Light): void {
    this.lights.push(light);
    this.add(light);
    console.log("💡 Added light:", light.type);
  }

  setupDefaultLighting(): void {
    console.log("💡 Setting up lighting...");
    
    // Ambient light - make it brighter for debugging
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.addLight(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.addLight(directionalLight);
    
    console.log("✅ Lighting setup complete");
  }

  private createMap(): void {
    console.log("🗺️ Creating map...");
    
    try {
      // 1. Create terrain with debug material
      const terrain = this.createDebugTerrain();
      this.addMesh(terrain);

      // 2. Add some test objects first
      this.addTestObjects();

      // 3. Try physics if world exists
      if (this.world) {
        console.log("🔬 Setting up physics...");
        this.setupTerrainPhysics();
        // Only populate if physics works
        this.populateMap();
      } else {
        console.warn("⚠️ No physics world provided");
      }
      
    } catch (error) {
      console.error("❌ Error creating map:", error);
    }
  }

  // Debug terrain with simple material
  private createDebugTerrain(): THREE.Mesh {
    console.log("🌍 Creating debug terrain...");
    
    // Use the original terrain but with a simple material as fallback
    let terrain;
    try {
      terrain = createTerrain();
      console.log("✅ Original terrain created");
    } catch (error) {
      console.error("❌ Original terrain failed:", error);
      // Fallback: simple plane
      const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 32, 32);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0x4a7c59,
        wireframe: false 
      });
      terrain = new THREE.Mesh(geo, mat);
      console.log("✅ Fallback terrain created");
    }
    
    terrain.receiveShadow = true;
    return terrain;
  }

  // Add some test objects to verify rendering
  private addTestObjects(): void {
    console.log("🎯 Adding test objects...");
    
    // Test cube
    const testCube = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    testCube.position.set(10, 2, 10);
    testCube.castShadow = true;
    this.addMesh(testCube);

    // Test sphere  
    const testSphere = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x0000ff })
    );
    testSphere.position.set(-10, 2, -10);
    testSphere.castShadow = true;
    this.addMesh(testSphere);
    
    console.log("✅ Test objects added");
  }

  private setupTerrainPhysics(): void {
    try {
      console.log("🔧 Using simple box collider instead of heightfield...");
      // Use a simple box collider for the terrain instead of heightfield
      const terrainBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, -5, 0); // Position it below the terrain
      const terrainBody = this.world.createRigidBody(terrainBodyDesc);
      
      // Large box collider under the terrain
      const colliderDesc = RAPIER.ColliderDesc.cuboid(TERRAIN_SIZE / 2, 10, TERRAIN_SIZE / 2);
      this.terrainCollider = this.world.createCollider(colliderDesc, terrainBody);
      console.log("✅ Terrain physics setup complete with box collider");
    } catch (error) {
      console.error("❌ Terrain physics failed:", error);
    }
  }

  private populateMap(): void {
    console.log("🏠 Populating map...");
    
    try {
      // Fewer objects for debugging
      for (let i = 0; i < 5; i++) {
        const [x, z] = randomCircle(30);
        try {
          const house = createHouse(x, z);
          this.addMesh(house);
          addBoxCollider(this.world, house.position, { x: 4, y: 3, z: 4 });
        } catch (error) {
          console.error("❌ Failed to create house:", error);
        }
      }

      for (let i = 0; i < 20; i++) {
        const [x, z] = randomCircle(40);
        try {
          const tree = createTree(x, z);
          this.addMesh(tree);
        } catch (error) {
          console.error("❌ Failed to create tree:", error);
        }
      }
      
      console.log("✅ Map population complete");
    } catch (error) {
      console.error("❌ Map population failed:", error);
    }
  }

  clearScene(): void {
    this.meshes.forEach(mesh => {
      this.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        } else if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        }
      }
    });
    this.meshes = [];
    this.lights.forEach(light => this.remove(light));
    this.lights = [];
    this.terrainCollider?.remove();
    this.terrainCollider = undefined;
  }

  getWorld(): any { return this.world; }
  getMeshes(): THREE.Object3D[] { return [...this.meshes]; }
}

function addBoxCollider(world: any, pos: THREE.Vector3, half: { x: number; y: number; z: number }) {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y + half.y, pos.z);
  const body = world.createRigidBody(bodyDesc);
  world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), body);
}

function addSphereCollider(world: any, pos: THREE.Vector3, radius: number) {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y + radius, pos.z);
  const body = world.createRigidBody(bodyDesc);
  world.createCollider(RAPIER.ColliderDesc.ball(radius), body);
}

function randomCircle(radius: number): [number, number] {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return [Math.cos(a) * r, Math.sin(a) * r];
}