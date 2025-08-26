import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export default class Player {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  world: RAPIER.World;

  private moveSpeed = 6;
  private jumpForce = 10;
  private isGrounded = false;
  private keys: Record<string, boolean> = {};
  private canJump = true;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.world = world;

    // Player mesh (capsule for FPS)
    const geometry = new THREE.CapsuleGeometry(0.4, 1, 8, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 2, 0);
    scene.add(this.mesh);

    // Player rigid body (capsule)
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 2, 0)
      .lockRotations();
    this.body = world.createRigidBody(bodyDesc);

    // Capsule: halfHeight = 0.5, radius = 0.4
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setFriction(0.2);
    world.createCollider(colliderDesc, this.body);

    // Input
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "Space" || e.code === "Numpad0") this.canJump = true;
    });
  }

  update() {
    // --- Movement ---
    let dir = new THREE.Vector3();
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) dir.z -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) dir.z += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) dir.x -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) dir.x += 1;
    dir.normalize();

    // Check if grounded (raycast down)
    const pos = this.body.translation();
    const rayOrigin = { x: pos.x, y: pos.y - 0.6, z: pos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const hit = this.world.castRay(ray, 0.15, true);
    this.isGrounded = !!(hit && hit.toi !== undefined);

    // Jump (only once per key press)
    if (
      this.isGrounded &&
      (this.keys["Space"] || this.keys["Numpad0"]) &&
      this.canJump
    ) {
      this.body.setLinvel(
        { x: this.body.linvel().x, y: this.jumpForce, z: this.body.linvel().z },
        true
      );
      this.canJump = false;
    }

    // Set horizontal velocity
    const speed = this.moveSpeed;
    const targetVel = { x: dir.x * speed, y: this.body.linvel().y, z: dir.z * speed };
    this.body.setLinvel(targetVel, true);

    // Sync mesh with physics - FIXED TYPO
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);

    // No rotation for FPS player
    this.mesh.rotation.set(0, 0, 0);
  }
}