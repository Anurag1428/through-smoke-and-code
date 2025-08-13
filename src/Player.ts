// src/PlayerController.ts
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";

export class PlayerController {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private mesh: THREE.Mesh;
  
  // Player properties
  private height: number;
  private radius: number;
  private mass: number;
  private position: THREE.Vector3;
  
  // Movement settings
  private moveSpeed = 8.0;
  private jumpForce = 12.0;
  private maxSpeed = 10.0;
  private friction = 0.8;
  
  // Input state
  private keys: { [key: string]: boolean } = {};
  private mouseMovement = { x: 0, y: 0 };
  private isGrounded = false;
  
  // Camera integration
  private camera: THREE.Camera | null = null;
  private cameraHeight = 1.6; // Eye height from ground
  
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
  }
  
  private createMesh(scene: THREE.Scene) {
    // Create a capsule-like visual (cylinder + spheres)
    const geometry = new THREE.CapsuleGeometry(this.radius, this.height - 2 * this.radius, 8, 16);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3 // Semi-transparent for FPS view
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
      .lockRotations(); // Lock rotations for FPS character - prevents tipping over
    
    this.body = this.world.createRigidBody(bodyDesc);
    
    // Create capsule collider (better for character movement than box)
    const halfHeight = (this.height / 2) - this.radius;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, this.radius)
      .setFriction(this.friction)
      .setRestitution(0.0) // No bounce
      .setDensity(this.mass / (Math.PI * this.radius * this.radius * this.height));
    
    this.collider = this.world.createCollider(colliderDesc, this.body);
    
    console.log(`Player created: height=${this.height}m, radius=${this.radius}m, mass=${this.mass}kg`);
  }
  
  private setupInput() {
    // Keyboard input
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Prevent default for game keys
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    
    // Mouse input for looking around
    window.addEventListener('mousemove', (e) => {
      this.mouseMovement.x += e.movementX || 0;
      this.mouseMovement.y += e.movementY || 0;
    });
    
    // Pointer lock for FPS controls
    document.addEventListener('click', () => {
      document.body.requestPointerLock?.();
    });
  }
  
  /**
   * Update player physics and movement
   */
  update(deltaTime: number) {
    this.checkGrounded();
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
    const rayOrigin = { x: position.x, y: position.y, z: position.z };
    const rayDirection = { x: 0, y: -1, z: 0 };
    const maxDistance = this.radius + 0.1;
    
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
      forward.y = 0; // Keep movement horizontal
      forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    }
    
    // Calculate movement force
    const moveForce = this.moveSpeed * deltaTime * 100;
    
    if (this.keys['KeyW']) {
      force.add(forward.clone().multiplyScalar(moveForce));
    }
    if (this.keys['KeyS']) {
      force.add(forward.clone().multiplyScalar(-moveForce));
    }
    if (this.keys['KeyA']) {
      force.add(right.clone().multiplyScalar(-moveForce));
    }
    if (this.keys['KeyD']) {
      force.add(right.clone().multiplyScalar(moveForce));
    }
    
    // Apply horizontal movement force
    if (force.length() > 0) {
      const horizontalSpeed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);
      
      // Only apply force if not exceeding max speed
      if (horizontalSpeed < this.maxSpeed) {
        this.body.applyForce({ x: force.x, y: 0, z: force.z }, true);
      }
    }
    
    // Jumping
    if (this.keys['Space'] && this.isGrounded) {
      this.body.applyImpulse({ x: 0, y: this.jumpForce, z: 0 }, true);
    }
    
    // Apply air resistance/friction when not moving
    if (!this.keys['KeyW'] && !this.keys['KeyS'] && !this.keys['KeyA'] && !this.keys['KeyD']) {
      const dampingForce = 0.9;
      this.body.setLinvel({
        x: currentVel.x * dampingForce,
        y: currentVel.y,
        z: currentVel.z * dampingForce
      }, true);
    }
  }
  
  private updateCameraPosition() {
    if (!this.camera) return;
    
    const bodyPos = this.body.translation();
    const cameraPos = new THREE.Vector3(
      bodyPos.x,
      bodyPos.y + this.cameraHeight,
      bodyPos.z
    );
    
    this.camera.position.copy(cameraPos);
    
    // Apply mouse look
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const sensitivity = 0.002;
      this.camera.rotation.y -= this.mouseMovement.x * sensitivity;
      this.camera.rotation.x -= this.mouseMovement.y * sensitivity;
      
      // Limit vertical look
      this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
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
   * Cleanup
   */
  dispose() {
    if (this.body) {
      this.world.removeRigidBody(this.body);
    }
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}