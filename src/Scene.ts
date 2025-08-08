import * as THREE from 'three';

export class CustomScene extends THREE.Scene {
    private meshes: THREE.Mesh[] = [];
    private lights: THREE.Light[] = [];

    constructor() {
        super();
        this.setupDefaultLighting();
    }

    private setupDefaultLighting(): void {
        // Add ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.addLight(ambientLight);

        // Add directional light for shadows and definition
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.addLight(directionalLight);
    }

    // Custom method to add meshes with tracking
    public addMesh(mesh: THREE.Mesh): void {
        this.meshes.push(mesh);
        this.add(mesh);
    }

    // Custom method to add lights with tracking
    public addLight(light: THREE.Light): void {
        this.lights.push(light);
        this.add(light);
    }

    // Remove mesh and clean up
    public removeMesh(mesh: THREE.Mesh): void {
        const index = this.meshes.indexOf(mesh);
        if (index > -1) {
            this.meshes.splice(index, 1);
            this.remove(mesh);
            
            // Clean up geometry and materials
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(material => material.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
    }

    // Get all meshes in the scene
    public getMeshes(): THREE.Mesh[] {
        return [...this.meshes];
    }

    // Get all lights in the scene
    public getLights(): THREE.Light[] {
        return [...this.lights];
    }

    // Method to animate all meshes
    public animateMeshes(time: number): void {
        this.meshes.forEach((mesh, index) => {
            // Default rotation animation
            mesh.rotation.x = time / 2000 + index * 0.5;
            mesh.rotation.y = time / 1000 + index * 0.3;
        });
    }

    // Method to create and add a basic cube
    public createCube(
        size: number = 0.2,
        color: number = 0xff0000,
        position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    ): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ color });
        const cube = new THREE.Mesh(geometry, material);
        
        cube.position.copy(position);
        this.addMesh(cube);
        
        return cube;
    }

    // Method to create and add a sphere
    public createSphere(
        radius: number = 0.1,
        color: number = 0x00ff00,
        position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    ): THREE.Mesh {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color });
        const sphere = new THREE.Mesh(geometry, material);
        
        sphere.position.copy(position);
        this.addMesh(sphere);
        
        return sphere;
    }

    // Method to clear all custom objects
    public clearScene(): void {
        // Remove all meshes
        this.meshes.forEach(mesh => {
            this.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(material => material.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        this.meshes = [];

        // Remove all lights except defaults
        this.lights.forEach(light => {
            this.remove(light);
        });
        this.lights = [];
        
        // Re-add default lighting
        this.setupDefaultLighting();
    }

    // Get scene statistics
    public getStats(): { meshes: number; lights: number; triangles: number } {
        let triangles = 0;
        this.meshes.forEach(mesh => {
            if (mesh.geometry) {
                const geometry = mesh.geometry;
                if (geometry.index) {
                    triangles += geometry.index.count / 3;
                } else if (geometry.attributes.position) {
                    triangles += geometry.attributes.position.count / 3;
                }
            }
        });

        return {
            meshes: this.meshes.length,
            lights: this.lights.length,
            triangles: Math.floor(triangles)
        };
    }
}