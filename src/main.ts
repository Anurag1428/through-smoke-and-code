import * as THREE from 'three';
import { CustomCamera } from './Camera';
import { CustomRenderer } from './Renderer';
import { CustomScene } from './Scene';

class ThreeJSApp {
    private camera!: CustomCamera;
    private renderer!: CustomRenderer;
    private scene!: CustomScene;
    private cube!: THREE.Mesh;

    constructor() {
        this.init();
    }

    private init(): void {
        // Initialize core components
        this.camera = new CustomCamera();
        this.renderer = new CustomRenderer();
        this.scene = new CustomScene();

        // Create initial objects
        this.createInitialObjects();

        // Start the animation loop
        this.startAnimation();

        // Log initial stats
        console.log('Scene Stats:', this.scene.getStats());
        console.log(this.camera.getInfo());
    }

    private createInitialObjects(): void {
        // Create the original cube with MeshNormalMaterial for the rainbow effect
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshNormalMaterial();
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.addMesh(this.cube);

        // You can add more objects here
        // Example: Add a sphere
        // this.scene.createSphere(0.1, 0x00ff00, new THREE.Vector3(0.5, 0, 0));
    }

    private startAnimation(): void {
        this.renderer.startAnimationLoop((time: number) => {
            this.update(time);
            this.render();
        });
    }

    private update(time: number): void {
        // Update the original cube rotation
        this.cube.rotation.x = time / 2000;
        this.cube.rotation.y = time / 1000;

        // You can add more update logic here
        // Example: Update all meshes in scene
        // this.scene.animateMeshes(time);
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
        this.createInitialObjects();
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
    }
});

console.log('Controls: C = Add Cube, S = Add Sphere, R = Reset Scene, P = Screenshot, I = Info');