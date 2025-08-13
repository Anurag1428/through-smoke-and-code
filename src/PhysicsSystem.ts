// src/PhysicsSystem.ts
import * as THREE from "three";
// @ts-ignore - Rapier types might not resolve properly in some setups
import * as RAPIER from "@dimforge/rapier3d-compat";

export type CollisionEvent = {
  object1: THREE.Object3D;
  object2: THREE.Object3D;
  contact: RAPIER.TempContactManifold | null;
};

export type PhysicsBodyType = 'ground' | 'player' | 'collectible' | 'obstacle' | 'interactive';

interface PhysicsBodyData {
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
  type: PhysicsBodyType;
  userData?: any;
}

export class PhysicsSystem {
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private bodies = new Map<number, PhysicsBodyData>();
  private meshToHandle = new Map<THREE.Object3D, number>();
  
  // Fixed timestep for deterministic physics
  private readonly FIXED_TIMESTEP = 1 / 60; // 60 FPS physics
  private readonly MAX_SUBSTEPS = 5;
  private accumulator = 0;
  
  // Collision callbacks
  private collisionEnterCallbacks: ((event: CollisionEvent) => void)[] = [];
  private collisionExitCallbacks: ((event: CollisionEvent) => void)[] = [];

  async init(gravity = new THREE.Vector3(0, -9.81, 0)) {
    await RAPIER.init();
    
    this.world = new RAPIER.World({ x: gravity.x, y: gravity.y, z: gravity.z });
    this.eventQueue = new RAPIER.EventQueue(true);
    
    console.log("Physics system initialized with Rapier.js");
  }

  private ensureInitialized() {
    if (!this.world || !this.eventQueue) {
      throw new Error("PhysicsSystem not initialized. Call init() first.");
    }
    return { world: this.world, eventQueue: this.eventQueue };
  }

  /**
   * Create ground physics body from mesh
   */
  createGroundBody(mesh: THREE.Mesh, friction = 1.0): RAPIER.RigidBody {
    const { world } = this.ensureInitialized();
    
    const { hx, hy, hz } = this.getHalfExtents(mesh);
    
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({
        x: mesh.quaternion.x,
        y: mesh.quaternion.y,
        z: mesh.quaternion.z,
        w: mesh.quaternion.w
      });
    
    const body = world.createRigidBody(rigidBodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(friction)
      .setRestitution(0.0);
    
    world.createCollider(colliderDesc, body);
    
    this.registerBody(mesh, body, 'ground');
    return body;
  }

  /**
   * Create dynamic box physics body
   */
  createDynamicBox(
    mesh: THREE.Mesh, 
    options: {
      mass?: number;
      friction?: number;
      restitution?: number;
      type?: PhysicsBodyType;
      userData?: any;
    } = {}
  ): RAPIER.RigidBody {
    const { world } = this.ensureInitialized();
    const { mass = 1.0, friction = 0.7, restitution = 0.3, type = 'obstacle', userData } = options;
    
    const { hx, hy, hz } = this.getHalfExtents(mesh);
    
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({
        x: mesh.quaternion.x,
        y: mesh.quaternion.y,
        z: mesh.quaternion.z,
        w: mesh.quaternion.w
      });
    
    const body = world.createRigidBody(rigidBodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setMass(mass)
      .setFriction(friction)
      .setRestitution(restitution);
    
    world.createCollider(colliderDesc, body);
    
    this.registerBody(mesh, body, type, userData);
    return body;
  }

  /**
   * Create static box physics body (won't move but will collide)
   */
  createStaticBox(
    mesh: THREE.Mesh,
    friction = 0.8,
    type: PhysicsBodyType = 'obstacle'
  ): RAPIER.RigidBody {
    const { world } = this.ensureInitialized();
    
    const { hx, hy, hz } = this.getHalfExtents(mesh);
    
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({
        x: mesh.quaternion.x,
        y: mesh.quaternion.y,
        z: mesh.quaternion.z,
        w: mesh.quaternion.w
      });
    
    const body = world.createRigidBody(rigidBodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(friction)
      .setRestitution(0.1);
    
    world.createCollider(colliderDesc, body);
    
    this.registerBody(mesh, body, type);
    return body;
  }

  /**
   * Create sphere physics body
   */
  createSphere(
    mesh: THREE.Mesh,
    options: {
      dynamic?: boolean;
      mass?: number;
      friction?: number;
      restitution?: number;
      type?: PhysicsBodyType;
    } = {}
  ): RAPIER.RigidBody {
    const { world } = this.ensureInitialized();
    const { dynamic = true, mass = 1.0, friction = 0.6, restitution = 0.5, type = 'collectible' } = options;
    
    const radius = this.getSphereRadius(mesh);
    
    const rigidBodyDesc = dynamic 
      ? RAPIER.RigidBodyDesc.dynamic()
      : RAPIER.RigidBodyDesc.fixed();
    
    rigidBodyDesc
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({
        x: mesh.quaternion.x,
        y: mesh.quaternion.y,
        z: mesh.quaternion.z,
        w: mesh.quaternion.w
      });
    
    const body = world.createRigidBody(rigidBodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setFriction(friction)
      .setRestitution(restitution);
    
    if (dynamic) {
      colliderDesc.setMass(mass);
    }
    
    world.createCollider(colliderDesc, body);
    
    this.registerBody(mesh, body, type);
    return body;
  }

  /**
   * Apply force to a body
   */
  applyForce(mesh: THREE.Object3D, force: THREE.Vector3, point?: THREE.Vector3) {
    const bodyData = this.getBodyByMesh(mesh);
    if (!bodyData) return;

    const forceVec = { x: force.x, y: force.y, z: force.z };
    
    if (point) {
      const pointVec = { x: point.x, y: point.y, z: point.z };
      bodyData.body.applyForceAtPoint(forceVec, pointVec, true);
    } else {
      bodyData.body.applyForce(forceVec, true);
    }
  }

  /**
   * Apply impulse to a body
   */
  applyImpulse(mesh: THREE.Object3D, impulse: THREE.Vector3, point?: THREE.Vector3) {
    const bodyData = this.getBodyByMesh(mesh);
    if (!bodyData) return;

    const impulseVec = { x: impulse.x, y: impulse.y, z: impulse.z };
    
    if (point) {
      const pointVec = { x: point.x, y: point.y, z: point.z };
      bodyData.body.applyImpulseAtPoint(impulseVec, pointVec, true);
    } else {
      bodyData.body.applyImpulse(impulseVec, true);
    }
  }

  /**
   * Set velocity of a body
   */
  setVelocity(mesh: THREE.Object3D, velocity: THREE.Vector3, angular?: THREE.Vector3) {
    const bodyData = this.getBodyByMesh(mesh);
    if (!bodyData) return;

    bodyData.body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    
    if (angular) {
      bodyData.body.setAngvel({ x: angular.x, y: angular.y, z: angular.z }, true);
    }
  }

  /**
   * Get velocity of a body
   */
  getVelocity(mesh: THREE.Object3D): { linear: THREE.Vector3; angular: THREE.Vector3 } | null {
    const bodyData = this.getBodyByMesh(mesh);
    if (!bodyData) return null;

    const linvel = bodyData.body.linvel();
    const angvel = bodyData.body.angvel();
    
    return {
      linear: new THREE.Vector3(linvel.x, linvel.y, linvel.z),
      angular: new THREE.Vector3(angvel.x, angvel.y, angvel.z)
    };
  }

  /**
   * Check if body is grounded (touching ground)
   */
  isGrounded(mesh: THREE.Object3D, maxDistance = 0.1): boolean {
    const { world } = this.ensureInitialized();
    const bodyData = this.getBodyByMesh(mesh);
    if (!bodyData) return false;

    const pos = bodyData.body.translation();
    const ray = new RAPIER.Ray(pos, { x: 0, y: -1, z: 0 });
    
    const hit = world.castRay(ray, maxDistance, true, undefined, undefined, bodyData.body);
    return hit !== null;
  }

  /**
   * Remove physics body
   */
  removeBody(mesh: THREE.Object3D) {
    const { world } = this.ensureInitialized();
    const handle = this.meshToHandle.get(mesh);
    
    if (handle !== undefined) {
      const bodyData = this.bodies.get(handle);
      if (bodyData) {
        world.removeRigidBody(bodyData.body);
        this.bodies.delete(handle);
        this.meshToHandle.delete(mesh);
      }
    }
  }

  /**
   * Main update function - call this every frame
   */
  update(deltaTime: number) {
    const { world, eventQueue } = this.ensureInitialized();

    // Fixed timestep physics for deterministic simulation
    this.accumulator += Math.min(deltaTime, 0.25); // Cap large deltas
    
    let steps = 0;
    while (this.accumulator >= this.FIXED_TIMESTEP && steps < this.MAX_SUBSTEPS) {
      world.step(eventQueue);
      this.accumulator -= this.FIXED_TIMESTEP;
      steps++;
    }

    // Handle collision events
    this.processCollisionEvents();

    // Sync Three.js meshes with physics bodies
    this.syncMeshesWithBodies();
  }

  /**
   * Add collision event listeners
   */
  onCollisionEnter(callback: (event: CollisionEvent) => void) {
    this.collisionEnterCallbacks.push(callback);
  }

  onCollisionExit(callback: (event: CollisionEvent) => void) {
    this.collisionExitCallbacks.push(callback);
  }

  /**
   * Get body data by mesh
   */
  getBodyByMesh(mesh: THREE.Object3D): PhysicsBodyData | null {
    const handle = this.meshToHandle.get(mesh);
    return handle !== undefined ? this.bodies.get(handle) || null : null;
  }

  /**
   * Cleanup physics world
   */
  dispose() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    this.bodies.clear();
    this.meshToHandle.clear();
    this.collisionEnterCallbacks.length = 0;
    this.collisionExitCallbacks.length = 0;
  }

  // Private helper methods

  private registerBody(mesh: THREE.Object3D, body: RAPIER.RigidBody, type: PhysicsBodyType, userData?: any) {
    const handle = body.handle;
    const bodyData: PhysicsBodyData = { mesh, body, type, userData };
    
    this.bodies.set(handle, bodyData);
    this.meshToHandle.set(mesh, handle);
  }

  private getHalfExtents(mesh: THREE.Mesh): { hx: number; hy: number; hz: number } {
    const geometry = mesh.geometry;
    
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    
    const box = geometry.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Apply mesh scale
    size.multiply(mesh.scale);
    
    return {
      hx: size.x / 2,
      hy: size.y / 2,
      hz: size.z / 2
    };
  }

  private getSphereRadius(mesh: THREE.Mesh): number {
    const geometry = mesh.geometry;
    
    if (!geometry.boundingSphere) {
      geometry.computeBoundingSphere();
    }
    
    const radius = geometry.boundingSphere!.radius;
    const maxScale = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
    
    return radius * maxScale;
  }

  private processCollisionEvents() {
    const { eventQueue } = this.ensureInitialized();
    
    eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
      const bodyData1 = this.bodies.get(handle1);
      const bodyData2 = this.bodies.get(handle2);
      
      if (!bodyData1 || !bodyData2) return;

      // Create collision event (simplified - you might want to get actual contact info)
      const event: CollisionEvent = {
        object1: bodyData1.mesh,
        object2: bodyData2.mesh,
        contact: null // You can implement proper contact manifold if needed
      };

      if (started) {
        this.collisionEnterCallbacks.forEach(callback => callback(event));
      } else {
        this.collisionExitCallbacks.forEach(callback => callback(event));
      }
    });
  }

  private syncMeshesWithBodies() {
    for (const [, bodyData] of this.bodies) {
      if (bodyData.body.isDynamic()) {
        const translation = bodyData.body.translation();
        const rotation = bodyData.body.rotation();
        
        bodyData.mesh.position.set(translation.x, translation.y, translation.z);
        bodyData.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    }
  }
}