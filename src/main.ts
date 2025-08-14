// main.ts - FIXED FPS Game with proper physics timing
import * as THREE from "three";
import { PlayerController } from "./Player";

class FPSGame {
  private scene: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  // Physics
  private RAPIER: any;
  private world: any;
  private player: PlayerController | null = null;

  // Game objects
  private ground: THREE.Mesh[] = [];
  private obstacles: THREE.Mesh[] = [];
  private collectibles: THREE.Mesh[] = [];

  // FIXED: Add proper time tracking
  private lastTime: number = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
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
      console.log("Initializing FPS Game...");

      // Load and initialize Rapier physics
      // @ts-ignore
      this.RAPIER = await import("@dimforge/rapier3d-compat");
      await this.RAPIER.init();

      const gravity = { x: 0.0, y: -9.81, z: 0.0 };
      this.world = new this.RAPIER.World(gravity);

      console.log("✅ Physics initialized");

      // Create game world
      this.createGround();
      this.createObstacles();
      this.createCollectibles();

      // Create player (this is the main focus)
      this.createPlayer();

      // Setup UI
      this.setupUI();

      console.log("✅ Game initialized successfully!");

      // FIXED: Initialize time tracking
      this.lastTime = performance.now();

      // Start game loop
      this.gameLoop();
    } catch (error) {
      console.error("❌ Failed to initialize game:", error);
    }
  }

  private createGround() {
    console.log("Creating ground...");

    // Main ground platform
    const mainGroundGeometry = new THREE.BoxGeometry(50, 1, 50);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5d4a });

    const mainGround = new THREE.Mesh(mainGroundGeometry, groundMaterial);
    mainGround.position.set(0, -0.5, 0);
    mainGround.receiveShadow = true;
    this.scene.add(mainGround);
    this.ground.push(mainGround);

    // Create physics body for ground
    const groundBodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = this.RAPIER.ColliderDesc.cuboid(25, 0.5, 25)
      .setFriction(0.8)
      .setRestitution(0.0);
    this.world.createCollider(groundColliderDesc, groundBody);

    // Create additional platforms for testing collision
    const platforms = [
      { pos: [15, 2, -10], size: [8, 1, 8] },
      { pos: [-15, 4, 10], size: [6, 1, 6] },
      { pos: [0, 6, -20], size: [4, 1, 4] },
      { pos: [20, 3, 20], size: [5, 1, 10] },
      // Add some ramps for testing
      { pos: [10, 1, 0], size: [3, 0.2, 6], rotation: [0, 0, 0.3] },
      { pos: [-10, 1, 0], size: [3, 0.2, 6], rotation: [0, 0, -0.3] },
    ];

    platforms.forEach((platformData) => {
      const platformGeometry = new THREE.BoxGeometry(
        ...platformData.size as [number, number, number]
      );
      const platform = new THREE.Mesh(platformGeometry, groundMaterial);
      platform.position.set(...platformData.pos as [number, number, number]);

      // Apply rotation if specified
      if (platformData.rotation) {
        platform.rotation.set(...platformData.rotation as [number, number, number]);
      }

      platform.receiveShadow = true;
      this.scene.add(platform);
      this.ground.push(platform);

      // Physics body
      const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(
        ...platformData.pos as [number, number, number]
      );

      if (platformData.rotation) {
        const euler = new THREE.Euler(...platformData.rotation as [number, number, number]);
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        bodyDesc.setRotation({
          x: quaternion.x,
          y: quaternion.y,
          z: quaternion.z,
          w: quaternion.w,
        });
      }

      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
        platformData.size[0] / 2,
        platformData.size[1] / 2,
        platformData.size[2] / 2
      ).setFriction(0.8);
      this.world.createCollider(colliderDesc, body);
    });
  }

  private createObstacles() {
    console.log("Creating obstacles...");

    const obstaclePositions = [
      [8, 1, 5], [-8, 1, -5], [12, 1, -15], [-12, 5, 10],
      [3, 1, 8], [-5, 1, -8], [18, 4, 20], [-18, 7, 15],
      [2, 1, 2], [-2, 1, -2], [6, 1, -6], [-6, 1, 6],
      [0, 1, 10], [0, 1, -10], [15, 1, 0], [-15, 1, 0],
    ];

    const obstacleMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });

    obstaclePositions.forEach((pos) => {
      const height = 2 + Math.random() * 3;
      const width = 0.8 + Math.random() * 1.2;

      const obstacleGeometry = new THREE.BoxGeometry(width, height, width);
      const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
      obstacle.position.set(pos[0], pos[1] + height / 2, pos[2]);
      obstacle.castShadow = true;
      obstacle.receiveShadow = true;
      this.scene.add(obstacle);
      this.obstacles.push(obstacle);

      // Physics body (static obstacles)
      const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(
        pos[0], pos[1] + height / 2, pos[2]
      );
      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
        width / 2, height / 2, width / 2
      ).setFriction(0.6);
      this.world.createCollider(colliderDesc, body);
    });

    // Add some dynamic physics objects for testing
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      const y = 5 + i * 2;

      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
      const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.set(x, y, z);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);

      // Dynamic physics body
      const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
        .setFriction(0.7)
        .setRestitution(0.3);
      this.world.createCollider(colliderDesc, body);

      // Store reference to sync with Three.js mesh
      (box as any).physicsBody = body;
      this.obstacles.push(box);
    }
  }

  private createCollectibles() {
    console.log("Creating collectibles...");

    const collectiblePositions = [
      [5, 2, 3], [-5, 2, -3], [10, 2, -8], [-10, 6, 12],
      [0, 8, -20], [20, 5, 20], [-15, 8, 15], [12, 2, -12],
      [3, 3, 0], [-3, 3, 0], [0, 3, 5], [0, 3, -5],
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
    console.log("Creating DEBUG FPS player with instant movement...");

    // Create player with capsule collider
    this.player = new PlayerController(this.world, this.scene, {
      height: 1.8, // 1.8m tall
      radius: 0.4, // 0.4m radius
      mass: 70, // 70kg
      position: new THREE.Vector3(0, 5, 0),
    });

    // Attach camera to player for FPS view
    this.player.attachCamera(this.camera);

    // MUCH MORE RESPONSIVE SETTINGS
    this.player.setMouseSensitivity(0.003); // More responsive mouse
    this.player.setMoveSpeed(6); // Reasonable speed for testing
    this.player.setJumpForce(12); // Good jump height

    // Enable debug mode
    this.player.setDebug(true);

    console.log("✅ DEBUG FPS player created with instant movement!");
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
      <strong>DEBUG FPS Controls:</strong><br>
      • WASD - Move (INSTANT)<br>
      • Mouse - Look around<br>
      • Space - Jump<br>
      • Shift - Walk (slower)<br>
      • Click to lock cursor<br>
      • ESC to unlock cursor<br>
      <small style="color: #888;">Check console for debug info</small>
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
        Time Since Ground: ${debug.timeSinceGrounded}s<br>
        Jump Pressed: ${debug.jumpPressed ? "✅" : "❌"}<br>
        Yaw: ${debug.yaw}° Pitch: ${debug.pitch}°<br>
        Keys: ${debug.activeKeys.join(', ') || 'None'}<br>
        Delta: ${this.clock.getDelta().toFixed(4)}s
      `;
    }
  }

  private animateCollectibles() {
    const time = this.clock.getElapsedTime();

    this.collectibles.forEach((collectible, index) => {
      const offset = index * 0.5;
      collectible.position.y += Math.sin(time * 3 + offset) * 0.005;
      collectible.rotation.y += 0.02;

      // Glow effect
      const intensity = 0.5 + Math.sin(time * 4 + offset) * 0.3;
      (collectible.material as THREE.MeshLambertMaterial).emissive.setScalar(
        intensity * 0.1
      );
    });
  }

  private updateDynamicObjects() {
    // Update dynamic physics objects to sync with their physics bodies
    this.obstacles.forEach((obstacle) => {
      const physicsBody = (obstacle as any).physicsBody;
      if (physicsBody) {
        const position = physicsBody.translation();
        const rotation = physicsBody.rotation();

        obstacle.position.set(position.x, position.y, position.z);
        obstacle.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }

  // FIXED: Much better game loop with proper timing
  private gameLoop() {
    requestAnimationFrame(() => this.gameLoop());

    // FIXED: Proper delta time calculation
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.02); // Cap at 50fps minimum
    this.lastTime = currentTime;

    // CRITICAL: Step physics world BEFORE updating player
    this.world.step();

    // Update player with proper deltaTime
    if (this.player) {
      this.player.update(deltaTime);
    }

    // Update dynamic objects
    this.updateDynamicObjects();

    // Animate game objects
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