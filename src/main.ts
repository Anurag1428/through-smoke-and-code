// main.ts – crash-free, delta-time passed
import * as THREE from "three";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"; // remove if unused
import { PlayerController } from "./Player";

class FPSGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    1000
  );
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private lastTime = performance.now();

  // physics
  private RAPIER: any;
  private world: any;
  private player: PlayerController | null = null;

  constructor() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 5, 10);
    this.init();
  }

  async init() {
    // 1. load rapier
    this.RAPIER = await import("@dimforge/rapier3d-compat");
    await this.RAPIER.init();
    this.world = new this.RAPIER.World({ x: 0, y: -9.81, z: 0 });

    // 2. simple ground
    const ground = this.world.createRigidBody(
      this.RAPIER.RigidBodyDesc.fixed()
    );
    this.world.createCollider(
      this.RAPIER.ColliderDesc.cuboid(25, 0.1, 25),
      ground
    );

    // 3. player (⚠️ ensure PlayerController does not `scene.add(Vector3)`)
    this.player = new PlayerController(this.world, this.scene, {
      position: new THREE.Vector3(0, 3, 0),
    });
    this.player.attachCamera(this.camera);

    // 4. light & start
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    this.scene.add(new THREE.AmbientLight(0x404040), dirLight);

    this.gameLoop();
  }

  private gameLoop = () => {
    requestAnimationFrame(this.gameLoop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // seconds
    this.lastTime = now;

    // ✅ Rapier step takes no arguments
    this.world.step();

    // pass dt to player for movement updates
    this.player?.update(dt);

    // render scene
    this.renderer.render(this.scene, this.camera);
  };
}

new FPSGame();
