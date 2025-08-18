// src/CapsuleCollision.ts - Enhanced Capsule Collision System for FPS Player
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";

export interface CapsuleCollisionConfig {
  height: number;
  radius: number;
  stepHeight: number;
  slopeLimit: number; // in degrees
  skinWidth: number;
  maxBounces: number;
}

export interface CollisionResult {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  grounded: boolean;
  groundNormal: THREE.Vector3;
  hitWall: boolean;
  wallNormal: THREE.Vector3;
  canStep: boolean;
}

export class CapsuleCollision {
  private world: RAPIER.World;
  private config: CapsuleCollisionConfig;
  private tempVectors: THREE.Vector3[] = [];
  
  // Debug visualization
  private debugMode = false;
  private debugMeshes: THREE.Mesh[] = [];
  private scene?: THREE.Scene;

  constructor(world: RAPIER.World, config: Partial<CapsuleCollisionConfig> = {}) {
    this.world = world;
    this.config = {
      height: 1.8,
      radius: 0.4,
      stepHeight: 0.3,
      slopeLimit: 45, // degrees
      skinWidth: 0.02,
      maxBounces: 4,
      ...config
    };

    // Pre-allocate temp vectors for performance
    for (let i = 0; i < 10; i++) {
      this.tempVectors.push(new THREE.Vector3());
    }
  }

  /**
   * Enhanced capsule collision detection and response
   * This is the main method that replaces basic physics movement
   */
  public moveWithCollision(
    currentPosition: THREE.Vector3,
    desiredVelocity: THREE.Vector3,
    deltaTime: number,
    excludeBody?: RAPIER.RigidBody
  ): CollisionResult {
    const result: CollisionResult = {
      position: currentPosition.clone(),
      velocity: desiredVelocity.clone(),
      grounded: false,
      groundNormal: new THREE.Vector3(0, 1, 0),
      hitWall: false,
      wallNormal: new THREE.Vector3(),
      canStep: false
    };

    // Calculate desired movement
    const desiredMovement = this.tempVectors[0].copy(desiredVelocity).multiplyScalar(deltaTime);
    
    if (desiredMovement.length() < 0.001) {
      // Still check for ground even if not moving
      this.checkGrounded(result, excludeBody);
      return result;
    }

    // Separate horizontal and vertical movement for better control
    const horizontalMovement = this.tempVectors[1].set(desiredMovement.x, 0, desiredMovement.z);
    const verticalMovement = this.tempVectors[2].set(0, desiredMovement.y, 0);

    // Process horizontal movement first (with wall sliding)
    if (horizontalMovement.length() > 0.001) {
      this.processHorizontalMovement(result, horizontalMovement, excludeBody);
    }

    // Process vertical movement (gravity, jumping)
    if (Math.abs(verticalMovement.y) > 0.001) {
      this.processVerticalMovement(result, verticalMovement, excludeBody);
    }

    // Final ground check
    this.checkGrounded(result, excludeBody);

    // Handle step-up if we hit a wall but could step over it
    if (result.hitWall && horizontalMovement.length() > 0.001) {
      this.tryStepUp(result, horizontalMovement, excludeBody);
    }

    return result;
  }

  private processHorizontalMovement(
    result: CollisionResult, 
    movement: THREE.Vector3, 
    excludeBody?: RAPIER.RigidBody
  ) {
    let remainingMovement = movement.clone();
    let bounces = 0;
    const originalLength = movement.length();

    while (remainingMovement.length() > 0.001 && bounces < this.config.maxBounces) {
      const hit = this.castCapsule(result.position, remainingMovement.normalize(), remainingMovement.length(), excludeBody);

      if (!hit) {
        // No collision, move freely
        result.position.add(remainingMovement);
        break;
      }

      // Move to collision point (with skin width)
      const safeDistance = Math.max(0, hit.distance - this.config.skinWidth);
      if (safeDistance > 0.001) {
        result.position.add(this.tempVectors[3].copy(remainingMovement).normalize().multiplyScalar(safeDistance));
      }

      // Calculate wall sliding
      const slideVector = this.calculateSlideVector(remainingMovement, hit.normal);
      
      // Update remaining movement for next iteration
      const consumedDistance = Math.min(hit.distance, remainingMovement.length());
      const remainingDistance = remainingMovement.length() - consumedDistance;
      
      if (remainingDistance > 0.001 && slideVector.length() > 0.001) {
        remainingMovement.copy(slideVector).multiplyScalar(remainingDistance);
        
        // Reduce movement slightly to prevent infinite sliding
        remainingMovement.multiplyScalar(0.98);
      } else {
        break;
      }

      // Record wall hit
      result.hitWall = true;
      result.wallNormal.copy(hit.normal);
      
      bounces++;
    }

    // Update horizontal velocity based on actual movement
    if (originalLength > 0) {
      const actualMovement = this.tempVectors[4].subVectors(result.position, movement).setY(0);
      result.velocity.x = actualMovement.x / (performance.now() / 1000 - performance.now() / 1000 + 0.016); // Approximate deltaTime
      result.velocity.z = actualMovement.z / (performance.now() / 1000 - performance.now() / 1000 + 0.016);
    }
  }

  private processVerticalMovement(
    result: CollisionResult, 
    movement: THREE.Vector3, 
    excludeBody?: RAPIER.RigidBody
  ) {
    const verticalDirection = movement.y > 0 ? 1 : -1;
    const verticalDistance = Math.abs(movement.y);

    // Cast in vertical direction
    const hit = this.castCapsule(
      result.position, 
      new THREE.Vector3(0, verticalDirection, 0), 
      verticalDistance, 
      excludeBody
    );

    if (hit) {
      // Hit ceiling or ground
      const safeDistance = Math.max(0, hit.distance - this.config.skinWidth);
      result.position.y += verticalDirection * safeDistance;
      
      // Stop vertical movement
      if (verticalDirection > 0) {
        // Hit ceiling
        result.velocity.y = Math.min(0, result.velocity.y);
      } else {
        // Hit ground
        result.velocity.y = Math.max(0, result.velocity.y);
        result.grounded = true;
        result.groundNormal.copy(hit.normal);
      }
    } else {
      // No collision, move freely
      result.position.y += movement.y;
    }
  }

  private tryStepUp(
    result: CollisionResult, 
    originalMovement: THREE.Vector3, 
    excludeBody?: RAPIER.RigidBody
  ) {
    // Try to step up over small obstacles
    const stepUpPosition = result.position.clone();
    stepUpPosition.y += this.config.stepHeight;

    // Check if we can fit at step height
    const upHit = this.castCapsule(result.position, new THREE.Vector3(0, 1, 0), this.config.stepHeight, excludeBody);
    if (upHit) return; // Can't step up, something above us

    // Try moving forward at step height
    const forwardHit = this.castCapsule(
      stepUpPosition, 
      originalMovement.normalize(), 
      originalMovement.length(), 
      excludeBody
    );

    if (!forwardHit) {
      // We can move forward at step height, now check if we can step down
      const stepForwardPos = stepUpPosition.clone().add(originalMovement);
      const downHit = this.castCapsule(
        stepForwardPos, 
        new THREE.Vector3(0, -1, 0), 
        this.config.stepHeight + this.config.skinWidth, 
        excludeBody
      );

      if (downHit && downHit.distance <= this.config.stepHeight) {
        // Successful step up!
        result.position.copy(stepForwardPos);
        result.position.y -= downHit.distance - this.config.skinWidth;
        result.canStep = true;
        result.hitWall = false; // We overcame the wall by stepping
      }
    }
  }

  private checkGrounded(result: CollisionResult, excludeBody?: RAPIER.RigidBody) {
    const groundCheckDistance = this.config.skinWidth + 0.1;
    
    // Cast multiple rays for better ground detection
    const checkPoints = [
      new THREE.Vector3(0, 0, 0), // Center
      new THREE.Vector3(this.config.radius * 0.7, 0, 0), // Right
      new THREE.Vector3(-this.config.radius * 0.7, 0, 0), // Left
      new THREE.Vector3(0, 0, this.config.radius * 0.7), // Forward
      new THREE.Vector3(0, 0, -this.config.radius * 0.7), // Back
    ];

    for (const offset of checkPoints) {
      const checkPos = this.tempVectors[5].copy(result.position).add(offset);
      checkPos.y -= (this.config.height / 2 - this.config.radius); // Bottom of capsule

      const hit = this.castRay(checkPos, new THREE.Vector3(0, -1, 0), groundCheckDistance, excludeBody);
      
      if (hit) {
        // Check slope angle
        const slopeAngle = Math.acos(hit.normal.y) * (180 / Math.PI);
        
        if (slopeAngle <= this.config.slopeLimit) {
          result.grounded = true;
          result.groundNormal.copy(hit.normal);
          return;
        }
      }
    }
  }

  private calculateSlideVector(movement: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
    // Project movement onto the surface (slide along wall)
    const slideVector = this.tempVectors[6];
    const dot = movement.dot(normal);
    
    slideVector.copy(movement).sub(this.tempVectors[7].copy(normal).multiplyScalar(dot));
    
    // Don't slide up steep slopes
    if (normal.y > 0 && normal.y < Math.cos(this.config.slopeLimit * Math.PI / 180)) {
      slideVector.y = Math.min(0, slideVector.y);
    }
    
    return slideVector;
  }

  private castCapsule(
    origin: THREE.Vector3, 
    direction: THREE.Vector3, 
    maxDistance: number, 
    excludeBody?: RAPIER.RigidBody
  ): { distance: number; normal: THREE.Vector3; point: THREE.Vector3 } | null {
    const halfHeight = (this.config.height / 2) - this.config.radius;
    
    // Create shape for collision detection
    const shape = new RAPIER.Capsule(halfHeight, this.config.radius);
    const shapePos = { x: origin.x, y: origin.y, z: origin.z };
    const shapeRot = { x: 0, y: 0, z: 0, w: 1 };
    const shapeVel = { x: direction.x, y: direction.y, z: direction.z };
    
    const hit = this.world.castShape(
      shapePos,
      shapeRot,
      shapeVel,
      shape,
      maxDistance,
      true,
      undefined,
      undefined,
      excludeBody
    );

    if (hit) {
      return {
        distance: hit.toi,
        normal: new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z),
        point: new THREE.Vector3(hit.witness1.x, hit.witness1.y, hit.witness1.z)
      };
    }

    return null;
  }

  private castRay(
    origin: THREE.Vector3, 
    direction: THREE.Vector3, 
    maxDistance: number, 
    excludeBody?: RAPIER.RigidBody
  ): { distance: number; normal: THREE.Vector3; point: THREE.Vector3 } | null {
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );

    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, excludeBody);

    if (hit) {
      const hitPoint = this.tempVectors[8].copy(origin).add(
        this.tempVectors[9].copy(direction).multiplyScalar(hit.toi)
      );

      return {
        distance: hit.toi,
        normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
        point: hitPoint
      };
    }

    return null;
  }

  // Debug visualization methods
  public enableDebug(scene: THREE.Scene) {
    this.debugMode = true;
    this.scene = scene;
  }

  public disableDebug() {
    this.debugMode = false;
    this.clearDebugMeshes();
  }

  private clearDebugMeshes() {
    if (this.scene) {
      this.debugMeshes.forEach(mesh => {
        this.scene!.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    }
    this.debugMeshes = [];
  }

  public drawDebugCapsule(position: THREE.Vector3, color = 0x00ff00) {
    if (!this.debugMode || !this.scene) return;

    const group = new THREE.Group();
    
    // Draw capsule wireframe
    const cylinderHeight = this.config.height - 2 * this.config.radius;
    const material = new THREE.LineBasicMaterial({ color });
    
    // Cylinder part
    const cylinderGeometry = new THREE.CylinderGeometry(
      this.config.radius, this.config.radius, cylinderHeight, 8
    );
    const cylinderEdges = new THREE.EdgesGeometry(cylinderGeometry);
    const cylinderLines = new THREE.LineSegments(cylinderEdges, material);
    group.add(cylinderLines);
    
    // Top hemisphere
    const topSphereGeometry = new THREE.SphereGeometry(this.config.radius, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const topSphereEdges = new THREE.EdgesGeometry(topSphereGeometry);
    const topSphereLines = new THREE.LineSegments(topSphereEdges, material);
    topSphereLines.position.y = cylinderHeight / 2;
    group.add(topSphereLines);
    
    // Bottom hemisphere
    const bottomSphereGeometry = new THREE.SphereGeometry(this.config.radius, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bottomSphereEdges = new THREE.EdgesGeometry(bottomSphereGeometry);
    const bottomSphereLines = new THREE.LineSegments(bottomSphereEdges, material);
    bottomSphereLines.position.y = -cylinderHeight / 2;
    group.add(bottomSphereLines);

    group.position.copy(position);
    this.scene.add(group);
    this.debugMeshes.push(group as any);
  }

  // Configuration methods
  public setStepHeight(height: number) {
    this.config.stepHeight = height;
  }

  public setSlopeLimit(degrees: number) {
    this.config.slopeLimit = Math.max(0, Math.min(90, degrees));
  }

  public setSkinWidth(width: number) {
    this.config.skinWidth = Math.max(0.001, width);
  }

  public getConfig(): CapsuleCollisionConfig {
    return { ...this.config };
  }
}