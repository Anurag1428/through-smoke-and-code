export interface InputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    shift: boolean;
    ctrl: boolean;
}

export class InputManager {
    private keys: { [key: string]: boolean } = {};
    private inputState: InputState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        shift: false,
        ctrl: false
    };

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        
        // Prevent context menu on right click
        document.addEventListener('contextmenu', (e) => e.preventDefault(), false);
        
        // Handle focus loss to prevent stuck keys
        window.addEventListener('blur', this.onWindowBlur.bind(this), false);
    }

    private onKeyDown(event: KeyboardEvent): void {
        this.keys[event.code] = true;
        this.updateInputState();
        
        // Prevent default behavior for movement keys
        if (this.isMovementKey(event.code)) {
            event.preventDefault();
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        this.keys[event.code] = false;
        this.updateInputState();
    }

    private onWindowBlur(): void {
        // Clear all keys when window loses focus to prevent stuck keys
        this.keys = {};
        this.updateInputState();
    }

    private isMovementKey(code: string): boolean {
        return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft'].includes(code);
    }

    private updateInputState(): void {
        this.inputState.forward = this.keys['KeyW'] || false;
        this.inputState.backward = this.keys['KeyS'] || false;
        this.inputState.left = this.keys['KeyA'] || false;
        this.inputState.right = this.keys['KeyD'] || false;
        this.inputState.up = this.keys['Space'] || false;
        this.inputState.down = this.keys['ShiftLeft'] || false;
        this.inputState.shift = this.keys['ShiftLeft'] || false;
        this.inputState.ctrl = this.keys['ControlLeft'] || false;
    }

    public getInputState(): InputState {
        return { ...this.inputState };
    }

    public isKeyPressed(code: string): boolean {
        return this.keys[code] || false;
    }

    // Get movement direction as a normalized vector
    public getMovementVector(): { x: number, y: number, z: number } {
        let x = 0;
        let y = 0;
        let z = 0;

        if (this.inputState.left) x -= 1;
        if (this.inputState.right) x += 1;
        if (this.inputState.forward) z -= 1;
        if (this.inputState.backward) z += 1;
        if (this.inputState.up) y += 1;
        if (this.inputState.down) y -= 1;

        // Normalize diagonal movement
        const length = Math.sqrt(x * x + z * z);
        if (length > 0) {
            x /= length;
            z /= length;
        }

        return { x, y, z };
    }

    public dispose(): void {
        document.removeEventListener('keydown', this.onKeyDown.bind(this));
        document.removeEventListener('keyup', this.onKeyUp.bind(this));
        document.removeEventListener('contextmenu', (e) => e.preventDefault());
        window.removeEventListener('blur', this.onWindowBlur.bind(this));
    }
}