// src/PlayerController.ts - FIXED FPS Controller with Correct Movement AND JUMPING
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

  // Movement settings - FIXED FOR INSTANT RESPONSE
  private moveSpeed = 5.0;
  private runSpeed = 8.0;
  private walkSpeed = 3.0;
  private jumpForce = 10.0;

  // Input state with debugging
  private keys: { [key: string]: boolean } = {};
  private isGrounded = false;
  private groundCheckDistance = 0.2; // INCREASED for better detection
  private lastGroundTime = 0; // ADDED for jump buffering

  // Camera system - SIMPLIFIED
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

  // Jump timing - ENHANCED
  private jumpCooldown = 0;
  private jumpBufferTime = 0.1; // Allow jumping shortly after leaving ground
  private jumpPressed = false; // Track spacebar press state

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

    console.log("🚀 FIXED FPS Controller initialized with WORKING JUMP");
    this.debugLog("Controller created with FIXED movement controls and jumping");
  }

  private debugLog(message: string, data?: any) {
    if (this.debug) {
      console.log(`[FPS DEBUG] ${message}`, data || '');
    }
  }

  private createMesh(scene: THREE.Scene) {
    // Create simple capsule visualization
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
    this.debugLog("Setting up FIXED input handlers...");

    const handleKeyDown = (e: KeyboardEvent) => {
      // Special handling for spacebar - IMPROVED
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.jumpPressed) {
          this.jumpPressed = true;
          this.debugLog(`SPACEBAR PRESSED - Jump attempt initiated`);
        }
        this.keys[e.code] = true;
        return;
      }

      if (!this.keys[e.code]) {
        this.debugLog(`KEY DOWN: ${e.code}`);
      }
      this.keys[e.code] = true;

      // Prevent default for movement keys
      const movementKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'ShiftLeft', 'ShiftRight'
      ];
      if (movementKeys.includes(e.code)) {
        e.preventDefault();
      }

      // Auto-request pointer lock
      const wasdKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (wasdKeys.includes(e.code) && document.pointerLockElement !== document.body) {
        this.requestPointerLock();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Special handling for spacebar - IMPROVED
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

        // Debug mouse movement occasionally
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

    this.debugLog("✅ FIXED Input handlers ready");
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
    
    this.checkGrounded(deltaTime); // PASS deltaTime for better ground tracking
    this.handleMovement(deltaTime);
    this.updateCameraPosition();
    this.syncMeshWithBody();

    // Debug output every second
    const now = performance.now();
    if (now - this.lastDebugTime > 1000) {
      this.debugMovementState();
      this.lastDebugTime = now;
    }
  }

  private debugMovementState() {
    const vel = this.body.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    const activeKeys = Object.keys(this.keys).filter(key => this.keys[key]);
    
    this.debugLog(`MOVEMENT STATE:`, {
      speed: speed.toFixed(2),
      velocity: `${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)}`,
      grounded: this.isGrounded,
      timeSinceGrounded: ((performance.now() - this.lastGroundTime) / 1000).toFixed(2),
      activeKeys: activeKeys,
      yaw: `${(this.yaw * 180/Math.PI).toFixed(1)}°`,
      pitch: `${(this.pitch * 180/Math.PI).toFixed(1)}°`
    });
  }

  // COMPLETELY REWRITTEN GROUND CHECK - More reliable
  private checkGrounded(_deltaTime: number) {
    const position = this.body.translation();
    const velocity = this.body.linvel();
    
    // Multiple raycast points for better detection
    const rayOriginY = position.y - (this.height / 2) + this.radius + 0.01;
    const rayPoints = [
      { x: position.x, y: rayOriginY, z: position.z }, // Center
      { x: position.x + this.radius * 0.7, y: rayOriginY, z: position.z }, // Right
      { x: position.x - this.radius * 0.7, y: rayOriginY, z: position.z }, // Left
      { x: position.x, y: rayOriginY, z: position.z + this.radius * 0.7 }, // Forward
      { x: position.x, y: rayOriginY, z: position.z - this.radius * 0.7 }  // Back
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
    
    // Additional check: if moving downward very slowly, consider grounded
    if (!foundGround && Math.abs(velocity.y) < 0.1) {
      // Try a slightly longer raycast
      const ray = new RAPIER.Ray({ x: position.x, y: rayOriginY, z: position.z }, rayDirection);
      const hit = this.world.castRay(ray, this.groundCheckDistance + 0.1, true, undefined, undefined, this.body);
      foundGround = hit !== null;
    }
    
    const wasGrounded = this.isGrounded;
    this.isGrounded = foundGround;
    
    // Track when we were last grounded for jump buffering
    if (this.isGrounded) {
      this.lastGroundTime = performance.now();
    }
    
    // Debug ground state changes
    if (wasGrounded !== this.isGrounded) {
      this.debugLog(`🚶 Ground state changed: ${wasGrounded} -> ${this.isGrounded} (Y velocity: ${velocity.y.toFixed(2)})`);
    }
  }

  private handleMovement(_deltaTime: number) {
    // COMPLETELY FIXED MOVEMENT SYSTEM
    const currentVel = this.body.linvel();
    
    // Get input immediately - FIXED KEY MAPPINGS
    let forwardInput = 0;
    let rightInput = 0;
    
    // CORRECT WASD + Arrow Keys mapping
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardInput = 1;      // Forward
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardInput = -1;   // Backward  
    if (this.keys['KeyD'] || this.keys['ArrowRight']) rightInput = 1;     // Right
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) rightInput = -1;     // Left

    // Debug input
    if (forwardInput !== 0 || rightInput !== 0) {
      if (this.frameCount % 30 === 0) {
        this.debugLog(`Input: W/S=${forwardInput}, A/D=${rightInput}`);
      }
    }

    // COMPLETELY FIXED MOVEMENT DIRECTION CALCULATION
    const moveDirection = new THREE.Vector3();
    
    if (forwardInput !== 0 || rightInput !== 0) {
      // CORRECT FPS movement calculation
      // Forward/backward along camera's forward direction
      const forward = new THREE.Vector3(
        -Math.sin(this.yaw),  // X component (negative sin for correct forward)
        0,
        -Math.cos(this.yaw)   // Z component (negative cos for correct forward)
      );
      
      // Right/left perpendicular to forward direction  
      const right = new THREE.Vector3(
        Math.cos(this.yaw),   // X component 
        0,
        -Math.sin(this.yaw)   // Z component
      );

      // Combine forward and right movements
      moveDirection.addScaledVector(forward, forwardInput);
      moveDirection.addScaledVector(right, rightInput);
      moveDirection.normalize();

      if (this.frameCount % 60 === 0 && moveDirection.length() > 0) {
        this.debugLog(`Movement vector: X=${moveDirection.x.toFixed(2)}, Z=${moveDirection.z.toFixed(2)}`);
        this.debugLog(`Yaw: ${(this.yaw * 180/Math.PI).toFixed(1)}°`);
      }
    }

    // INSTANT MOVEMENT - Set velocity directly for immediate response
    if (moveDirection.length() > 0) {
      const isWalking = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      const targetSpeed = isWalking ? this.walkSpeed : this.moveSpeed;
      
      // Set horizontal velocity directly for instant response
      const newVelX = moveDirection.x * targetSpeed;
      const newVelZ = moveDirection.z * targetSpeed;
      
      this.body.setLinvel({
        x: newVelX,
        y: currentVel.y, // Keep Y velocity for gravity/jumping
        z: newVelZ
      }, true);

      if (this.frameCount % 30 === 0) {
        this.debugLog(`Setting velocity: X=${newVelX.toFixed(2)}, Z=${newVelZ.toFixed(2)}`);
      }
    } else {
      // Stop immediately when no input
      this.body.setLinvel({
        x: 0,
        y: currentVel.y,
        z: 0
      }, true);
    }

    // COMPLETELY REWRITTEN JUMPING SYSTEM - Much more reliable
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

  // NEW SEPARATE JUMP HANDLING METHOD - More robust
  private handleJumping() {
    const currentVel = this.body.linvel();
    const timeSinceGrounded = (performance.now() - this.lastGroundTime) / 1000;
    
    // Can jump if:
    // 1. Currently grounded, OR
    // 2. Was grounded very recently (coyote time), AND
    // 3. Not in jump cooldown, AND
    // 4. Jump is pressed, AND
    // 5. Not moving upward too fast already
    const canJump = (this.isGrounded || timeSinceGrounded < this.jumpBufferTime) &&
                   this.jumpCooldown <= 0 &&
                   this.jumpPressed &&
                   currentVel.y <= 2.0; // Allow jumping even with small upward velocity
    
    if (canJump) {
      // EXECUTE JUMP
      this.body.setLinvel({
        x: currentVel.x,
        y: this.jumpForce,
        z: currentVel.z
      }, true);
      
      this.jumpCooldown = 0.15; // Prevent double jumping
      this.jumpPressed = false; // Consume the jump input
      
      this.debugLog(`🚀 JUMP EXECUTED! Y velocity: ${this.jumpForce}, was grounded: ${this.isGrounded}, time since grounded: ${timeSinceGrounded.toFixed(3)}s`);
    } 
    // Debug why jump failed
    else if (this.jumpPressed) {
      if (this.frameCount % 15 === 0) { // More frequent debug for jump issues
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

  // Debug methods
  setDebug(enabled: boolean) {
    this.debug = enabled;
    this.debugLog(`Debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  getDebugInfo(): any {
    const vel = this.body.linvel();
    const pos = this.body.translation();
    const timeSinceGrounded = (performance.now() - this.lastGroundTime) / 1000;
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
      activeKeys: Object.keys(this.keys).filter(key => this.keys[key])
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
    this.debugLog("Disposing controller...");

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

    this.debugLog("✅ Controller disposed");
  }
}