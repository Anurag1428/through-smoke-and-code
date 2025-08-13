// src/PlayerController.ts
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";

export class PlayerController {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private mesh!: THREE.Mesh; // Added definite assignment assertion

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
  private airControl = 0.3; // Reduced air control for more realistic movement

  // Input state
  private keys: { [key: string]: boolean } = {};
  private mouseMovement = { x: 0, y: 0 };
  private isGrounded = false;
  private groundCheckDistance = 0.1;

  // Camera integration
  private camera: THREE.Camera | null = null;
  private cameraHeight = 1.6; // Eye height from ground
  private mouseSensitivity = 0.002;

  // Jump timing
  private jumpCooldown = 0;
  private coyoteTime = 0.1; // Time after leaving ground where you can still jump
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
    this.mass = options.mass || 70.0; // kg
    this.position = options.position || new THREE.Vector3(0, 5, 0);

    // Create visual representation (optional - can be invisible for FPS)
    this.createMesh(scene);

    // Create physics body and collider
    this.createPhysicsBody();

    // Setup input handling
    this.setupInput();

    console.log("PlayerController initialized with WASD + Space controls");
  }

  private createMesh(scene: THREE.Scene) {
    // Create a capsule-like visual (cylinder + spheres)
    const geometry = new THREE.CapsuleGeometry(this.radius, this.height - 2 * this.radius, 8, 16);
    const material = new THREE.MeshLambertMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.1 // Very transparent for FPS view
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  private createPhysicsBody() {
    // Create dynamic rigid body
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.position.x, this.position.y, this.position.z)
      .lockRotations() // Lock rotations for FPS character - prevents tipping over
      .setCcdEnabled(true); // Enable continuous collision detection for fast movement

    this.body = this.world.createRigidBody(bodyDesc);

    // Create capsule collider (better for character movement than box)
    const halfHeight = (this.height / 2) - this.radius;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, this.radius)
      .setFriction(this.friction)
      .setRestitution(0.0) // No bounce
      .setDensity(this.mass / (Math.PI * this.radius * this.radius * this.height));

    // Create collider without storing it as a property (since it's unused)
    this.world.createCollider(colliderDesc, this.body);

    console.log(`✅ Player physics: height=${this.height}m, radius=${this.radius}m, mass=${this.mass}kg`);
  }

  private setupInput() {
    console.log("Setting up input handlers for WASD + Space...");

    // Keyboard input
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;

      // Prevent default for game keys to stop page scrolling etc
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      // Debug key presses
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        console.log(`Key pressed: ${e.code}`);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    // Mouse input for looking around
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === document.body) {
        this.mouseMovement.x += e.movementX || 0;
        this.mouseMovement.y += e.movementY || 0;
      }
    };

    // Pointer lock for FPS controls
    const handleClick = () => {
      if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock?.();
      }
    };

    // Clear keys on focus loss to prevent stuck keys
    const handleFocusLoss = () => {
      this.keys = {};
      console.log("Focus lost, clearing all keys");
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    window.addEventListener('blur', handleFocusLoss);

    // Store references for cleanup
    (this as any).eventListeners = {
      handleKeyDown,
      handleKeyUp,
      handleMouseMove,
      handleClick,
      handleFocusLoss
    };

    console.log("✅ Input handlers set up successfully");
  }

  /**
   * Update player physics and movement
   */
  update(deltaTime: number) {
    // Update timers
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);

    // Check if grounded and update coyote time
    this.checkGrounded();
    if (this.isGrounded) {
      this.coyoteTimer = this.coyoteTime;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - deltaTime);
    }

    this.handleMovement(deltaTime);
    this.updateCameraPosition();
    this.syncMeshWithBody();

    // Reset mouse movement for next frame
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  private checkGrounded() {
    // Cast a ray downward to check if player is on ground
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
    const force = new THREE.Vector3(0, 0, 0);

    // Get camera direction for movement relative to view
    let forward = new THREE.Vector3(0, 0, -1);
    let right = new THREE.Vector3(1, 0, 0);

    if (this.camera) {
      this.camera.getWorldDirection(forward);
      forward.y = 0; // Keep movement horizontal only
      forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
      right.normalize();
    }

    // Calculate movement force based on whether we're grounded or in air
    const isMovingHorizontally = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
    const moveForceMultiplier = this.isGrounded ? 1.0 : this.airControl;
    const baseForce = this.moveSpeed * deltaTime * 120 * moveForceMultiplier;

    // Apply movement forces
    if (this.keys['KeyW']) {
      force.add(forward.clone().multiplyScalar(baseForce));
    }
    if (this.keys['KeyS']) {
      force.add(forward.clone().multiplyScalar(-baseForce));
    }
    if (this.keys['KeyA']) {
      force.add(right.clone().multiplyScalar(-baseForce));
    }
    if (this.keys['KeyD']) {
      force.add(right.clone().multiplyScalar(baseForce));
    }

    // Apply horizontal movement force with speed limiting
    if (force.length() > 0) {
      const horizontalSpeed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);

      // Only apply force if not exceeding max speed or if we're trying to slow down
      const desiredDirection = new THREE.Vector3(force.x, 0, force.z).normalize();
      const currentDirection = new THREE.Vector3(currentVel.x, 0, currentVel.z).normalize();
      const dot = desiredDirection.dot(currentDirection);

      if (horizontalSpeed < this.maxSpeed || dot < 0.5) {
        this.body.applyForce({ x: force.x, y: 0, z: force.z }, true);
      }
    }

    // Jumping - allow jump if grounded or within coyote time
    if (this.keys['Space'] && (this.isGrounded || this.coyoteTimer > 0) && this.jumpCooldown <= 0) {
      this.body.applyImpulse({ x: 0, y: this.jumpForce, z: 0 }, true);
      this.jumpCooldown = 0.1; // Prevent double jumping
      this.coyoteTimer = 0; // Use up coyote time
      console.log("Jump applied!");
    }

    // Apply friction/air resistance when not moving
    if (!isMovingHorizontally) {
      const dampingForce = this.isGrounded ? 0.85 : 0.95; // Less damping in air
      this.body.setLinvel({
        x: currentVel.x * dampingForce,
        y: currentVel.y,
        z: currentVel.z * dampingForce
      }, true);
    }

    // Limit falling speed to prevent going through ground
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

    // Apply mouse look with improved sensitivity
    if (document.pointerLockElement === document.body && this.camera instanceof THREE.PerspectiveCamera) {
      const sensitivity = this.mouseSensitivity;
      this.camera.rotation.y -= this.mouseMovement.x * sensitivity;
      this.camera.rotation.x -= this.mouseMovement.y * sensitivity;

      // Limit vertical look to prevent camera flipping
      this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));

      // Ensure rotation order to prevent gimbal lock
      this.camera.rotation.order = 'YXZ';
    }
  }

  private syncMeshWithBody() {
    const position = this.body.translation();
    const rotation = this.body.rotation();

    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  /**
   * Attach camera to player for FPS view
   */
  attachCamera(camera: THREE.Camera) {
    this.camera = camera;
    console.log("✅ Camera attached to player");
  }

  /**
   * Get current player position
   */
  getPosition(): THREE.Vector3 {
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  /**
   * Get current player velocity
   */
  getVelocity(): THREE.Vector3 {
    const vel = this.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }

  /**
   * Set player position (for respawning, etc.)
   */
  setPosition(position: THREE.Vector3) {
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    console.log(`Player teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  }

  /**
   * Check if player is on ground
   */
  isPlayerGrounded(): boolean {
    return this.isGrounded;
  }

  /**
   * Apply external force to player (for knockback, wind, etc.)
   */
  applyForce(force: THREE.Vector3) {
    this.body.applyForce({ x: force.x, y: force.y, z: force.z }, true);
  }

  /**
   * Apply impulse to player (for instant velocity change)
   */
  applyImpulse(impulse: THREE.Vector3) {
    this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }

  /**
   * Get the physics body (for collision detection, etc.)
   */
  getBody(): RAPIER.RigidBody {
    return this.body;
  }

  /**
   * Get the mesh (for rendering, raycasting, etc.)
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Set movement speed
   */
  setMoveSpeed(speed: number) {
    this.moveSpeed = speed;
    console.log(`Movement speed set to: ${speed}`);
  }

  /**
   * Set jump force
   */
  setJumpForce(force: number) {
    this.jumpForce = force;
    console.log(`Jump force set to: ${force}`);
  }

  /**
   * Get current input state for debugging
   */
  getInputState(): { [key: string]: boolean } {
    return { ...this.keys };
  }

  /**
   * Reset player state (for respawning)
   */
  reset(position?: THREE.Vector3) {
    const resetPos = position || new THREE.Vector3(0, 5, 0);
    this.setPosition(resetPos);
    this.keys = {};
    this.jumpCooldown = 0;
    this.coyoteTimer = 0;
    console.log("Player state reset");
  }

  /**
   * Cleanup - remove event listeners and physics body
   */
  dispose() {
    console.log("Disposing PlayerController...");

    // Remove event listeners
    if ((this as any).eventListeners) {
      const listeners = (this as any).eventListeners;
      document.removeEventListener('keydown', listeners.handleKeyDown);
      document.removeEventListener('keyup', listeners.handleKeyUp);
      document.removeEventListener('mousemove', listeners.handleMouseMove);
      document.removeEventListener('click', listeners.handleClick);
      window.removeEventListener('blur', listeners.handleFocusLoss);
    }

    // Remove physics body
    if (this.body && this.world) {
      this.world.removeRigidBody(this.body);
    }

    // Remove mesh from scene
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    console.log("✅ PlayerController disposed");
  }
}
