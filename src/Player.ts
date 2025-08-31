import * as THREE from "three";
import { getRapier } from "./physics.js";

export default class Player {
  mesh: THREE.Mesh;
  body: any;
  world: any;

  private moveSpeed = 6;
  private sprintSpeed = 12;
  private jumpForce = 10;
  private isGrounded = false;
  private keys: Record<string, boolean> = {};
  private canJump = true;
  private camera?: THREE.Camera;
  private crosshair?: HTMLElement;

  constructor(scene: THREE.Scene, world: any) {
    this.world = world;

    // Player mesh (capsule for FPS) - make it invisible for true FPS
    const geometry = new THREE.CapsuleGeometry(0.4, 1, 8, 16);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.0  // Make invisible for FPS view
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 2, 0);
    scene.add(this.mesh);

    // Player rigid body (capsule)
    const RAPIER = getRapier();
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 2, 0)
      .lockRotations();
    this.body = world.createRigidBody(bodyDesc);

    // Capsule: halfHeight = 0.5, radius = 0.4
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setFriction(0.2);
    world.createCollider(colliderDesc, this.body);

    this.setupInput();
    this.createCrosshair();
  }

  private setupInput(): void {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      
      // Debug key presses (remove this later)
      if (e.code === "Space") console.log("🔑 Space pressed");
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") console.log("🔑 Shift pressed");
    });
    
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "Space" || e.code === "Numpad0") {
        this.canJump = true;
        console.log("🔑 Space released - can jump again");
      }
    });

    // Mouse controls for shooting
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0 && document.pointerLockElement) { // Left click
        this.shoot();
      }
    });
  }

  private createCrosshair(): void {
    this.crosshair = document.createElement('div');
    this.crosshair.style.position = 'fixed';
    this.crosshair.style.top = '50%';
    this.crosshair.style.left = '50%';
    this.crosshair.style.width = '4px';
    this.crosshair.style.height = '4px';
    this.crosshair.style.backgroundColor = 'white';
    this.crosshair.style.transform = 'translate(-50%, -50%)';
    this.crosshair.style.borderRadius = '50%';
    this.crosshair.style.pointerEvents = 'none';
    this.crosshair.style.zIndex = '1000';
    document.body.appendChild(this.crosshair);
  }

  private shoot(): void {
    // Simple shooting for now - just log to console
    if (this.camera) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      
      // TODO: Check for hits against other players/objects
      console.log(`🔫 Fired!`);
    }
  }

  // Set camera reference for movement direction
  setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  update() {
    // --- Movement relative to camera direction ---
    const direction = new THREE.Vector3();
    
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) direction.z -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) direction.z += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) direction.x -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) direction.x += 1;
    
    direction.normalize();
    
    // Apply camera rotation to movement direction
    if (this.camera && direction.length() > 0) {
      direction.applyQuaternion(this.camera.quaternion);
      direction.y = 0; // Keep movement horizontal
      direction.normalize();
    }

    // Check if grounded (raycast down)
    const pos = this.body.translation();
    const rayOrigin = { x: pos.x, y: pos.y - 0.6, z: pos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const RAPIER = getRapier();
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const hit = this.world.castRay(ray, 0.15, true);
    this.isGrounded = !!(hit && hit.toi !== undefined);

    // Jump (only once per key press)
    const spacePressed = this.keys["Space"] || this.keys["Numpad0"];
    
    if (this.isGrounded && spacePressed && this.canJump) {
      console.log("🚀 Jumping!");
      this.body.setLinvel(
        { x: this.body.linvel().x, y: this.jumpForce, z: this.body.linvel().z },
        true
      );
      this.canJump = false;
    }
    
    // Debug info (remove this later)
    if (spacePressed && !this.canJump) {
      console.log("⏳ Jump on cooldown");
    }
    if (spacePressed && !this.isGrounded) {
      console.log("🌍 Not grounded");
    }

    // Set horizontal velocity (with sprint)
    const isSprintPressed = this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    const speed = isSprintPressed ? this.sprintSpeed : this.moveSpeed;
    
    // Debug sprint (remove this later)
    if (isSprintPressed && direction.length() > 0) {
      console.log("🏃 Sprinting at speed:", speed);
    }
    
    const targetVel = { 
      x: direction.x * speed, 
      y: this.body.linvel().y, 
      z: direction.z * speed 
    };
    this.body.setLinvel(targetVel, true);

    // Sync mesh with physics
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
  }
}