import * as THREE from 'three';

export class CustomRenderer extends THREE.WebGLRenderer {
    private animationId: number | null = null;

    constructor(options?: THREE.WebGLRendererParameters) {
        super({
            antialias: true,
            ...options
        });
        
        this.setupRenderer();
        this.setupEventListeners();
    }

    private setupRenderer(): void {
        this.setSize(window.innerWidth, window.innerHeight);
        this.setPixelRatio(window.devicePixelRatio);
        
        // Enable shadows
        this.shadowMap.enabled = true;
        this.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Set background color (sky blue)
        this.setClearColor(0x87ceeb, 1);
        
        // Remove default margins and padding to ensure full canvas coverage
        this.setupBodyStyles();
        
        document.body.appendChild(this.domElement);
    }

    private setupBodyStyles(): void {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        this.domElement.style.display = 'block';
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    private onWindowResize(): void {
        this.setSize(window.innerWidth, window.innerHeight);
    }

    // Custom animation loop with performance monitoring
    public startAnimationLoop(callback: (time: number) => void): void {
        let lastTime = 0;
        let frameCount = 0;
        let fpsUpdateTime = 0;

        const animate = (time: number) => {
            // Calculate delta time
            const deltaTime = time - lastTime;
            lastTime = time;

            // Update FPS counter every second
            frameCount++;
            fpsUpdateTime += deltaTime;
            
            if (fpsUpdateTime >= 1000) {
                // Calculate FPS for potential future use
                Math.round(frameCount * 1000 / fpsUpdateTime);
                frameCount = 0;
                fpsUpdateTime = 0;
            }

            callback(time);
            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    // Method to stop animation loop
    public stopAnimationLoop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Enhanced render method with optional post-processing
    public renderScene(scene: THREE.Scene, camera: THREE.Camera): void {
        this.render(scene, camera);
    }

    // Method to take screenshot
    public takeScreenshot(): string {
        return this.domElement.toDataURL('image/png');
    }

    // Cleanup method
    public dispose(): void {
        this.stopAnimationLoop();
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        super.dispose();
    }
}