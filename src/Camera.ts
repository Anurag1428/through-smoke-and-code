import * as THREE from 'three';

export class CustomCamera extends THREE.PerspectiveCamera {
    private isPointerLocked: boolean = false;
    private mouseSensitivity: number = 0.002;
    private euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
    private PI_2: number = Math.PI / 2;

    constructor(
        fov: number = 70,
        aspect: number = window.innerWidth / window.innerHeight,
        near: number = 0.01,
        far: number = 10
    ) {
        super(fov, aspect, near, far);
        this.position.z = 1;
        this.setupEventListeners();
        this.setupPointerLock();
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.addEventListener('click', this.requestPointerLock.bind(this), false);
    }

    private setupPointerLock(): void {
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this), false);
        document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this), false);
    }

    private onWindowResize(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.aspect = width / height;
        this.updateProjectionMatrix();
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isPointerLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.euler.setFromQuaternion(this.quaternion);

        this.euler.y -= movementX * this.mouseSensitivity;
        this.euler.x -= movementY * this.mouseSensitivity;

        // Limit vertical rotation to prevent camera flipping
        this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));

        this.quaternion.setFromEuler(this.euler);
    }

    private requestPointerLock(): void {
        document.body.requestPointerLock();
    }

    private onPointerLockChange(): void {
        this.isPointerLocked = document.pointerLockElement === document.body;
        
        if (this.isPointerLocked) {
            console.log('Pointer locked - Mouse controls active');
        } else {
            console.log('Pointer unlocked - Click to enable mouse controls');
        }
    }

    private onPointerLockError(): void {
        console.error('Pointer lock error');
        this.isPointerLocked = false;
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
        return `Camera Position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}) | Pointer Locked: ${this.isPointerLocked}`;
    }

    // Public method to set mouse sensitivity
    public setMouseSensitivity(sensitivity: number): void {
        this.mouseSensitivity = sensitivity;
    }

    // Public method to get pointer lock status
    public getPointerLockStatus(): boolean {
        return this.isPointerLocked;
    }

    // Public method to manually exit pointer lock
    public exitPointerLock(): void {
        if (this.isPointerLocked) {
            document.exitPointerLock();
        }
    }

    // Cleanup method
    public dispose(): void {
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('click', this.requestPointerLock.bind(this));
        document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
        document.removeEventListener('pointerlockerror', this.onPointerLockError.bind(this));
        this.exitPointerLock();
    }
}