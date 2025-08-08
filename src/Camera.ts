import * as THREE from 'three';
import type { InputState } from './InputManager';
import { InputManager } from './InputManager';     

export class CustomCamera extends THREE.PerspectiveCamera {
    private isPointerLocked: boolean = false;
    private mouseSensitivity: number = 0.002;
    private euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
    private PI_2: number = Math.PI / 2;
    
    // Movement properties
    private moveDirection: THREE.Vector3 = new THREE.Vector3();
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private speed: number = 5.0;
    private sprintMultiplier: number = 2.0;

    constructor(
        fov: number = 70,
        aspect: number = window.innerWidth / window.innerHeight,
        near: number = 0.01,
        far: number = 1000
    ) {
        super(fov, aspect, near, far);
        this.position.set(0, 2, 5); // Start above ground level
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

        // Fixed controls: 
        // Moving mouse right (positive movementX) should rotate camera right (add to Y)
        // Moving mouse up (negative movementY) should look up (add to X)
        this.euler.y += movementX * this.mouseSensitivity;
        this.euler.x += movementY * this.mouseSensitivity;

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

    // Update camera position based on input
    public update(inputManager: InputManager, deltaTime: number): void {
        const input = inputManager.getInputState();
        
        // Calculate movement direction based on camera orientation
        this.updateMovementDirection(input);
        
        // Apply movement
        this.applyMovement(input, deltaTime);
    }

    private updateMovementDirection(input: InputState): void {
        this.moveDirection.set(0, 0, 0);
        
        // Get camera's forward and right vectors
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);
        
        // Calculate movement direction
        if (input.forward) this.moveDirection.add(forward);
        if (input.backward) this.moveDirection.sub(forward);
        if (input.right) this.moveDirection.add(right);
        if (input.left) this.moveDirection.sub(right);
        
        // Normalize movement direction (for diagonal movement)
        if (this.moveDirection.length() > 0) {
            this.moveDirection.normalize();
        }
    }

    private applyMovement(input: InputState, deltaTime: number): void {
        const currentSpeed = input.shift ? this.speed * this.sprintMultiplier : this.speed;
        
        // Apply horizontal movement
        this.velocity.x = this.moveDirection.x * currentSpeed;
        this.velocity.z = this.moveDirection.z * currentSpeed;
        
        // Apply vertical movement
        if (input.up) {
            this.velocity.y = currentSpeed;
        } else if (input.down) {
            this.velocity.y = -currentSpeed;
        } else {
            this.velocity.y = 0;
        }
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Keep camera above ground (minimum height)
        this.position.y = Math.max(0.5, this.position.y);
    }

    // Method to get camera info for debugging
    public getInfo(): string {
        return `Camera Position: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}) | Pointer Locked: ${this.isPointerLocked}`;
    }

    // Public method to set movement speed
    public setSpeed(speed: number): void {
        this.speed = speed;
    }

    // Public method to set sprint multiplier
    public setSprintMultiplier(multiplier: number): void {
        this.sprintMultiplier = multiplier;
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