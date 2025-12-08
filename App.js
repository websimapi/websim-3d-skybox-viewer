import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

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
        this.createProceduralWorld();
        this.handleResize();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x7496a6, 0.003);
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
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
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

    createProceduralWorld() {
        // 1. Realistic Sky
        this.initSky();

        // 2. Lighting
        const ambientLight = new THREE.AmbientLight(0x606060);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // 3. Floating Islands
        this.generateIslands();
        
        // 4. Stylized Clouds
        this.generateClouds();
    }

    initSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 10;
        uniforms['rayleigh'].value = 3;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.7;

        const sun = new THREE.Vector3();
        // Low elevation for sunset vibes (2 degrees)
        const phi = THREE.MathUtils.degToRad(90 - 2); 
        const theta = THREE.MathUtils.degToRad(180);

        sun.setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(sun);
    }

    generateIslands() {
        const islandGeo = new THREE.DodecahedronGeometry(1, 0);
        const islandMat = new THREE.MeshStandardMaterial({ 
            color: 0x5a6e5a, 
            flatShading: true,
            roughness: 0.8
        });
        
        const stoneMat = new THREE.MeshStandardMaterial({ 
            color: 0x8c8c8c, 
            flatShading: true,
            roughness: 0.9
        });

        for (let i = 0; i < 60; i++) {
            const isStone = Math.random() > 0.6;
            const mesh = new THREE.Mesh(islandGeo, isStone ? stoneMat : islandMat);
            
            const radius = 25 + Math.random() * 75;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            mesh.position.setFromSphericalCoords(radius, phi, theta);
            
            // Varied shapes
            const s = 1 + Math.random() * 6;
            mesh.scale.set(s, s * (0.4 + Math.random() * 0.6), s);
            
            mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            this.scene.add(mesh);
        }
    }

    generateClouds() {
        const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
        const cloudMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.3 
        });

        for (let i = 0; i < 40; i++) {
            const mesh = new THREE.Mesh(cloudGeo, cloudMat);
            
            const radius = 50 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI; 
            
            mesh.position.setFromSphericalCoords(radius, phi, theta);
            
            // Long thin strips
            mesh.scale.set(15 + Math.random() * 25, 1 + Math.random(), 5 + Math.random() * 10);
            
            mesh.lookAt(0, 0, 0); 
            this.scene.add(mesh);
        }
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