import * as THREE from 'three';

export class CustomCamera extends THREE.PerspectiveCamera {
    constructor(
        fov: number = 70,
        aspect: number = window.innerWidth / window.innerHeight,
        near: number = 0.01,
        far: number = 10
    ) {
        super(fov, aspect, near, far);
        this.position.z = 1;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    private onWindowResize(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.aspect = width / height;
        this.updateProjectionMatrix();
    }

    // Custom method to smoothly move camera to a position
    public moveToPosition(x: number, y: number, z: number, duration: number = 1000): Promise<void> {
        return new Promise((resolve) => {
            const startPos = this.position.clone();
            const targetPos = new THREE.Vector3(x, y, z);
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Smooth easing function
                const eased = 1 - Math.pow(1 - progress, 3);
                
                this.position.lerpVectors(startPos, targetPos, eased);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            animate();
        });
    }

    // Method to get camera info for debugging
    public getInfo(): string {
        return `Camera Position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)})`;
    }
}