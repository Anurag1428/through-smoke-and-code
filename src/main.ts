import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import Player from "./Player.js";
import { CustomScene } from "./Scene.js"; // ✅ Import your CustomScene

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

  // Camera setup
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 10, 20); // Higher up to see the terrain
  console.log("✅ Camera created");

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; // Enable shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  console.log("✅ Renderer created");

  // Create player
  const player = new Player(scene, world);
  console.log("✅ Player created");

  // Basic camera controls (optional - remove if you have FPS controls)
  let mouseX = 0;
  let mouseY = 0;
  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  console.log("🎮 Starting game loop...");

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    // Update physics
    world.step();
    
    // Update player
    player.update();
    
    // Simple camera follow (replace with your FPS camera if you have one)
    const playerPos = player.mesh.position;
    camera.position.x = playerPos.x + mouseX * 5;
    camera.position.y = playerPos.y + 8;
    camera.position.z = playerPos.z + 15;
    camera.lookAt(playerPos);
    
    // Render
    renderer.render(scene, camera);
  }
  animate();
}

init().catch(console.error);