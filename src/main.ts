// src/main.ts
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PlayerController } from "./Player";
import { CustomScene } from "./Scene";

class FPSGame {
  private scene: CustomScene = new CustomScene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private lastTime = performance.now();

  private world: any;
  private player: PlayerController | null = null;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.style.margin = "0";
    document.body.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 1.6, 6);
    this.camera.lookAt(0, 1.6, 0);

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.init();
  }

  private async init() {
    // init Rapier
    await RAPIER.init();
    this.world = new (RAPIER as any).World({ x: 0, y: -9.81, z: 0 });

    // physics ground
    const groundRb = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(25, 0.1, 25), groundRb);

    // visible ground + scatter
    this.scene.createGround(100);
    this.scene.populateWithRandomObjects(30);

    // spawn player (debugMesh:false to avoid camera-inside-mesh)
    this.player = new PlayerController(this.world, this.scene, {
      position: new THREE.Vector3(0, 1.6, 0),
      debugMesh: false,
    });
    this.player.attachCamera(this.camera);

    // helpful visual grid
    const grid = new THREE.GridHelper(100, 100, 0x333333, 0x222222);
    grid.position.y = 0.01;
    this.scene.add(grid);

    this.gameLoop();
  }

  private gameLoop = () => {
    requestAnimationFrame(this.gameLoop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.world?.step();
    this.player?.update(dt);
    this.scene.animateMeshes(now);
    this.renderer.render(this.scene, this.camera);
  };
}

new FPSGame();
