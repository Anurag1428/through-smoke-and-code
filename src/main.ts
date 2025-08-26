import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import Player from "./Player.js";
import { CustomScene } from "./Scene.js";

async function init() {
  console.log("🚀 Initializing game...");
  await RAPIER.init();
  console.log("✅ Rapier initialized");

  // Create physics world
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  console.log("✅ Physics world created");

  // Use YOUR CustomScene instead of basic THREE.Scene
  const scene = new CustomScene(world);
  scene.background = new THREE.Color(0x87CEEB); // Sky blue instead of dark
  console.log("✅ CustomScene created");

  // FPS Camera setup
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  console.log("✅ Camera created");

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  console.log("✅ Renderer created");

  // Create player
  const player = new Player(scene, world);
  player.setCamera(camera); // Connect camera to player for movement
  console.log("✅ Player created");

  // FPS Camera Controls
  let isLocked = false;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const PI_2 = Math.PI / 2;
  let yaw = 0;
  let pitch = 0;

  // Pointer lock for FPS controls
  function lock() {
    document.body.requestPointerLock();
  }

  function unlock() {
    document.exitPointerLock();
  }

  document.addEventListener('click', lock);
  
  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === document.body;
    console.log(isLocked ? "🔒 Mouse locked" : "🔓 Mouse unlocked");
  });

  document.addEventListener('mousemove', (event) => {
    if (!isLocked) return;

    const sensitivity = 0.002;
    yaw -= event.movementX * sensitivity;
    pitch -= event.movementY * sensitivity;
    pitch = Math.max(-PI_2, Math.min(PI_2, pitch));

    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
  });

  // Escape to unlock
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      unlock();
    }
  });

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  console.log("🎮 Starting game loop...");
  console.log("💡 Click to lock mouse for FPS controls, ESC to unlock");
  console.log("🎮 Use WASD to move, Space to jump");

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    // Update physics
    world.step();
    
    // Update player
    player.update();
    
    // FPS Camera follows player position
    const playerPos = player.mesh.position;
    camera.position.copy(playerPos);
    camera.position.y += 1.6; // Eye level height
    
    // Render
    renderer.render(scene, camera);
  }
  animate();
}

init().catch(console.error);