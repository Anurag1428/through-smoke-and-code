// src/Player.ts
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

type PlayerOpts = {
  position?: THREE.Vector3;
  debugMesh?: boolean;
};

export class PlayerController {
  private world: any;
  public body: any;
  private camera: THREE.PerspectiveCamera | null = null;

  private moveSpeed = 5;
  private walkSpeed = 2.5;
  private jumpForce = 10;

  private keys: Record<string, boolean> = {};
  private isGrounded = false;
  private jumpPressed = false;
  private jumpCooldown = 0;

  private yaw = 0;
  private pitch = 0;
  private mouseSens = 0.002;
  private maxPitch = Math.PI / 2 - 0.01;

  private mesh?: THREE.Mesh;
  private eyeHeight = 0.9; // camera sits ~0.9 above body origin

  constructor(world: any, scene: THREE.Scene, opts: PlayerOpts = {}) {
    this.world = world;

    const start = opts.position ?? new THREE.Vector3(0, 1.6, 0);

    // create Rapier rigid body (capsule)
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x, start.y, start.z)
      .lockRotations();
    this.body = world.createRigidBody(desc);

    const half = 0.9 - 0.4; // (height 1.8, radius 0.4)
    const col = RAPIER.ColliderDesc.capsule(half, 0.4).setFriction(0.1);
    world.createCollider(col, this.body);

    // optional debug mesh (capsule)
    if (opts.debugMesh ?? true) {
      this.mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 1, 8, 16),
        new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.25 })
      );
      scene.add(this.mesh);
    }

    this.bindInput();
  }

  private bindInput() {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
      if (e.code === "Space") this.jumpPressed = true;
      this.keys[e.code] = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") this.jumpPressed = false;
      this.keys[e.code] = false;
    };
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement === document.body) {
        this.yaw -= e.movementX * this.mouseSens;
        this.pitch -= e.movementY * this.mouseSens;
        this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
      }
    };

    document.addEventListener("keydown", kd);
    document.addEventListener("keyup", ku);
    document.addEventListener("mousemove", mm);
    document.addEventListener("click", () => document.body.requestPointerLock?.());
  }

  attachCamera(cam: THREE.PerspectiveCamera) {
    this.camera = cam;
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  update(dt: number) {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    // input
    let fwd = 0, rgt = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) fwd = 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) fwd = -1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) rgt = 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) rgt = -1;

    const dir = new THREE.Vector3();
    if (fwd || rgt) {
      dir.addScaledVector(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), fwd)
         .addScaledVector(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), rgt)
         .normalize();
    }
    const speed = this.keys["ShiftLeft"] || this.keys["ShiftRight"] ? this.walkSpeed : this.moveSpeed;

    // ground check (fixed castRay call)
    const pos = this.body.translation();
    const vel = this.body.linvel();
    const ray = new RAPIER.Ray(
      { x: pos.x, y: pos.y - this.eyeHeight, z: pos.z },
      { x: 0, y: -1, z: 0 }
    );
    const hit = this.world.castRay(ray, 0.25, true, undefined, undefined, this.body);
    this.isGrounded = hit !== null;

    // jump
    if (this.jumpPressed && this.isGrounded && this.jumpCooldown === 0) {
      this.body.setLinvel({ x: vel.x, y: this.jumpForce, z: vel.z }, true);
      this.jumpCooldown = 0.15;
      this.jumpPressed = false;
    }

    // movement (frame-rate independent)
    const accel = 20;
    const nextVel = new THREE.Vector3(
      THREE.MathUtils.lerp(vel.x, dir.x * speed, accel * dt),
      vel.y,
      THREE.MathUtils.lerp(vel.z, dir.z * speed, accel * dt)
    );
    this.body.setLinvel(nextVel, true);

    // sync camera & mesh
    if (this.camera) {
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      this.camera.position.set(pos.x, pos.y + this.eyeHeight, pos.z);
    }
    if (this.mesh) {
      this.mesh.position.set(pos.x, pos.y, pos.z);
    }
  }
}
