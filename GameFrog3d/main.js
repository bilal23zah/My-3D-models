// --- START OF FILE main.js ---

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { UIManager } from './UIManager.js';
import { SceneManager } from './SceneManager.js';
import { GizmoManager } from './GizmoManager.js';
import { WorldEditor } from './WorldEditor.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Terrain } from './Terrain.js';
import { createNoise2D } from 'simplex-noise';
import { HistoryManager, AddObjectCommand, DeleteObjectCommand, TransformCommand } from './HistoryManager.js';
import { AssetManager } from './AssetManager.js';

(function() {
    class GameForge3D {
        constructor() {
            this.canvas = document.querySelector('#c');
            this.objects = [];
            this.selectedObject = null;
            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();
            this.isDraggingObject = false;
            this.dragStartState = null;
            this.isEditingTerrain = false;
            this.activeTool = 'none'; 
            this.terrainBrush = { type: 'raise', size: 10, strength: 0.5 };
            this.paintBrush = { type: 'grass', color: {r: 0, g: 255, b: 0}, size: 15, strength: 0.1 };
            this.vegetationNoise = createNoise2D();
            this.clock = new THREE.Clock();
            this.grassMaterial = null;
            
            this.initEngine();
            this.setupEventListeners();
            this.animate();
        }

        async initEngine() {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 2000);
            this.camera.position.set(50, 50, 50);
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.shadowMap.enabled = true;
            this.textureLoader = new THREE.TextureLoader();
            this.rgbeLoader = new RGBELoader();
            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
            this.dirLight.castShadow = true;
            this.dirLight.shadow.mapSize.width = 2048;
            this.dirLight.shadow.mapSize.height = 2048;
            this.scene.add(this.dirLight);
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            await this.initManagers();
            await this.setupProceduralWorld();
            this.onWindowResize();
        }

        async initManagers() {
            this.uiManager = new UIManager(this, 
                (shapeType) => this.addPrimitive(shapeType), 
                () => this.deleteSelectedObject(),
                (assetId) => this.addAssetToScene(assetId)
            );
            this.sceneManager = new SceneManager(this);
            this.history = new HistoryManager(this.uiManager);
            this.gizmoManager = new GizmoManager(this.camera, this.canvas, 
                () => this.uiManager.updateInspector(this.selectedObject), 
                (obj) => this.duplicateObject(obj),
                (obj, start, end) => this.history.add(new TransformCommand(obj, start, end))
            );
            this.worldEditor = new WorldEditor(this);

            this.assetManager = new AssetManager((assets, error) => {
                this.uiManager.populateAssetBrowser(assets, error);
            });
            
            await this.assetManager.loadAssetList('./assets.json');
        }

        async setupProceduralWorld() {
            this.sky = new Sky();
            this.sky.scale.setScalar(450000);
            this.scene.add(this.sky);
            this.sun = new THREE.Vector3();
            this.effectController = { turbidity: 10, rayleigh: 3, mieCoefficient: 0.005, mieDirectionalG: 0.7, elevation: 6, azimuth: 180, fog: 0 };
            const sunSphere = new THREE.SphereGeometry(20000, 32, 32);
            const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this.sunMesh = new THREE.Mesh(sunSphere, sunMaterial);
            this.sunMesh.name = "sun_disc";
            this.scene.add(this.sunMesh);
            this.scene.fog = new THREE.Fog(0xcccccc, 1, 1000);
            this.updateSky();
            this.terrain = new Terrain(this);
            await this.terrain.init();
            this.scene.add(this.terrain.mesh);
        }
        
        // === FIX: In functions ko wapis unki asal haalat mein laya gaya hai ===
        createVegetation() {
            const existingVeg = this.scene.getObjectByName("vegetation");
            if (existingVeg) this.scene.remove(existingVeg);
            const instanceCount = 20000;
            const treeGeometry = new THREE.ConeGeometry(0.5, 2, 5);
            treeGeometry.translate(0, 1, 0);
            const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x225522 });
            const instancedTreeMesh = new THREE.InstancedMesh(treeGeometry, treeMaterial, instanceCount);
            instancedTreeMesh.name = "vegetation";
            instancedTreeMesh.castShadow = true;
            const dummy = new THREE.Object3D();
            const terrainVertices = this.terrain.geometry.attributes.position;
            const terrainNormals = this.terrain.geometry.attributes.normal;
            let count = 0;
            for (let i = 0; i < terrainVertices.count; i++) {
                if (count >= instanceCount) break;
                const y = terrainVertices.getY(i);
                const normalY = terrainNormals.getY(i);
                if (y < 1.0 || y > 25.0 || normalY < 0.8) continue;
                const x = terrainVertices.getX(i);
                const z = terrainVertices.getZ(i);
                if ((this.vegetationNoise(x / 50, z / 50) + 1) / 2 < 0.6) continue;
                dummy.position.set(x, y, z);
                dummy.scale.set(1 + Math.random() * 0.5, 1 + Math.random() * 1.0, 1 + Math.random() * 0.5);
                dummy.rotation.y = Math.random() * Math.PI * 2;
                dummy.updateMatrix();
                instancedTreeMesh.setMatrixAt(count, dummy.matrix);
                count++;
            }
            instancedTreeMesh.count = count;
            this.scene.add(instancedTreeMesh);
        }

        async createGrass() {
            const existingGrass = this.scene.getObjectByName("grass");
            if (existingGrass) this.scene.remove(existingGrass);
            const instanceCount = 75000;
            const grassBladeTexture = await this.textureLoader.loadAsync('assets/textures/grass_blade.png');
            const grassGeometry = new THREE.PlaneGeometry(0.5, 1);
            grassGeometry.translate(0, 0.5, 0);
            const fullGrassShader = {
                vertexShader: `
                    uniform float uTime; varying vec2 vUv;
                    void main() { vUv = uv; vec3 newPosition = position;
                    float sway = sin(position.x * 2.0 + uTime * 2.0) * 0.1 * position.y; newPosition.x += sway;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(newPosition, 1.0); }`,
                fragmentShader: `
                    uniform sampler2D uTexture; varying vec2 vUv;
                    void main() { vec4 textureColor = texture2D(uTexture, vUv);
                    if (textureColor.a < 0.1) discard; gl_FragColor = textureColor; }`
            };
            this.grassMaterial = new THREE.ShaderMaterial({
                uniforms: { uTime: { value: 0 }, uTexture: { value: grassBladeTexture } },
                vertexShader: fullGrassShader.vertexShader, fragmentShader: fullGrassShader.fragmentShader,
                transparent: true, side: THREE.DoubleSide, depthWrite: false
            });
            const instancedGrassMesh = new THREE.InstancedMesh(grassGeometry, this.grassMaterial, instanceCount);
            instancedGrassMesh.name = "grass";
            const dummy = new THREE.Object3D();
            const terrainVertices = this.terrain.geometry.attributes.position;
            const terrainNormals = this.terrain.geometry.attributes.normal;
            let count = 0;
            for (let i = 0; i < terrainVertices.count; i++) {
                if (count >= instanceCount) break;
                const y = terrainVertices.getY(i);
                const normalY = terrainNormals.getY(i);
                if (y < 1.0 || y > 25.0 || normalY < 0.9 || Math.random() > 0.1) continue;
                const x = terrainVertices.getX(i);
                const z = terrainVertices.getZ(i);
                dummy.position.set(x, y, z);
                dummy.scale.setScalar(0.5 + Math.random() * 0.5);
                dummy.rotation.y = Math.random() * Math.PI * 2;
                dummy.updateMatrix();
                instancedGrassMesh.setMatrixAt(count, dummy.matrix);
                count++;
            }
            instancedGrassMesh.count = count;
            this.scene.add(instancedGrassMesh);
        }
        
        updateSky(){
            const uniforms = this.sky.material.uniforms;
            uniforms['turbidity'].value = this.effectController.turbidity;
            uniforms['rayleigh'].value = this.effectController.rayleigh;
            uniforms['mieCoefficient'].value = this.effectController.mieCoefficient;
            uniforms['mieDirectionalG'].value = this.effectController.mieDirectionalG;
            const phi = THREE.MathUtils.degToRad(90 - this.effectController.elevation);
            const theta = THREE.MathUtils.degToRad(this.effectController.azimuth);
            this.sun.setFromSphericalCoords(1, phi, theta);
            uniforms['sunPosition'].value.copy(this.sun);
            this.dirLight.position.copy(this.sun);
            this.sunMesh.position.copy(this.sun).multiplyScalar(400000);
            this.scene.fog.near = this.effectController.fog > 0 ? 1 : 1000;
            this.scene.fog.far = this.effectController.fog > 0 ? (1 / this.effectController.fog) * 100 : 1000;
            this.scene.fog.color.setHSL(0.6, 0.5, 1 - (this.effectController.elevation / 90));
        }
        setSkybox(url){
            this.sky.visible = false; this.sunMesh.visible = false; this.scene.fog.visible = false; this.dirLight.visible = false;
            this.rgbeLoader.load(url, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.background = texture; this.scene.environment = texture;
            });
        }
        setProceduralSky(){
            this.sky.visible = true; this.sunMesh.visible = true; this.scene.fog.visible = true; this.dirLight.visible = true;
            this.scene.background = null; this.scene.environment = null;
            this.updateSky();
        }

        setupEventListeners() {
            window.addEventListener('resize', () => this.onWindowResize());
            this.controls.addEventListener('change', () => { if (this.gizmoManager) this.gizmoManager.updatePosition(); });
            this.uiManager.hierarchyList.addEventListener('click', (e) => { if (e.target && e.target.matches('li')) { const object = this.objects.find(o => o.uuid === e.target.dataset.uuid); this.selectObject(object); } });
            this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
            this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
            this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
            this.canvas.addEventListener('pointerleave', (e) => this.onPointerUp(e));

            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); this.undo(); }
                if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this.redo(); }
            });
        }
        
        undo() {
            const command = this.history.undo();
            if(command && command.object) { this.selectObject(command.object); }
            this.uiManager.updateAll(this.objects, this.selectedObject);
        }

        redo() {
            const command = this.history.redo();
            if(command && command.object) { this.selectObject(command.object); }
            this.uiManager.updateAll(this.objects, this.selectedObject);
        }

        onPointerDown(event) {
            if (event.target.closest('#top-nav, #left-panel, #right-panel, #gizmo-container, .editor-panel, .popup-overlay')) { return; }
            this.updatePointer(event);
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.terrain.mesh);
            if (intersects.length > 0) {
                if (this.activeTool === 'sculpt' || this.activeTool === 'paint') {
                    this.isEditingTerrain = true; this.controls.enabled = false;
                    this.editOrPaintTerrain(intersects[0]);
                    return;
                }
            }
            const objIntersects = this.raycaster.intersectObjects(this.objects, true);
            if (objIntersects.length > 0) {
                let topLevelObject = objIntersects[0].object;
                while (topLevelObject.parent && topLevelObject.parent !== this.scene) { topLevelObject = topLevelObject.parent; }
                if (this.selectedObject === topLevelObject) {
                    this.isDraggingObject = true;
                    this.controls.enabled = false;
                    this.canvas.classList.add('grabbing');
                    this.dragStartState = {
                        position: this.selectedObject.position.clone(),
                        rotation: this.selectedObject.rotation.clone(),
                        scale: this.selectedObject.scale.clone(),
                    };
                } else { this.selectObject(topLevelObject); }
            } else { this.selectObject(null); }
        }

        onPointerMove(event) {
            if (this.isEditingTerrain) {
                this.updatePointer(event); this.raycaster.setFromCamera(this.pointer, this.camera);
                const intersects = this.raycaster.intersectObject(this.terrain.mesh);
                if (intersects.length > 0) { this.editOrPaintTerrain(intersects[0]); }
                return;
            }
            if (this.isDraggingObject && this.selectedObject) {
                this.updatePointer(event);
                this.raycaster.setFromCamera(this.pointer, this.camera);
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), this.dragStartState.position.y);
                const intersectionPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                   this.selectedObject.position.set(intersectionPoint.x, this.selectedObject.position.y, intersectionPoint.z);
                   this.uiManager.updateInspector(this.selectedObject);
                }
            }
        }
        
        editOrPaintTerrain(intersection) {
            if (this.activeTool === 'sculpt') { this.terrain.sculpt(intersection.point, this.terrainBrush); }
            else if (this.activeTool === 'paint') { this.terrain.paint(intersection, this.paintBrush); }
        }
        
        onPointerUp(event) {
            if (this.isDraggingObject && this.selectedObject) {
                const newTransform = {
                    position: this.selectedObject.position.clone(),
                    rotation: this.selectedObject.rotation.clone(),
                    scale: this.selectedObject.scale.clone(),
                };
                if (!newTransform.position.equals(this.dragStartState.position)) {
                   this.history.add(new TransformCommand(this.selectedObject, this.dragStartState, newTransform));
                }
                this.isDraggingObject = false;
                this.canvas.classList.remove('grabbing');
            }
            if (this.isEditingTerrain) { this.isEditingTerrain = false; }
            this.controls.enabled = true;
        }

        updatePointer(event) {
            const rect = this.canvas.getBoundingClientRect();
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }

        addPrimitive(shapeType) {
            let geometry; const size = 2;
            switch(shapeType) {
                case 'sphere': geometry = new THREE.SphereGeometry(size / 2, 32, 16); break;
                case 'cylinder': geometry = new THREE.CylinderGeometry(size / 2, size / 2, size, 32); break;
                case 'plane': geometry = new THREE.PlaneGeometry(size, size); break;
                case 'cone': geometry = new THREE.ConeGeometry(size / 2, size, 32); break;
                default: geometry = new THREE.BoxGeometry(size, size, size); break;
            }
            const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, name: shapeType });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = shapeType.charAt(0).toUpperCase() + shapeType.slice(1);
            mesh.userData.type = 'primitive'; mesh.position.y = size / 2; mesh.castShadow = true;
            
            const command = new AddObjectCommand(this, mesh);
            command.execute();
            this.history.add(command);
            this.selectObject(mesh);
        }

        async addAssetToScene(assetId) {
            if (!assetId) {
                console.warn("No asset selected to add.");
                return;
            }
            this.uiManager.showLoading('Loading model...');
            try {
                const model = await this.assetManager.getModel(assetId);
                const assetInfo = this.assetManager.getAssets().find(a => a.id === assetId);
                model.name = assetInfo.name;
                model.userData.type = 'model';
                model.userData.assetId = assetId;

                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                const distance = 20;
                const spawnPos = new THREE.Vector3().copy(this.camera.position).add(cameraDirection.multiplyScalar(distance));
                
                this.raycaster.set(spawnPos, new THREE.Vector3(0, -1, 0));
                const intersects = this.raycaster.intersectObject(this.terrain.mesh);
                if (intersects.length > 0) {
                    model.position.copy(intersects[0].point);
                } else {
                    model.position.y = 0;
                }
                
                const command = new AddObjectCommand(this, model);
                command.execute();
                this.history.add(command);

                this.selectObject(model);
                this.uiManager.hideAssetBrowser();

            } catch (error) {
                console.error(`Failed to add asset ${assetId} to scene.`, error);
                alert(`Error loading model: ${assetId}. Check console for details.`);
            } finally {
                this.uiManager.hideLoading();
            }
        }

        deleteSelectedObject() {
            if (!this.selectedObject) return;
            const command = new DeleteObjectCommand(this, this.selectedObject);
            command.execute();
            this.history.add(command);
            this.selectObject(null);
        }

        duplicateObject(objectToClone) {
            if (!objectToClone) return;
            if (objectToClone.userData.type === 'model') {
                this.addAssetToScene(objectToClone.userData.assetId);
                return;
            }
            const clone = objectToClone.clone();
            clone.position.x += 1.5;
            clone.name = `${objectToClone.name}_copy`;
            clone.userData = { ...objectToClone.userData };
            const command = new AddObjectCommand(this, clone);
            command.execute();
            this.history.add(command);
            this.selectObject(clone);
        }

        selectObject(object) {
            this.selectedObject = object;
            if (object) {
                this.gizmoManager.show(object);
            } else {
                this.gizmoManager.hide();
            }
            this.uiManager.updateAll(this.objects, this.selectedObject);
        }
        
        onWindowResize() {
            this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            this.controls.update();
            if (this.gizmoManager && !this.gizmoManager.isDragging) { this.gizmoManager.updatePosition(); }
            this.uiManager.updateFPS();
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    new GameForge3D();
})();
// --- END OF FILE main.js ---