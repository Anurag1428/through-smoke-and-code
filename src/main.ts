// main.ts - Simple test version to debug issues
import * as THREE from "three";

// Simple scene setup first - no physics yet
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Try to set color space safely
try {
  (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
} catch (e) {
  console.log("Color space setting not available in this Three.js version");
}

document.body.appendChild(renderer.domElement);
document.body.style.margin = "0";
document.body.style.overflow = "hidden";

// Create basic objects to test if Three.js is working
console.log("Creating basic scene...");

// Ground
const groundGeometry = new THREE.BoxGeometry(20, 1, 20);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.set(0, -0.5, 0);
ground.receiveShadow = true;
scene.add(ground);

// Player box
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 2, 0);
player.castShadow = true;
scene.add(player);

// Test collectible
const collectibleGeometry = new THREE.SphereGeometry(0.5, 12, 8);
const collectibleMaterial = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
const collectible = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
collectible.position.set(3, 2, 0);
collectible.castShadow = true;
scene.add(collectible);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Camera position
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

console.log("Scene created, starting render loop...");

// Simple animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const time = clock.getElapsedTime();
  
  // Simple animations to test
  player.rotation.y += 0.01;
  collectible.position.y = 2 + Math.sin(time * 2) * 0.5;
  collectible.rotation.y += 0.02;
  
  renderer.render(scene, camera);
}

// Start the animation
animate();

console.log("Animation loop started!");

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Test physics loading
async function testPhysics() {
  try {
    console.log("Testing Rapier physics loading...");
    
    // @ts-ignore
    const RAPIER = await import("@dimforge/rapier3d-compat");
    await RAPIER.init();
    
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    const world = new RAPIER.World(gravity);
    
    console.log("✅ Rapier physics loaded successfully!");
    console.log("World created:", world);
    
    // Now you can proceed with full physics integration
    initFullPhysics(RAPIER, world);
    
  } catch (error) {
    console.error("❌ Failed to load Rapier physics:", error);
    console.log("Continuing without physics for now...");
  }
}

function initFullPhysics(RAPIER: any, world: any) {
  console.log("Initializing physics for existing objects...");
  
  // Create physics bodies for existing objects
  const groundRigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(0, -0.5, 0);
  const groundRigidBody = world.createRigidBody(groundRigidBodyDesc);
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.5, 10);
  world.createCollider(groundColliderDesc, groundRigidBody);
  
  const playerRigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 2, 0);
  const playerRigidBody = world.createRigidBody(playerRigidBodyDesc);
  const playerColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 1, 0.5);
  world.createCollider(playerColliderDesc, playerRigidBody);
  
  // Input handling
  const keys: { [key: string]: boolean } = {};
  
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
  });
  
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  
  // Physics update loop
  function updatePhysics() {
    // Handle input
    if (keys['KeyW'] || keys['ArrowUp']) {
      playerRigidBody.applyForce({ x: 0, y: 0, z: -50 }, true);
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
      playerRigidBody.applyForce({ x: 0, y: 0, z: 50 }, true);
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
      playerRigidBody.applyForce({ x: -50, y: 0, z: 0 }, true);
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
      playerRigidBody.applyForce({ x: 50, y: 0, z: 0 }, true);
    }
    if (keys['Space']) {
      playerRigidBody.applyImpulse({ x: 0, y: 15, z: 0 }, true);
    }
    
    // Step physics
    world.step();
    
    // Update mesh positions
    const playerPos = playerRigidBody.translation();
    const playerRot = playerRigidBody.rotation();
    player.position.set(playerPos.x, playerPos.y, playerPos.z);
    player.quaternion.set(playerRot.x, playerRot.y, playerRot.z, playerRot.w);
    
    requestAnimationFrame(updatePhysics);
  }
  
  updatePhysics();
  console.log("✅ Physics integration complete! Use WASD and Space to control the green box.");
}

// Test physics after a short delay
setTimeout(testPhysics, 1000);