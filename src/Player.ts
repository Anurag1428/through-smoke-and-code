// PlayerController.ts – crash-safe
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";

export class PlayerController {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private camera: THREE.PerspectiveCamera | null = null;

  private moveSpeed = 5;
  private walkSpeed = 2.5;
  private jumpForce = 10;

  private keys: Record<string, boolean> = {};
  private isGrounded = false;
  private lastGroundTime = 0;
  private jumpPressed = false;
  private jumpCooldown = 0;

  private yaw = 0;
  private pitch = 0;
  private mouseSens = 0.002;
  private maxPitch = Math.PI / 2 - 0.01;

  constructor(world: RAPIER.World, scene: THREE.Scene, opts: { position?: THREE.Vector3 } = {}) {
    this.world = world;

    // physics body – plain JS objects only
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(opts.position?.x ?? 0, opts.position?.y ?? 3, opts.position?.z ?? 0)
      .lockRotations();
    this.body = world.createRigidBody(desc);
    const half = 0.9 - 0.4; // height 1.8, radius 0.4
    const col = RAPIER.ColliderDesc.capsule(half, 0.4).setFriction(0.1);
    world.createCollider(col, this.body);

    // dummy capsule mesh
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 })
    );
    scene.add(mesh);
    (this as any)._mesh = mesh;

    this.bindInput();
  }

  private bindInput() {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
      if (e.code === "Space" && !this.jumpPressed) this.jumpPressed = true;
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
        this.camera?.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      }
    };
    document.addEventListener("keydown", kd);
    document.addEventListener("keyup", ku);
    document.addEventListener("mousemove", mm);
    document.addEventListener("click", () => document.body.requestPointerLock?.());
  }

  attachCamera(cam: THREE.PerspectiveCamera) {
    this.camera = cam;
  }

  update(dt: number) {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    // 1. input
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

    // 2. ground check
    const pos = this.body.translation();
    const vel = this.body.linvel();
    const hit = this.world.castRay(
      new RAPIER.Ray({ x: pos.x, y: pos.y - 0.9, z: pos.z }, { x: 0, y: -1, z: 0 }),
      0.25,
      true,
      undefined,
      undefined,
      this.body
    );
    this.isGrounded = hit !== null;

    // 3. jump
    if (this.jumpPressed && this.isGrounded && this.jumpCooldown === 0) {
      this.body.setLinvel({ x: vel.x, y: this.jumpForce, z: vel.z }, true);
      this.jumpCooldown = 0.15;
      this.jumpPressed = false;
    }

    // 4. move – frame-rate independent
    const accel = 20;
    const nextVel = new THREE.Vector3(
      THREE.MathUtils.lerp(vel.x, dir.x * speed, accel * dt),
      vel.y,
      THREE.MathUtils.lerp(vel.z, dir.z * speed, accel * dt)
    );
    this.body.setLinvel(nextVel, true);

    // 5. sync camera & mesh
    if (this.camera) {
      this.camera.position.set(pos.x, pos.y + 0.8, pos.z);
    }
    ((this as any)._mesh as THREE.Mesh).position.set(pos.x, pos.y, pos.z);
  }
}