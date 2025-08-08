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
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.addLight(ambientLight);

        // Add directional light (sun-like)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -25;
        directionalLight.shadow.camera.right = 25;
        directionalLight.shadow.camera.top = 25;
        directionalLight.shadow.camera.bottom = -25;
        this.addLight(directionalLight);

        // Add some point lights for atmosphere
        this.addRandomPointLights();
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
        cube.castShadow = true;
        cube.receiveShadow = true;
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
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        this.addMesh(sphere);
        
        return sphere;
    }

    // Create a large ground plane
    public createGround(size: number = 50): THREE.Mesh {
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x2d5a2d,
            roughness: 0.8,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(geometry, material);
        
        ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.addMesh(ground);
        
        return ground;
    }

    // Add random point lights for atmosphere
    private addRandomPointLights(): void {
        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xfeca57, 0xff9ff3];
        
        for (let i = 0; i < 5; i++) {
            const pointLight = new THREE.PointLight(colors[i], 0.5, 10);
            pointLight.position.set(
                (Math.random() - 0.5) * 30,
                2 + Math.random() * 3,
                (Math.random() - 0.5) * 30
            );
            this.addLight(pointLight);
        }
    }

    // Generate random objects scattered around the scene
    public populateWithRandomObjects(count: number = 20): void {
        const shapes = ['cube', 'sphere'];
        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xfeca57, 0xff9ff3, 0x96ceb4, 0xffeaa7];
        
        for (let i = 0; i < count; i++) {
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const position = new THREE.Vector3(
                (Math.random() - 0.5) * 40, // Spread across ground
                0.5 + Math.random() * 2,    // Above ground
                (Math.random() - 0.5) * 40
            );
            
            if (shape === 'cube') {
                const size = 0.5 + Math.random() * 1.5;
                this.createCube(size, color, position);
            } else {
                const radius = 0.3 + Math.random() * 0.8;
                this.createSphere(radius, color, position);
            }
        }
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