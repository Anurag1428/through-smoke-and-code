// src/PlayerController.ts
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";

export class PlayerController {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private mesh!: THREE.Mesh;

  // Player properties
  private height: number;
  private radius: number;
  private mass: number;
  private position: THREE.Vector3;

  // Movement settings
  private moveSpeed = 10.0;
  private jumpForce = 15.0;
  private maxSpeed = 12.0;
  private friction = 0.85;
  private airControl = 0.3;

  // Input state
  private keys: { [key: string]: boolean } = {};
  private mouseMovement = { x: 0, y: 0 };
  private isGrounded = false;
  private groundCheckDistance = 0.1;

  // Camera integration
  private camera: THREE.Camera | null = null;
  private cameraHeight = 1.6;
  private mouseSensitivity = 0.002;

  // Jump timing
  private jumpCooldown = 0;
  private coyoteTime = 0.1;
  private coyoteTimer = 0;

  constructor(
    world: RAPIER.World,
    scene: THREE.Scene,
    options: {
      height?: number;
      radius?: number;
      mass?: number;
      position?: THREE.Vector3;
    } = {}
  ) {
    this.world = world;
    this.height = options.height || 1.8;
    this.radius = options.radius || 0.4;
    this.mass = options.mass || 70.0;
    this.position = options.position || new THREE.Vector3(0, 5, 0);

    this.createMesh(scene);
    this.createPhysicsBody();
    this.setupInput();

    console.log("PlayerController initialized with WASD + Space controls");
  }

  private createMesh(scene: THREE.Scene) {
    const geometry = new THREE.CapsuleGeometry(this.radius, this.height - 2 * this.radius, 8, 16);
    const material = new THREE.MeshLambertMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.1
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  private createPhysicsBody() {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.position.x, this.position.y, this.position.z)
      .lockRotations()
      .setCcdEnabled(true);

    this.body = this.world.createRigidBody(bodyDesc);

    const halfHeight = (this.height / 2) - this.radius;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, this.radius)
      .setFriction(this.friction)
      .setRestitution(0.0)
      .setDensity(this.mass / (Math.PI * this.radius * this.radius * this.height));

    this.world.createCollider(colliderDesc, this.body);

    console.log(`✅ Player physics: height=${this.height}m, radius=${this.radius}m, mass=${this.mass}kg`);
  }

  private setupInput() {
    console.log("Setting up input handlers for WASD + Space...");

    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;

      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        console.log(`Key pressed: ${e.code}`);
      }

      // Auto-request pointer lock when movement keys are pressed
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && 
          document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === document.body) {
        this.mouseMovement.x += e.movementX || 0;
        this.mouseMovement.y += e.movementY || 0;
      }
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock()
          .then(() => console.log("✅ Pointer lock acquired"))
          .catch(err => console.warn("Pointer lock failed:", err));
      }
    };

    // IMPROVED: Don't clear keys on blur, just log it
    const handleFocusLoss = () => {
      console.log("Focus lost - but keeping keys active");
      // Don't clear keys here - this was causing the issue
    };

    // Handle pointer lock changes
    const handlePointerLockChange = () => {
      if (document.pointerLockElement === document.body) {
        console.log("✅ Pointer locked successfully");
      } else {
        console.log("⚠️ Pointer lock lost");
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('blur', handleFocusLoss);

    (this as any).eventListeners = {
      handleKeyDown,
      handleKeyUp,
      handleMouseMove,
      handleClick,
      handleFocusLoss,
      handlePointerLockChange
    };

    console.log("✅ Input handlers set up successfully");
  }

  update(deltaTime: number) {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);

    this.checkGrounded();
    if (this.isGrounded) {
      this.coyoteTimer = this.coyoteTime;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - deltaTime);
    }

    this.handleMovement(deltaTime);
    this.updateCameraPosition();
    this.syncMeshWithBody();

    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  private checkGrounded() {
    const position = this.body.translation();
    const rayOrigin = { x: position.x, y: position.y - (this.height / 2) + this.radius, z: position.z };
    const rayDirection = { x: 0, y: -1, z: 0 };
    const maxDistance = this.groundCheckDistance + 0.05;

    const ray = new RAPIER.Ray(rayOrigin, rayDirection);
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, this.body);

    this.isGrounded = hit !== null;
  }

  private handleMovement(deltaTime: number) {
    const currentVel = this.body.linvel();
    
    // Get camera direction for movement relative to view
    let forward = new THREE.Vector3(0, 0, -1);
    let right = new THREE.Vector3(1, 0, 0);

    if (this.camera) {
      // Get camera's world direction
      this.camera.getWorldDirection(forward);
      forward.y = 0; // Keep movement horizontal only
      forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
      right.normalize();
    }

    // Calculate movement
    const movement = new THREE.Vector3(0, 0, 0);
    const moveSpeed = this.moveSpeed;

    if (this.keys['KeyW']) {
      movement.add(forward);
      console.log("Moving forward");
    }
    if (this.keys['KeyS']) {
      movement.sub(forward);
      console.log("Moving backward");
    }
    if (this.keys['KeyA']) {
      movement.sub(right);
      console.log("Moving left");
    }
    if (this.keys['KeyD']) {
      movement.add(right);
      console.log("Moving right");
    }

    // Normalize movement to prevent faster diagonal movement
    if (movement.length() > 0) {
      movement.normalize();
      
      // Apply movement force
      const force = movement.multiplyScalar(moveSpeed * deltaTime * 100);
      
      // Check current horizontal speed
      const horizontalSpeed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);
      
      if (horizontalSpeed < this.maxSpeed) {
        this.body.addForce({ x: force.x, y: 0, z: force.z }, true);
      }
    }

    // FIXED: Jumping logic
    if (this.keys['Space'] && this.isGrounded && this.jumpCooldown <= 0) {
      console.log("Attempting jump - grounded:", this.isGrounded);
      this.body.applyImpulse({ x: 0, y: this.jumpForce, z: 0 }, true);
      this.jumpCooldown = 0.2; // Longer cooldown to prevent double jumping
      console.log("Jump applied!");
    }

    // Apply friction when not moving
    if (movement.length() === 0) {
      const dampingForce = this.isGrounded ? 0.8 : 0.95;
      this.body.setLinvel({
        x: currentVel.x * dampingForce,
        y: currentVel.y, // Don't dampen Y velocity (gravity)
        z: currentVel.z * dampingForce
      }, true);
    }

    // Limit falling speed
    if (currentVel.y < -20) {
      this.body.setLinvel({
        x: currentVel.x,
        y: -20,
        z: currentVel.z
      }, true);
    }
  }

  private updateCameraPosition() {
    if (!this.camera) return;

    const bodyPos = this.body.translation();
    const cameraPos = new THREE.Vector3(
      bodyPos.x,
      bodyPos.y + this.cameraHeight - (this.height / 2),
      bodyPos.z
    );

    this.camera.position.copy(cameraPos);

    // Apply mouse look ONLY when pointer is locked
    if (document.pointerLockElement === document.body && this.camera instanceof THREE.PerspectiveCamera) {
      if (Math.abs(this.mouseMovement.x) > 0 || Math.abs(this.mouseMovement.y) > 0) {
        const sensitivity = this.mouseSensitivity;
        
        // Apply rotation
        this.camera.rotation.y -= this.mouseMovement.x * sensitivity;
        this.camera.rotation.x -= this.mouseMovement.y * sensitivity;

        // Limit vertical look to prevent camera flipping
        this.camera.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.camera.rotation.x));

        // Ensure rotation order
        this.camera.rotation.order = 'YXZ';
        
        console.log(`Camera rotation: x=${this.camera.rotation.x.toFixed(2)}, y=${this.camera.rotation.y.toFixed(2)}`);
      }
    }
  }

  private syncMeshWithBody() {
    const position = this.body.translation();
    const rotation = this.body.rotation();

    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  attachCamera(camera: THREE.Camera) {
    this.camera = camera;
    console.log("✅ Camera attached to player");
  }

  getPosition(): THREE.Vector3 {
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  getVelocity(): THREE.Vector3 {
    const vel = this.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }

  setPosition(position: THREE.Vector3) {
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    console.log(`Player teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  }

  isPlayerGrounded(): boolean {
    return this.isGrounded;
  }

  applyForce(force: THREE.Vector3) {
    this.body.addForce({ x: force.x, y: force.y, z: force.z }, true);
  }

  applyImpulse(impulse: THREE.Vector3) {
    this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }

  getBody(): RAPIER.RigidBody {
    return this.body;
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  setMoveSpeed(speed: number) {
    this.moveSpeed = speed;
    console.log(`Movement speed set to: ${speed}`);
  }

  setJumpForce(force: number) {
    this.jumpForce = force;
    console.log(`Jump force set to: ${force}`);
  }

  getInputState(): { [key: string]: boolean } {
    return { ...this.keys };
  }

  reset(position?: THREE.Vector3) {
    const resetPos = position || new THREE.Vector3(0, 5, 0);
    this.setPosition(resetPos);
    this.keys = {};
    this.jumpCooldown = 0;
    this.coyoteTimer = 0;
    console.log("Player state reset");
  }

  dispose() {
    console.log("Disposing PlayerController...");

    if ((this as any).eventListeners) {
      const listeners = (this as any).eventListeners;
      document.removeEventListener('keydown', listeners.handleKeyDown);
      document.removeEventListener('keyup', listeners.handleKeyUp);
      document.removeEventListener('mousemove', listeners.handleMouseMove);
      document.removeEventListener('click', listeners.handleClick);
      document.removeEventListener('pointerlockchange', listeners.handlePointerLockChange);
      window.removeEventListener('blur', listeners.handleFocusLoss);
    }

    if (this.body && this.world) {
      this.world.removeRigidBody(this.body);
    }

    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    console.log("✅ PlayerController disposed");
  }
}
