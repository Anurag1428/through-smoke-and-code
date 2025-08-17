// main.ts - FPS Game with GLB World Loading
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerController } from "./Player";

class FPSGame {
  private scene: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private gltfLoader: GLTFLoader;

  // Physics
  private RAPIER: any;
  private world: any;
  private player: PlayerController | null = null;

  // Game objects
  private worldModel: THREE.Group | null = null;
  private collectibles: THREE.Mesh[] = [];

  // FIXED: Add proper time tracking
  private lastTime: number = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();
    this.setupRenderer();
    this.setupCamera();
    this.setupScene();
  }

  private setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Enhanced rendering
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    try {
      (this.renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      console.log("Color space setting not available");
    }

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    document.body.appendChild(this.renderer.domElement);
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.backgroundColor = "#000";
  }

  private setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Initial camera position (will be controlled by player)
    this.camera.position.set(0, 5, 10);
  }

  private setupScene() {
    // Add fog for atmosphere
    this.scene.fog = new THREE.Fog(0x202020, 10, 100);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 20, 10);
    directionalLight.castShadow = true;

    // Enhanced shadow settings
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.bias = -0.0005;

    this.scene.add(directionalLight);

    // Additional fill lighting
    const fillLight = new THREE.DirectionalLight(0x4444ff, 0.2);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Handle window resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async init() {
    try {
      console.log("Initializing FPS Game with GLB World...");

      // Load and initialize Rapier physics
      // @ts-ignore
      this.RAPIER = await import("@dimforge/rapier3d-compat");
      await this.RAPIER.init();

      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      this.world = new this.RAPIER.World(gravity);

      console.log("✅ Physics initialized");

      // Load GLB world model FIRST
      await this.loadGLBWorld();

      // Create collectibles (optional - can be removed if not needed)
      this.createCollectibles();

      // Create player
      this.createPlayer();

      // Setup UI
      this.setupUI();

      console.log("✅ Game initialized successfully with GLB world!");

      // Initialize time tracking
      this.lastTime = performance.now();

      // Start game loop
      this.gameLoop();
    } catch (error) {
      console.error("❌ Failed to initialize game:", error);
    }
  }

  private async loadGLBWorld(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("Loading GLB world model...");

      // Replace 'path/to/your/world.glb' with the actual path to your GLB file
      // You can either:
      // 1. Put the GLB file in your public folder and reference it like '/world.glb'
      // 2. Import it and use the imported path
      // 3. Load it from a URL
      
      // const glbPath = '/world.glb'; // <<<< CHANGE THIS TO YOUR GLB FILE PATH
      const glbPath = '/public/Anurag_Platform.glb'
      
      this.gltfLoader.load(
        glbPath,
        (gltf) => {
          console.log("✅ GLB world loaded successfully!");
          
          this.worldModel = gltf.scene;
          
          // Scale the model if needed (adjust as necessary)
          this.worldModel.scale.set(1, 1, 1);
          
          // Position the model
          this.worldModel.position.set(0, 0, 0);
          
          // Enable shadows for all meshes in the model
          this.worldModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Ensure materials work with shadows
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(material => {
                    if (material instanceof THREE.MeshStandardMaterial || 
                        material instanceof THREE.MeshPhongMaterial ||
                        material instanceof THREE.MeshLambertMaterial) {
                      material.needsUpdate = true;
                    }
                  });
                } else if (child.material instanceof THREE.MeshStandardMaterial || 
                          child.material instanceof THREE.MeshPhongMaterial ||
                          child.material instanceof THREE.MeshLambertMaterial) {
                  child.material.needsUpdate = true;
                }
              }
            }
          });
          
          // Add the model to the scene
          this.scene.add(this.worldModel);
          
          // Create physics colliders for the world
          this.createWorldPhysics();
          
          console.log("✅ GLB world added to scene with physics");
          resolve();
        },
        (progress) => {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading GLB world: ${percentComplete.toFixed(1)}%`);
        },
        (error) => {
          console.error("❌ Failed to load GLB world:", error);
          console.log("Creating fallback world...");
          this.createFallbackWorld();
          resolve(); // Continue with fallback instead of rejecting
        }
      );
    });
  }

  private createWorldPhysics() {
    if (!this.worldModel) return;

    console.log("Creating physics colliders for GLB world...");

    // Method 1: Create physics from geometry (more accurate but complex)
    this.worldModel.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        this.createMeshCollider(child);
      }
    });

    // Method 2: If you want simpler box colliders, uncomment this instead:
    // this.createSimpleWorldColliders();
  }

  private createMeshCollider(mesh: THREE.Mesh) {
    // Get world position and rotation
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

    // Create physics body
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed()
      .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
      .setRotation(worldQuaternion);

    const body = this.world.createRigidBody(bodyDesc);

    // For complex geometry, you might want to use simplified shapes
    // This creates a trimesh collider (exact geometry)
    if (mesh.geometry.index) {
      const positions = mesh.geometry.attributes.position.array;
      const indices = mesh.geometry.index.array;
      
      // Scale positions by world scale
      const scaledPositions = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        scaledPositions[i] = positions[i] * worldScale.x;
        scaledPositions[i + 1] = positions[i + 1] * worldScale.y;
        scaledPositions[i + 2] = positions[i + 2] * worldScale.z;
      }
      
      try {
        const colliderDesc = this.RAPIER.ColliderDesc.trimesh(scaledPositions, indices)
          .setFriction(0.8)
          .setRestitution(0.1);
        
        this.world.createCollider(colliderDesc, body);
        console.log(`✅ Created trimesh collider for ${mesh.name || 'unnamed mesh'}`);
      } catch (error) {
        console.warn(`Failed to create trimesh collider, using bounding box instead:`, error);
        this.createBoundingBoxCollider(mesh, body, worldScale);
      }
    } else {
      // Fallback to bounding box
      this.createBoundingBoxCollider(mesh, body, worldScale);
    }
  }

  private createBoundingBoxCollider(mesh: THREE.Mesh, body: any, worldScale: THREE.Vector3) {
    // Create a bounding box collider as fallback
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const size = boundingBox.getSize(new THREE.Vector3());
    
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
      (size.x * worldScale.x) / 2,
      (size.y * worldScale.y) / 2,
      (size.z * worldScale.z) / 2
    ).setFriction(0.8).setRestitution(0.1);
    
    this.world.createCollider(colliderDesc, body);
    console.log(`✅ Created bounding box collider for ${mesh.name || 'unnamed mesh'}`);
  }

  private createSimpleWorldColliders() {
    // Alternative: Create simple colliders based on bounding boxes
    if (!this.worldModel) return;
    
    const boundingBox = new THREE.Box3().setFromObject(this.worldModel);
    const size = boundingBox.getSize(new THREE.Vector3());
    const center = boundingBox.getCenter(new THREE.Vector3());
    
    // Create a large ground plane
    const groundBodyDesc = this.RAPIER.RigidBodyDesc.fixed()
      .setTranslation(center.x, boundingBox.min.y, center.z);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = this.RAPIER.ColliderDesc.cuboid(size.x / 2, 0.1, size.z / 2)
      .setFriction(0.8);
    this.world.createCollider(groundColliderDesc, groundBody);
    
    console.log("✅ Created simple world colliders");
  }

  private createFallbackWorld() {
    console.log("Creating fallback world...");
    
    // Create a simple ground plane as fallback
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5d4a });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Create physics for fallback ground
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(25, 0.1, 25)
      .setFriction(0.8);
    this.world.createCollider(colliderDesc, body);
    
    console.log("✅ Fallback world created");
  }

  private createCollectibles() {
    console.log("Creating collectibles...");

    const collectiblePositions = [
      [5, 2, 3], [-5, 2, -3], [10, 2, -8], [-10, 6, 12],
      [0, 8, -20], [20, 5, 20], [-15, 8, 15], [12, 2, -12],
    ];

    const collectibleMaterial = new THREE.MeshLambertMaterial({
      color: 0xffaa00,
      emissive: 0x221100,
    });

    collectiblePositions.forEach((pos) => {
      const collectibleGeometry = new THREE.SphereGeometry(0.3, 12, 8);
      const collectible = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
      collectible.position.set(pos[0], pos[1], pos[2]);
      collectible.castShadow = true;
      this.scene.add(collectible);
      this.collectibles.push(collectible);
    });
  }

  private createPlayer() {
    console.log("Creating FPS player...");

    // Find a good spawn position
    let spawnPosition = new THREE.Vector3(0, 5, 0);
    
    if (this.worldModel) {
      // Try to spawn the player at a reasonable height above the world
      const boundingBox = new THREE.Box3().setFromObject(this.worldModel);
      spawnPosition.y = boundingBox.max.y + 2;
      console.log(`Spawning player at height: ${spawnPosition.y}`);
    }

    // Create player
    this.player = new PlayerController(this.world, this.scene, {
      height: 1.8,
      radius: 0.4,
      mass: 70,
      position: spawnPosition,
    });

    // Attach camera to player for FPS view
    this.player.attachCamera(this.camera);

    // Configure player settings
    this.player.setMouseSensitivity(0.003);
    this.player.setMoveSpeed(6);
    this.player.setJumpForce(12);
    this.player.setDebug(true);

    console.log("✅ FPS player created!");
  }

  private setupUI() {
    // Crosshair
    const crosshair = document.createElement("div");
    crosshair.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 4px;
      height: 4px;
      background: white;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 0 4px rgba(0,0,0,0.8);
    `;
    document.body.appendChild(crosshair);

    // Instructions
    const instructions = document.createElement("div");
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      color: white;
      font-family: monospace;
      font-size: 14px;
      z-index: 1000;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      background: rgba(0,0,0,0.5);
      padding: 10px;
      border-radius: 5px;
    `;
    instructions.innerHTML = `
      <strong>FPS Controls:</strong><br>
      • WASD - Move<br>
      • Mouse - Look around<br>
      • Space - Jump<br>
      • Shift - Walk (slower)<br>
      • Click to lock cursor<br>
      • ESC to unlock cursor<br>
      <small style="color: #888;">GLB World Loaded!</small>
    `;
    document.body.appendChild(instructions);

    // Player info
    const playerInfo = document.createElement("div");
    playerInfo.id = "playerInfo";
    playerInfo.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      color: white;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      background: rgba(0,0,0,0.5);
      padding: 10px;
      border-radius: 5px;
    `;
    document.body.appendChild(playerInfo);

    // ESC to exit pointer lock
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        document.exitPointerLock?.();
      }
    });
  }

  private updateUI() {
    if (!this.player) return;

    const playerInfo = document.getElementById("playerInfo");
    if (playerInfo) {
      const debug = this.player.getDebugInfo();

      playerInfo.innerHTML = `
        <strong>DEBUG INFO:</strong><br>
        Pos: ${debug.position.x}, ${debug.position.y}, ${debug.position.z}<br>
        Vel: ${debug.velocity.x}, ${debug.velocity.y}, ${debug.velocity.z}<br>
        Speed: ${debug.speed} u/s<br>
        Grounded: ${debug.grounded ? "✅" : "❌"}<br>
        Jump Ready: ${debug.jumpCooldown === "0.000" ? "✅" : "❌"}<br>
        Yaw: ${debug.yaw}° Pitch: ${debug.pitch}°<br>
        Keys: ${debug.activeKeys.join(', ') || 'None'}<br>
        GLB World: ${this.worldModel ? "✅" : "❌"}
      `;
    }
  }

  private animateCollectibles() {
    const time = this.clock.getElapsedTime();

    this.collectibles.forEach((collectible, index) => {
      const offset = index * 0.5;
      collectible.position.y += Math.sin(time * 3 + offset) * 0.005;
      collectible.rotation.y += 0.02;

      const intensity = 0.5 + Math.sin(time * 4 + offset) * 0.3;
      (collectible.material as THREE.MeshLambertMaterial).emissive.setScalar(
        intensity * 0.1
      );
    });
  }

  private gameLoop() {
    requestAnimationFrame(() => this.gameLoop());

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.02);
    this.lastTime = currentTime;

    // Step physics world
    this.world.step();

    // Update player
    if (this.player) {
      this.player.update(deltaTime);
    }

    // Animate collectibles
    this.animateCollectibles();

    // Update UI
    this.updateUI();

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    console.log("Disposing game...");

    if (this.player) {
      this.player.dispose();
    }

    if (this.world) {
      this.world.free();
    }

    this.renderer.dispose();
  }
}

// Initialize game
const game = new FPSGame();
game.init().catch(console.error);

// Handle page unload
window.addEventListener("beforeunload", () => {
  game.dispose();
});

// Expose game for debugging
(window as any).game = game;