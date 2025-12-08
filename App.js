import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class App {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.skyMesh = null;
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createSkybox();
        this.handleResize();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
        // Fog adds depth, though less visible in a pure skybox, good practice
        this.scene.fog = new THREE.FogExp2(0x11111f, 0.002);
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        // Start position inside the sphere
        this.camera.position.set(0, 0, 0.1); 
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
    }

    createControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false; // Zoom doesn't make sense in a fixed skybox
        this.controls.enablePan = false;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;
        
        // Interaction stops auto-rotation
        this.controls.addEventListener('start', () => {
            this.controls.autoRotate = false;
        });
    }

    createSkybox() {
        const textureLoader = new THREE.TextureLoader();
        
        // Using a large sphere is often better than a cube for equirectangular images
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        
        // Invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);

        const texture = textureLoader.load('sky_panorama.png');
        texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({
            map: texture
        });

        this.skyMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.skyMesh);
    }

    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}