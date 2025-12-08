import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const CLOUD_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldPosition;
void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const CLOUD_FRAGMENT_SHADER = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPosition;

// Simplex 3D Noise 
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
    float time = uTime * 0.15;
    vec3 pos = vWorldPosition * 0.006; 
    
    // FBM-ish Noise composition
    float n = snoise(pos + vec3(time, 0.0, 0.0));
    n += 0.5 * snoise(pos * 2.0 + vec3(0.0, time * 0.5, 0.0));
    n += 0.25 * snoise(pos * 4.0 + vec3(time * 0.2, 0.0, 0.0));
    
    // Cloud mask - clamp to create transparent areas
    float alpha = smoothstep(0.1, 0.6, n);
    
    // Soft lighting gradient
    vec3 cloudColor = vec3(1.0, 0.95, 0.9);
    
    // Add some "density" darkening
    float density = smoothstep(0.4, 0.8, n);
    cloudColor = mix(cloudColor, vec3(0.8, 0.8, 0.85), density);
    
    gl_FragColor = vec4(cloudColor, alpha * 0.9);
}
`;

export class App {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.sky = null;
        this.composer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.islands = []; // For raycasting
        this.cloudMaterial = null;
        this.clock = new THREE.Clock();
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.initPostProcessing();
        this.createControls();
        this.createProceduralWorld();
        this.handleResize();
        this.setupInteractions();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
        // Fog blends with the sky
        this.scene.fog = new THREE.FogExp2(0x7496a6, 0.002);
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
        this.renderer.toneMappingExposure = 0.6;
        this.renderer.shadowMap.enabled = true; // Enable shadows for AAA feel
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
    }

    initPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight), 
            1.5, 0.4, 0.85
        );
        bloomPass.threshold = 0.2;
        bloomPass.strength = 0.8; // High glow for dreamy effect
        bloomPass.radius = 0.5;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
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
        
        const dirLight = new THREE.DirectionalLight(0xfff0dd, 2.5);
        dirLight.position.set(50, 80, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        this.scene.add(dirLight);

        // 3. Pro Shader Clouds
        this.createProClouds();

        // 4. Floating Islands (after sky, for env map)
        this.generateIslands();
    }

    initSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 8;
        uniforms['rayleigh'].value = 2;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;

        const sun = new THREE.Vector3();
        // Lower for sunset
        const phi = THREE.MathUtils.degToRad(86); 
        const theta = THREE.MathUtils.degToRad(170);

        sun.setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(sun);

        // Generate Environment Map from Sky for Reflections ("Ray Tracing" look)
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(this.sky).texture;
    }

    createProClouds() {
        const geometry = new THREE.SphereGeometry(300, 64, 64);
        
        this.cloudMaterial = new THREE.ShaderMaterial({
            vertexShader: CLOUD_VERTEX_SHADER,
            fragmentShader: CLOUD_FRAGMENT_SHADER,
            uniforms: {
                uTime: { value: 0 }
            },
            transparent: true,
            side: THREE.BackSide, // Inside the sphere
            depthWrite: false
        });

        const cloudSphere = new THREE.Mesh(geometry, this.cloudMaterial);
        this.scene.add(cloudSphere);
    }

    generateIslands() {
        const islandGeo = new THREE.DodecahedronGeometry(1, 0); // Low poly look
        
        // PBR Materials for "Ray Tracing" reflections
        const islandMat = new THREE.MeshStandardMaterial({ 
            color: 0x5a6e5a, 
            flatShading: true,
            roughness: 0.6,
            metalness: 0.1,
            envMapIntensity: 1.0
        });
        
        const stoneMat = new THREE.MeshStandardMaterial({ 
            color: 0x8c8c8c, 
            flatShading: true,
            roughness: 0.4, // More reflective
            metalness: 0.2,
            envMapIntensity: 1.0
        });

        for (let i = 0; i < 60; i++) {
            const isStone = Math.random() > 0.6;
            const mesh = new THREE.Mesh(islandGeo, isStone ? stoneMat.clone() : islandMat.clone());
            
            const radius = 30 + Math.random() * 80;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            mesh.position.setFromSphericalCoords(radius, phi, theta);
            
            // Varied shapes
            const s = 1 + Math.random() * 8;
            mesh.scale.set(s, s * (0.4 + Math.random() * 0.6), s);
            
            // Store for raycasting animation
            mesh.userData.originalScale = mesh.scale.clone();
            
            mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.scene.add(mesh);
            this.islands.push(mesh);
        }
    }

    setupInteractions() {
        window.addEventListener('mousemove', (event) => {
            // Normalize mouse position
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
    }

    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        const elapsedTime = this.clock.getElapsedTime();

        // Update Cloud Shader
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.uTime.value = elapsedTime;
        }

        // Raycasting ("Ray Casting")
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.islands);

        // Reset state
        for (const mesh of this.islands) {
            mesh.scale.lerp(mesh.userData.originalScale, 0.1);
            // Gentle rotation for all islands
            mesh.rotation.x += 0.001;
            mesh.rotation.y += 0.002;
            
            // Reset highlight
            if (mesh.material.emissive) {
                mesh.material.emissive.setHex(0x000000);
            }
        }

        // Highlight intersected
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            // Scale up effect
            const targetScale = hit.userData.originalScale.clone().multiplyScalar(1.2);
            hit.scale.lerp(targetScale, 0.2);
            
            // Glow effect
            hit.material.emissive.setHex(0x555555);
            // Stop auto rotation when interacting
            this.controls.autoRotate = false;
        } else if (!this.controls.isDragging) { // isDragging is internal to OrbitControls usually, check logic
             // Resume rotation if not interacting (simple logic: start resets it to false in createControls)
             // We'll leave autoRotate logic to controls setup
        }

        this.controls.update();
        
        // Render via Composer for Bloom
        this.composer.render();
    }
}