// --- START OF FILE Terrain.js ---

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise'; 

const terrainShader = {
    vertexShader: `
        varying vec3 vPositionWorld; 
        varying vec3 vNormalWorld;   
        varying vec2 vUv;
        void main() {
            vUv = uv;
            vNormalWorld = normalize( mat3(modelMatrix) * normal );
            vPositionWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vPositionWorld; 
        varying vec3 vNormalWorld;   
        varying vec2 vUv;
        uniform sampler2D uSandTexture;
        uniform sampler2D uGrassTexture;
        uniform sampler2D uRockTexture;
        uniform sampler2D uSnowTexture;
        uniform sampler2D uSplatMap; 
        uniform float uTextureScale;
        uniform float uBrightness; // === NAYA: BRIGHTNESS KE LIYE UNIFORM ===

        vec4 triplanar(sampler2D tex, vec3 pos, vec3 nor) {
            vec3 b = pow(abs(nor), vec3(2.0));
            b /= (b.x + b.y + b.z);
            vec4 c = texture(tex, pos.zy * uTextureScale) * b.x +
                     texture(tex, pos.xz * uTextureScale) * b.y +
                     texture(tex, pos.xy * uTextureScale) * b.z;
            return c;
        }

        void main() {
            vec4 sandColor = triplanar(uSandTexture, vPositionWorld, vNormalWorld);
            vec4 grassColor = triplanar(uGrassTexture, vPositionWorld, vNormalWorld);
            vec4 rockColor = triplanar(uRockTexture, vPositionWorld, vNormalWorld);
            vec4 snowColor = triplanar(uSnowTexture, vPositionWorld, vNormalWorld);
            vec4 splatColor = texture(uSplatMap, vUv);
            vec4 finalColor = grassColor;
            finalColor = mix(finalColor, rockColor, splatColor.r); 
            finalColor = mix(finalColor, sandColor, splatColor.b); 
            finalColor = mix(finalColor, grassColor, splatColor.g); 
            float height = vPositionWorld.y;
            float snowBlend = smoothstep(28.0, 32.0, height);
            finalColor = mix(finalColor, snowColor, snowBlend);
            float light = dot(vNormalWorld, normalize(vec3(0.5, 0.5, 0.5))) * 0.5 + 0.5;
            gl_FragColor = finalColor * light * uBrightness; // === BRIGHTNESS KO APPLY KARO ===
            gl_FragColor.a = 1.0;
        }
    `
};

export class Terrain {
    constructor(app) {
        this.app = app; // For texture loader
        this.size = 200;
        this.segments = 256;
        this.splatMapSize = 512;
        this.mesh = null;
        this.textures = {};
        this.noise = createNoise2D();
    }
    
    async init() {
        this.createMesh();
        
        const [sandTexture, grassTexture, rockTexture, snowTexture] = await Promise.all([
            this.app.textureLoader.loadAsync('assets/textures/sand.jpg'),
            this.app.textureLoader.loadAsync('assets/textures/grass.jpg'),
            this.app.textureLoader.loadAsync('assets/textures/rock.jpg'),
            this.app.textureLoader.loadAsync('assets/textures/snow.jpg')
        ]);
        this.textures = { uSandTexture: sandTexture, uGrassTexture: grassTexture, uRockTexture: rockTexture, uSnowTexture: snowTexture };
        this.setTextures(this.textures);
    }
    
    // === NAYA FUNCTION: TERRAIN KO RECREATE KARNE KE LIYE ===
    recreate(size, segments) {
        this.size = size;
        this.segments = segments;
        
        // Purana mesh scene se hatao
        if (this.mesh) {
            this.app.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        // Naya mesh banao
        this.createMesh();
        this.setTextures(this.textures);
        this.app.scene.add(this.mesh);
        console.log(`Terrain recreated with Size: ${size}, Segments: ${segments}`);
    }

    createMesh() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
        geometry.rotateX(-Math.PI / 2);
        
        this.splatMapCanvas = document.createElement('canvas');
        this.splatMapCanvas.width = this.splatMapSize;
        this.splatMapCanvas.height = this.splatMapSize;
        this.splatMapContext = this.splatMapCanvas.getContext('2d', { willReadFrequently: true });
        this.splatMapTexture = new THREE.CanvasTexture(this.splatMapCanvas);
        this.resetSplatMap();
        
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uSandTexture: { value: null }, uGrassTexture: { value: null },
                uRockTexture: { value: null }, uSnowTexture: { value: null },
                uSplatMap: { value: this.splatMapTexture },
                uTextureScale: { value: 0.05 },
                uBrightness: { value: 1.0 } // Default brightness 1.0
            },
            vertexShader: terrainShader.vertexShader,
            fragmentShader: terrainShader.fragmentShader,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.name = 'terrain';
        this.mesh.receiveShadow = true; 
        this.mesh.castShadow = true;
        this.geometry = geometry;
    }
    
    setBrightness(value) {
        if(this.material) {
            this.material.uniforms.uBrightness.value = value;
        }
    }

    resetSplatMap() {
        this.splatMapContext.fillStyle = 'rgb(0, 255, 0)';
        this.splatMapContext.fillRect(0, 0, this.splatMapCanvas.width, this.splatMapCanvas.height);
        if(this.splatMapTexture) this.splatMapTexture.needsUpdate = true;
    }

    setTextures(textures) {
        for (const key in textures) {
            if (this.material.uniforms[key]) {
               textures[key].wrapS = THREE.RepeatWrapping;
               textures[key].wrapT = THREE.RepeatWrapping;
               textures[key].colorSpace = THREE.SRGBColorSpace;
               this.material.uniforms[key].value = textures[key];
            }
        }
        this.material.needsUpdate = true;
    }
    
    generate(options) {
        const { mountainScale, mountainHeight, mountainOctaves, landmassScale, waterLevel, persistence, lacunarity } = options;
        const positions = this.geometry.attributes.position;
        const noise = createNoise2D();

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            const landmassValue = (noise(x / landmassScale, z / landmassScale) + 1) / 2;

            if (landmassValue < waterLevel) {
                 positions.setY(i, -2);
                 continue;
            }

            let amplitude = 1;
            let frequency = 1;
            let noiseHeight = 0;

            for (let j = 0; j < mountainOctaves; j++) {
                const sampleX = x / mountainScale * frequency;
                const sampleZ = z / mountainScale * frequency;
                const perlinValue = noise(sampleX, sampleZ);
                noiseHeight += perlinValue * amplitude;
                
                amplitude *= persistence;
                frequency *= lacunarity;
            }
            
            const height = noiseHeight * mountainHeight;
            positions.setY(i, height);
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }

    sculpt(intersectionPoint, brush) {
        const positions = this.geometry.attributes.position;
        const center = intersectionPoint;

        for (let i = 0; i < positions.count; i++) {
            const P = new THREE.Vector3().fromBufferAttribute(positions, i);
            const distance = P.distanceTo(center);

            if (distance < brush.size) {
                const falloff = this.smoothstep(0, 1, (brush.size - distance) / brush.size);
                let newY = P.y;

                switch (brush.type) {
                    case 'raise': newY += falloff * brush.strength; break;
                    case 'lower': newY -= falloff * brush.strength; break;
                    case 'flatten': newY = THREE.MathUtils.lerp(P.y, center.y, falloff * brush.strength * 0.1); break;
                    case 'smooth': newY = THREE.MathUtils.lerp(P.y, center.y, falloff * brush.strength * 0.05); break;
                }
                positions.setY(i, newY);
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }
    
    smoothstep(min, max, value) {
        const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return x * x * (3 - 2 * x);
    }

    paint(intersection, brush) {
        if (!intersection.uv) return;

        const uv = intersection.uv;
        const canvas = this.splatMapCanvas;
        const ctx = this.splatMapContext;
        const brushSize = brush.size;
        const brushStrength = brush.strength; // 0-1 scale par

        const centerX = uv.x * canvas.width;
        const centerY = (1 - uv.y) * canvas.height;

        const startX = Math.floor(Math.max(0, centerX - brushSize));
        const startY = Math.floor(Math.max(0, centerY - brushSize));
        const endX = Math.ceil(Math.min(canvas.width, centerX + brushSize));
        const endY = Math.ceil(Math.min(canvas.height, centerY + brushSize));
        
        const imageData = ctx.getImageData(startX, startY, endX - startX, endY - startY);
        const data = imageData.data;
        const brushColor = brush.color; // yeh ek object hai {r, g, b}

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const distance = Math.sqrt((x - centerX)**2 + (y - centerY)**2);
                if (distance < brushSize) {
                    const falloff = this.smoothstep(0, 1, (brushSize - distance) / brushSize);
                    const strength = falloff * brushStrength;
                    
                    const pixelX = x - startX;
                    const pixelY = y - startY;
                    const index = (pixelY * imageData.width + pixelX) * 4;
                    
                    let r = data[index];
                    let g = data[index + 1];
                    let b = data[index + 2];
                    
                    // Naye color ki taraf LERP (Linear Interpolate) karo
                    data[index]     = r + (brushColor.r - r) * strength;
                    data[index + 1] = g + (brushColor.g - g) * strength;
                    data[index + 2] = b + (brushColor.b - b) * strength;
                }
            }
        }
        
        ctx.putImageData(imageData, startX, startY);
        this.splatMapTexture.needsUpdate = true;
    }
    
    reset() {
        console.log("Resetting terrain to flat plane...");
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            positions.setY(i, 0);
        }
        positions.needsUpdate = true;
        this.geometry.computeVertexNormals();
        
        this.resetSplatMap();
    }
}
// --- END OF FILE Terrain.js ---