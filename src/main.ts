import * as THREE from 'three';
import { CustomCamera } from './Camera';
import { CustomRenderer } from './Renderer';
import { CustomScene } from './Scene';
import { InputManager } from './InputManager';

class ThreeJSApp {
    private camera!: CustomCamera;
    private renderer!: CustomRenderer;
    private scene!: CustomScene;
    private inputManager!: InputManager;
    private cube!: THREE.Mesh;
    private lastTime: number = 0;

    constructor() {
        this.init();
    }

    private init(): void {
        // Initialize core components
        this.camera = new CustomCamera();
        this.renderer = new CustomRenderer();
        this.scene = new CustomScene();
        this.inputManager = new InputManager();

        // Create the world
        this.createWorld();

        // Start the animation loop
        this.startAnimation();

        // Log initial stats
        console.log('Scene Stats:', this.scene.getStats());
        console.log(this.camera.getInfo());
    }

    private createWorld(): void {
        // Create ground
        this.scene.createGround(100);
        
        // Create the original cube with MeshNormalMaterial for the rainbow effect
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(0, 1, 0);
        this.cube.castShadow = true;
        this.cube.receiveShadow = true;
        this.scene.addMesh(this.cube);

        // Populate with random objects
        this.scene.populateWithRandomObjects(30);
        
        // Add some large landmark objects
        this.scene.createCube(3, 0x8b4513, new THREE.Vector3(10, 1.5, 10)); // Brown cube
        this.scene.createSphere(2, 0x4169e1, new THREE.Vector3(-10, 2, -10)); // Blue sphere
        this.scene.createCube(2, 0xff1493, new THREE.Vector3(15, 1, -15)); // Pink cube
    }

    private startAnimation(): void {
        this.renderer.startAnimationLoop((time: number) => {
            const deltaTime = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
            this.lastTime = time;
            
            this.update(deltaTime);
            this.render();
        });
    }

    private update(deltaTime: number): void {
        // Update camera based on input
        this.camera.update(this.inputManager, deltaTime);
        
        // You can add other update logic here if needed
        // Example: animate other objects
        // this.cube.rotation.y += deltaTime;
    }

    private render(): void {
        this.renderer.renderScene(this.scene, this.camera);
    }

    // Public methods for interaction
    public addRandomCube(): THREE.Mesh {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        const color = Math.random() * 0xffffff;
        return this.scene.createCube(0.1, color, position);
    }

    public addRandomSphere(): THREE.Mesh {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        const color = Math.random() * 0xffffff;
        return this.scene.createSphere(0.05, color, position);
    }

    public clearScene(): void {
        this.scene.clearScene();
        this.createWorld();
    }

    public takeScreenshot(): void {
        const dataURL = this.renderer.takeScreenshot();
        const link = document.createElement('a');
        link.download = 'threejs-screenshot.png';
        link.href = dataURL;
        link.click();
    }

    public getStats(): void {
        console.log('Scene Stats:', this.scene.getStats());
        console.log(this.camera.getInfo());
    }

    // Cleanup method
    public dispose(): void {
        this.renderer.dispose();
        this.inputManager.dispose();
        this.scene.clearScene();
    }
}

// Initialize the application
const app = new ThreeJSApp();

// Make app available globally for debugging
(window as any).app = app;

// Optional: Add keyboard shortcuts for debugging
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyC':
            app.addRandomCube();
            break;
        case 'KeyS':
            app.addRandomSphere();
            break;
        case 'KeyR':
            app.clearScene();
            break;
        case 'KeyP':
            app.takeScreenshot();
            break;
        case 'KeyI':
            app.getStats();
            break;
        case 'Escape':
            // Exit pointer lock on Escape key
            document.exitPointerLock();
            break;
    }
});

console.log('Controls:');
console.log('- Click anywhere to enable mouse look (pointer lock)');
console.log('- WASD to move, Space to go up, Shift to go down');
console.log('- Hold Shift while moving to sprint');
console.log('- ESC to exit pointer lock');
console.log('- C = Add Cube, S = Add Sphere, R = Reset Scene, P = Screenshot, I = Info');