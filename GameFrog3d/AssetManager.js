// --- START OF FILE AssetManager.js ---

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
    constructor(onLoadCallback) {
        this.assets = [];
        this.gltfLoader = new GLTFLoader();
        this.cache = new Map(); // Load kiye gaye models ko save karne ke liye
        this.onLoadCallback = onLoadCallback; // UI update karne ke liye callback
    }

    // assets.json file load karega
    async loadAssetList(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch asset list: ${response.statusText}`);
            }
            this.assets = await response.json();
            console.log("Asset list loaded:", this.assets);
            
            // UI ko batao ke assets load ho gaye hain
            if (this.onLoadCallback) {
                this.onLoadCallback(this.assets);
            }
        } catch (error) {
            console.error("Could not load asset list:", error);
            this.assets = [];
            // UI ko batao ke error aaya hai
             if (this.onLoadCallback) {
                this.onLoadCallback(this.assets, error);
            }
        }
    }

    // Asset Browser se saare assets hasil karne ke liye
    getAssets() {
        return this.assets;
    }

    // Ek model ko load karega (ya cache se dega)
    async getModel(assetId) {
        // Step 1: Check karo ke model cache mein hai ya nahi
        if (this.cache.has(assetId)) {
            console.log(`Getting '${assetId}' from cache.`);
            const cachedModel = this.cache.get(assetId);
            return cachedModel.clone(); // Hamesha clone bhejo taake original mehfooz rahe
        }

        // Step 2: Agar cache mein nahi hai, to usay load karo
        const assetInfo = this.assets.find(a => a.id === assetId);
        if (!assetInfo) {
            throw new Error(`Asset with id '${assetId}' not found in the asset list.`);
        }

        console.log(`Loading '${assetId}' from path: ${assetInfo.path}`);
        
        try {
            const gltf = await this.gltfLoader.loadAsync(assetInfo.path);
            
            // Model ke har hissay par shadows enable karo
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Step 3: Load kiye gaye model ko cache mein save karo
            this.cache.set(assetId, gltf.scene);
            console.log(`'${assetId}' loaded and cached.`);

            return gltf.scene.clone(); // Hamesha clone bhejo
        } catch (error) {
            console.error(`Failed to load model: ${assetId}`, error);
            throw error;
        }
    }
}
// --- END OF FILE AssetManager.js ---