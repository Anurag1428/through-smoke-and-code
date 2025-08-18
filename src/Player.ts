// src/PlayerController.ts - Fixed Movement Speed Issue
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";
import { CapsuleCollision } from "./CapsuleCollision";
import type { CollisionResult } from "./CapsuleCollision";

export class PlayerController {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private mesh!: THREE.Mesh;

  // Player properties
  private height: number;
  private radius: number;
  private mass: number;
  private position: THREE.Vector3;

  // Movement settings - FIXED SPEEDS
  private moveSpeed = 5.0;      // Base movement speed
  private runSpeed = 8.0;       // Running speed (unused currently)
  private walkSpeed = 2.5;      // Walking speed (with shift)
  private jumpForce = 10.0;

  // Input state with debugging
  private keys: { [key: string]: boolean } = {};
  private isGrounded = false;
  private groundCheckDistance = 0.2;
  private lastGroundTime = 0;

  // Camera system
  private camera: THREE.PerspectiveCamera | null = null;
  private cameraHeight = 1.6;
  private mouseSensitivity = 0.002;
  private yaw = 0;
  private pitch = 0;
  private maxPitch = Math.PI / 2 - 0.01;

  // Debug flags
  private debug = true;
  private frameCount = 0;
  private lastDebugTime = 0;

  // Jump timing
  private jumpCooldown = 0;
  private jumpBufferTime = 0.1;
  private jumpPressed = false;

  // Enhanced collision system
  private capsuleCollision: CapsuleCollision;
  private useEnhancedCollision = true;
  private scene: THREE.Scene;

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
    this.scene = scene;
    this.height = options.height || 1.8;
    this.radius = options.radius || 0.4;
    this.mass = options.mass || 70.0;
    this.position = options.position || new THREE.Vector3(0, 5, 0);

    this.createMesh(scene);
    this.createPhysicsBody();
    this.setupInput();

    // Initialize enhanced collision system
    this.capsuleCollision = new CapsuleCollision(this.world, {
      height: this.height,
      radius: this.radius,
      stepHeight: 0.3,
      slopeLimit: 45,
      skinWidth: 0.02,
      maxBounces: 4
    });

    console.log("🚀 FIXED FPS Controller initialized with proper movement speed");
    this.debugLog("Controller created with FIXED movement speeds");
  }

  private debugLog(message: string, data?: any) {
    if (this.debug) {
      console.log(`[FPS DEBUG] ${message}`, data || '');
    }
  }

  private createMesh(scene: THREE.Scene) {
    const group = new THREE.Group();
    
    const cylinderHeight = this.height - 2 * this.radius;
    const cylinderGeometry = new THREE.CylinderGeometry(this.radius, this.radius, cylinderHeight, 8);
    const material = new THREE.MeshLambertMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3
    });
    
    const cylinder = new THREE.Mesh(cylinderGeometry, material);
    group.add(cylinder);
    
    const topSphere = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 8, 6), material);
    topSphere.position.y = cylinderHeight / 2;
    group.add(topSphere);
    
    const bottomSphere = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 8, 6), material);
    bottomSphere.position.y = -cylinderHeight / 2;
    group.add(bottomSphere);

    this.mesh = group as any;
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
      .setFriction(0.1)
      .setRestitution(0.0)
      .setDensity(this.mass / (Math.PI * this.radius * this.radius * this.height));

    this.world.createCollider(colliderDesc, this.body);

    this.debugLog(`Physics body created: height=${this.height}, radius=${this.radius}, mass=${this.mass}`);
  }

  private setupInput() {
    this.debugLog("Setting up input handlers...");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.jumpPressed) {
          this.jumpPressed = true;
          this.debugLog(`SPACEBAR PRESSED - Jump attempt initiated`);
        }
        this.keys[e.code] = true;
        return;
      }

      if (e.code === 'KeyC') {
        this.toggleEnhancedCollision(!this.useEnhancedCollision);
        return;
      }

      if (!this.keys[e.code]) {
        this.debugLog(`KEY DOWN: ${e.code}`);
      }
      this.keys[e.code] = true;

      const movementKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'ShiftLeft', 'ShiftRight'
      ];
      if (movementKeys.includes(e.code)) {
        e.preventDefault();
      }

      const wasdKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (wasdKeys.includes(e.code) && document.pointerLockElement !== document.body) {
        this.requestPointerLock();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.jumpPressed = false;
        this.keys[e.code] = false;
        this.debugLog(`SPACEBAR RELEASED`);
        return;
      }

      if (this.keys[e.code]) {
        this.debugLog(`KEY UP: ${e.code}`);
      }
      this.keys[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === document.body) {
        const sensitivity = this.mouseSensitivity;
        
        this.yaw -= e.movementX * sensitivity;
        this.pitch -= e.movementY * sensitivity;
        this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

        this.updateCameraRotation();

        if (this.frameCount % 60 === 0 && (Math.abs(e.movementX) > 1 || Math.abs(e.movementY) > 1)) {
          this.debugLog(`Mouse: X=${e.movementX.toFixed(1)}, Y=${e.movementY.toFixed(1)}, Yaw=${(this.yaw * 180/Math.PI).toFixed(1)}°`);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      this.requestPointerLock();
    };

    const handlePointerLockChange = () => {
      if (document.pointerLockElement === document.body) {
        this.debugLog("✅ Pointer locked - Controls active");
      } else {
        this.debugLog("⚠️ Pointer unlocked - Click to enable");
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    (this as any).eventListeners = {
      handleKeyDown, handleKeyUp, handleMouseMove, handleClick, handlePointerLockChange
    };

    this.debugLog("✅ Input handlers ready (Press C to toggle collision system)");
  }

  private requestPointerLock() {
    if (document.pointerLockElement !== document.body) {
      document.body.requestPointerLock()
        .then(() => this.debugLog("Pointer lock requested successfully"))
        .catch(err => this.debugLog("Pointer lock failed", err));
    }
  }

  update(deltaTime: number) {
    this.frameCount++;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);
    
    if (this.useEnhancedCollision) {
      this.handleMovementEnhanced(deltaTime);
    } else {
      this.checkGrounded(deltaTime);
      this.handleMovementOriginal(deltaTime);
    }
    
    this.updateCameraPosition();
    this.syncMeshWithBody();

    const now = performance.now();
    if (now - this.lastDebugTime > 1000) {
      this.debugMovementState();
      this.lastDebugTime = now;
    }
  }

  // FIXED ENHANCED MOVEMENT METHOD
  private handleMovementEnhanced(deltaTime: number) {
    const currentPos = this.body.translation();
    const currentVel = this.body.linvel();
    const currentPosition = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    // Get input values (normalized to -1, 0, or 1)
    let forwardInput = 0;
    let rightInput = 0;
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardInput = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardInput = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) rightInput = 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) rightInput = -1;

    // Calculate desired horizontal movement
    const desiredVelocity = new THREE.Vector3(0, currentVel.y, 0); // Start with current Y velocity
    
    if (forwardInput !== 0 || rightInput !== 0) {
      // Calculate movement direction based on camera yaw
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      // Combine input directions
      const moveDirection = new THREE.Vector3();
      moveDirection.addScaledVector(forward, forwardInput);
      moveDirection.addScaledVector(right, rightInput);
      
      // IMPORTANT: Normalize to prevent diagonal movement being faster
      if (moveDirection.length() > 0) {
        moveDirection.normalize();
        
        // Determine speed based on input
        const isWalking = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const targetSpeed = isWalking ? this.walkSpeed : this.moveSpeed;
        
        // Apply speed to normalized direction
        desiredVelocity.x = moveDirection.x * targetSpeed;
        desiredVelocity.z = moveDirection.z * targetSpeed;

        // Debug movement calculation
        if (this.frameCount % 60 === 0) {
          this.debugLog(`Movement: Input(${forwardInput},${rightInput}) Dir(${moveDirection.x.toFixed(2)},${moveDirection.z.toFixed(2)}) Speed=${targetSpeed} Final(${desiredVelocity.x.toFixed(2)},${desiredVelocity.z.toFixed(2)})`);
        }
      }
    }

    // Handle jumping
    this.handleJumpingEnhanced(desiredVelocity);

    // Use enhanced collision detection
    const collisionResult: CollisionResult = this.capsuleCollision.moveWithCollision(
      currentPosition,
      desiredVelocity,
      deltaTime,
      this.body
    );

    // Apply the results
    this.body.setTranslation({
      x: collisionResult.position.x,
      y: collisionResult.position.y,
      z: collisionResult.position.z
    }, true);

    this.body.setLinvel({
      x: collisionResult.velocity.x,
      y: collisionResult.velocity.y,
      z: collisionResult.velocity.z
    }, true);

    // Update grounded state
    this.isGrounded = collisionResult.grounded;
    if (collisionResult.grounded) {
      this.lastGroundTime = performance.now();
    }

    // Apply terminal velocity
    const vel = this.body.linvel();
    if (vel.y < -20) {
      this.body.setLinvel({
        x: vel.x,
        y: -20,
        z: vel.z
      }, true);
    }

    // Debug collision results occasionally
    if (this.debug && this.frameCount % 120 === 0 && (collisionResult.hitWall || collisionResult.canStep)) {
      console.log('[Enhanced Collision]', {
        grounded: collisionResult.grounded,
        hitWall: collisionResult.hitWall,
        canStep: collisionResult.canStep,
        wallNormal: collisionResult.wallNormal.toArray(),
        speed: Math.sqrt(collisionResult.velocity.x ** 2 + collisionResult.velocity.z ** 2).toFixed(2)
      });
    }
  }

  private handleJumpingEnhanced(velocity: THREE.Vector3) {
    const timeSinceGrounded = (performance.now() - this.lastGroundTime) / 1000;
    
    const canJump = (this.isGrounded || timeSinceGrounded < this.jumpBufferTime) &&
                   this.jumpCooldown <= 0 &&
                   this.jumpPressed &&
                   velocity.y <= 2.0;
    
    if (canJump) {
      velocity.y = this.jumpForce;
      this.jumpCooldown = 0.15;
      this.jumpPressed = false;
      
      this.debugLog(`🚀 Enhanced Jump executed! Y velocity: ${this.jumpForce}`);
    }
  }

  // FIXED ORIGINAL MOVEMENT METHOD
  private handleMovementOriginal(deltaTime: number) {
    const currentVel = this.body.linvel();
    
    let forwardInput = 0;
    let rightInput = 0;
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardInput = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardInput = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) rightInput = 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) rightInput = -1;

    const moveDirection = new THREE.Vector3();
    
    if (forwardInput !== 0 || rightInput !== 0) {
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      moveDirection.addScaledVector(forward, forwardInput);
      moveDirection.addScaledVector(right, rightInput);
      
      // IMPORTANT: Normalize to prevent diagonal speed boost
      if (moveDirection.length() > 0) {
        moveDirection.normalize();
      }
    }

    if (moveDirection.length() > 0) {
      const isWalking = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      const targetSpeed = isWalking ? this.walkSpeed : this.moveSpeed;
      
      const newVelX = moveDirection.x * targetSpeed;
      const newVelZ = moveDirection.z * targetSpeed;
      
      this.body.setLinvel({
        x: newVelX,
        y: currentVel.y,
        z: newVelZ
      }, true);
    } else {
      // Stop horizontal movement when no input
      this.body.setLinvel({
        x: 0,
        y: currentVel.y,
        z: 0
      }, true);
    }

    this.handleJumping();

    // Terminal velocity
    if (currentVel.y < -20) {
      this.body.setLinvel({
        x: currentVel.x,
        y: -20,
        z: currentVel.z
      }, true);
    }
  }

  private debugMovementState() {
    const vel = this.body.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    const activeKeys = Object.keys(this.keys).filter(key => this.keys[key]);
    
    this.debugLog(`MOVEMENT STATE:`, {
      collisionSystem: this.useEnhancedCollision ? 'ENHANCED' : 'ORIGINAL',
      speed: speed.toFixed(2),
      velocity: `${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)}`,
      grounded: this.isGrounded,
      timeSinceGrounded: ((performance.now() - this.lastGroundTime) / 1000).toFixed(2),
      activeKeys: activeKeys,
      yaw: `${(this.yaw * 180/Math.PI).toFixed(1)}°`,
      pitch: `${(this.pitch * 180/Math.PI).toFixed(1)}°`
    });
  }

  // Keep all the existing ground checking and jumping methods unchanged
  private checkGrounded(_deltaTime: number) {
    const position = this.body.translation();
    const velocity = this.body.linvel();
    
    const rayOriginY = position.y - (this.height / 2) + this.radius + 0.01;
    const rayPoints = [
      { x: position.x, y: rayOriginY, z: position.z },
      { x: position.x + this.radius * 0.7, y: rayOriginY, z: position.z },
      { x: position.x - this.radius * 0.7, y: rayOriginY, z: position.z },
      { x: position.x, y: rayOriginY, z: position.z + this.radius * 0.7 },
      { x: position.x, y: rayOriginY, z: position.z - this.radius * 0.7 }
    ];
    
    const rayDirection = { x: 0, y: -1, z: 0 };
    const maxDistance = this.groundCheckDistance;
    
    let foundGround = false;
    
    for (const rayOrigin of rayPoints) {
      const ray = new RAPIER.Ray(rayOrigin, rayDirection);
      const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, this.body);
      
      if (hit !== null) {
        foundGround = true;
        break;
      }
    }
    
    if (!foundGround && Math.abs(velocity.y) < 0.1) {
      const ray = new RAPIER.Ray({ x: position.x, y: rayOriginY, z: position.z }, rayDirection);
      const hit = this.world.castRay(ray, this.groundCheckDistance + 0.1, true, undefined, undefined, this.body);
      foundGround = hit !== null;
    }
    
    const wasGrounded = this.isGrounded;
    this.isGrounded = foundGround;
    
    if (this.isGrounded) {
      this.lastGroundTime = performance.now();
    }
    
    if (wasGrounded !== this.isGrounded) {
      this.debugLog(`🚶 Ground state changed: ${wasGrounded} -> ${this.isGrounded} (Y velocity: ${velocity.y.toFixed(2)})`);
    }
  }

  private handleJumping() {
    const currentVel = this.body.linvel();
    const timeSinceGrounded = (performance.now() - this.lastGroundTime) / 1000;
    
    const canJump = (this.isGrounded || timeSinceGrounded < this.jumpBufferTime) &&
                   this.jumpCooldown <= 0 &&
                   this.jumpPressed &&
                   currentVel.y <= 2.0;
    
    if (canJump) {
      this.body.setLinvel({
        x: currentVel.x,
        y: this.jumpForce,
        z: currentVel.z
      }, true);
      
      this.jumpCooldown = 0.15;
      this.jumpPressed = false;
      
      this.debugLog(`🚀 JUMP EXECUTED! Y velocity: ${this.jumpForce}, was grounded: ${this.isGrounded}, time since grounded: ${timeSinceGrounded.toFixed(3)}s`);
    } 
    else if (this.jumpPressed) {
      if (this.frameCount % 15 === 0) {
        let reason = "Jump failed: ";
        if (!this.isGrounded && timeSinceGrounded >= this.jumpBufferTime) {
          reason += `Not grounded (${timeSinceGrounded.toFixed(3)}s ago)`;
        } else if (this.jumpCooldown > 0) {
          reason += `Cooldown (${this.jumpCooldown.toFixed(3)}s)`;
        } else if (currentVel.y > 2.0) {
          reason += `Already moving up (${currentVel.y.toFixed(2)})`;
        } else {
          reason += "Unknown";
        }
        this.debugLog(`❌ ${reason}`);
      }
    }
  }

  private updateCameraRotation() {
    if (!this.camera) return;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
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
  }

  private syncMeshWithBody() {
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
  }

  // Public methods
  attachCamera(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.debugLog("✅ Camera attached");
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
    this.debugLog(`Teleported to: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  }

  isPlayerGrounded(): boolean {
    return this.isGrounded;
  }

  setMouseSensitivity(sensitivity: number) {
    this.mouseSensitivity = sensitivity;
    this.debugLog(`Mouse sensitivity: ${sensitivity}`);
  }

  setMoveSpeed(speed: number) {
    this.moveSpeed = speed;
    this.runSpeed = speed * 1.5;
    this.debugLog(`Move speed: ${speed}, Run speed: ${this.runSpeed}`);
  }

  setJumpForce(force: number) {
    this.jumpForce = force;
    this.debugLog(`Jump force: ${force}`);
  }

  getCameraAngles(): { yaw: number; pitch: number } {
    return { 
      yaw: this.yaw * (180 / Math.PI), 
      pitch: this.pitch * (180 / Math.PI) 
    };
  }

  getBody(): RAPIER.RigidBody {
    return this.body;
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  getInputState(): { [key: string]: boolean } {
    return { ...this.keys };
  }

  public toggleEnhancedCollision(enabled: boolean) {
    this.useEnhancedCollision = enabled;
    this.debugLog(`🔄 Enhanced collision: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`Enhanced Capsule Collision: ${enabled ? 'ON' : 'OFF'} (Press C to toggle)`);
  }

  public setStepHeight(height: number) {
    this.capsuleCollision.setStepHeight(height);
    this.debugLog(`Step height set to: ${height}m`);
  }

  public setSlopeLimit(degrees: number) {
    this.capsuleCollision.setSlopeLimit(degrees);
    this.debugLog(`Slope limit set to: ${degrees}°`);
  }

  public enableCollisionDebug() {
    this.capsuleCollision.enableDebug(this.scene);
    this.debugLog("🎯 Collision debug visualization enabled");
  }

  public disableCollisionDebug() {
    this.capsuleCollision.disableDebug();
    this.debugLog("Collision debug visualization disabled");
  }

  setDebug(enabled: boolean) {
    this.debug = enabled;
    this.debugLog(`Debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  getDebugInfo(): any {
    const vel = this.body.linvel();
    const pos = this.body.translation();
    const timeSinceGrounded = (performance.now() - this.lastGroundTime) / 1000;
    const collisionConfig = this.capsuleCollision.getConfig();
    
    return {
      position: { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) },
      velocity: { x: vel.x.toFixed(2), y: vel.y.toFixed(2), z: vel.z.toFixed(2) },
      speed: Math.sqrt(vel.x * vel.x + vel.z * vel.z).toFixed(2),
      grounded: this.isGrounded,
      timeSinceGrounded: timeSinceGrounded.toFixed(3),
      jumpPressed: this.jumpPressed,
      jumpCooldown: this.jumpCooldown.toFixed(3),
      yaw: (this.yaw * 180/Math.PI).toFixed(1),
      pitch: (this.pitch * 180/Math.PI).toFixed(1),
      activeKeys: Object.keys(this.keys).filter(key => this.keys[key]),
      collisionSystem: this.useEnhancedCollision ? '✅ Enhanced' : '❌ Original',
      stepHeight: `${collisionConfig.stepHeight}m`,
      slopeLimit: `${collisionConfig.slopeLimit}°`,
      skinWidth: `${collisionConfig.skinWidth}m`
    };
  }

  reset(position?: THREE.Vector3) {
    const resetPos = position || new THREE.Vector3(0, 5, 0);
    this.setPosition(resetPos);
    this.keys = {};
    this.jumpCooldown = 0;
    this.jumpPressed = false;
    this.lastGroundTime = performance.now();
    this.yaw = 0;
    this.pitch = 0;
    if (this.camera) {
      this.camera.rotation.set(0, 0, 0, 'YXZ');
    }
    this.debugLog("Player reset");
  }

  dispose() {
    this.debugLog("Disposing enhanced controller...");

    this.capsuleCollision.disableDebug();

    if ((this as any).eventListeners) {
      const listeners = (this as any).eventListeners;
      document.removeEventListener('keydown', listeners.handleKeyDown);
      document.removeEventListener('keyup', listeners.handleKeyUp);
      document.removeEventListener('mousemove', listeners.handleMouseMove);
      document.removeEventListener('click', listeners.handleClick);
      document.removeEventListener('pointerlockchange', listeners.handlePointerLockChange);
    }

    if (this.body && this.world) {
      this.world.removeRigidBody(this.body);
    }

    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    this.debugLog("✅ Enhanced controller disposed");
  }
}