//--- START OF FILE UIManager.js ---

import * as THREE from 'three';
import { TransformCommand } from './HistoryManager.js';

export class UIManager {
    constructor(app, addShapeCallback, deleteObjectCallback, addAssetCallback) {
        this.app = app;
        this.addShapeCallback = addShapeCallback;
        this.deleteObjectCallback = deleteObjectCallback;
        this.addAssetCallback = addAssetCallback; // Naya callback

        // ... (baaki saare element references waise hi rahenge) ...
        this.hierarchyList = document.getElementById('scene-hierarchy-list');
        this.inspectorContent = document.getElementById('inspector-content');
        this.fpsCounter = document.getElementById('performance-info');
        this.objectInfo = document.getElementById('scene-info');
        this.leftPanel = document.getElementById('left-panel');
        this.rightPanel = document.getElementById('right-panel');
        this.addShapeBtn = document.getElementById('add-shape-btn');
        this.shapeDropdownList = document.getElementById('shape-dropdown-list');
        this.deleteObjectBtn = document.getElementById('delete-object-btn');
        this.toggleLeftPanelBtn = document.getElementById('toggle-left-panel');
        this.toggleRightPanelBtn = document.getElementById('toggle-right-panel');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
        this.undoBtn = document.getElementById('undo-btn');
        this.redoBtn = document.getElementById('redo-btn');
        this.addAssetBtn = document.getElementById('add-asset-btn');
        this.assetBrowserPopup = document.getElementById('asset-browser-popup');
        this.closeAssetPopupBtn = document.getElementById('close-asset-popup-btn');

        // Naye asset browser ke andar ke elements
        this.assetGrid = this.assetBrowserPopup.querySelector('.asset-grid');
        this.addSelectedAssetBtn = this.assetBrowserPopup.querySelector('#add-selected-asset-btn');
        this.selectedAssetId = null;

        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const click = 'click';
        this.deleteObjectBtn.addEventListener(click, () => { if (this.app.selectedObject) this.app.deleteSelectedObject(); });
        this.addShapeBtn.addEventListener(click, (e) => { e.stopPropagation(); this.shapeDropdownList.classList.toggle('show'); });
        this.toggleLeftPanelBtn.addEventListener(click, (e) => { e.stopPropagation(); this.leftPanel.classList.toggle('show'); this.rightPanel.classList.remove('show'); });
        this.toggleRightPanelBtn.addEventListener(click, (e) => { e.stopPropagation(); this.rightPanel.classList.toggle('show'); this.leftPanel.classList.remove('show'); });
        this.leftPanel.addEventListener(click, e => e.stopPropagation());
        this.rightPanel.addEventListener(click, e => e.stopPropagation());
        this.shapeDropdownList.addEventListener(click, (e) => { if (e.target.matches('li[data-shape]')) { if (this.addShapeCallback) this.addShapeCallback(e.target.dataset.shape); this.shapeDropdownList.classList.remove('show'); } });
        
        window.addEventListener(click, (e) => { 
            this.leftPanel.classList.remove('show'); 
            this.rightPanel.classList.remove('show'); 
            this.shapeDropdownList.classList.remove('show');
            const filterDropdown = this.assetBrowserPopup.querySelector('.filter-dropdown');
            if (filterDropdown && !filterDropdown.contains(e.target)) {
                 filterDropdown.querySelector('.filter-list').classList.remove('show');
            }
        });
        
        this.undoBtn.addEventListener(click, () => this.app.undo());
        this.redoBtn.addEventListener(click, () => this.app.redo());

        this.addAssetBtn.addEventListener(click, () => this.showAssetBrowser());
        this.closeAssetPopupBtn.addEventListener(click, () => this.hideAssetBrowser());
        this.assetBrowserPopup.addEventListener(click, (e) => {
            if (e.target === this.assetBrowserPopup) { this.hideAssetBrowser(); }
        });

        const filterBtn = this.assetBrowserPopup.querySelector('.filter-btn');
        if(filterBtn) {
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.assetBrowserPopup.querySelector('.filter-list').classList.toggle('show');
            });
        }
        
        // Asset card par click handle karna
        this.assetGrid.addEventListener(click, (e) => {
            const card = e.target.closest('.asset-card');
            if (card) {
                this.selectAsset(card.dataset.assetId);
            }
        });
        
        // "Add to Scene" button par click handle karna
        this.addSelectedAssetBtn.addEventListener(click, () => {
            if (this.addAssetCallback) {
                this.addAssetCallback(this.selectedAssetId);
            }
        });
    }

    // NAYA FUNCTION: Asset browser ko data se bharne ke liye
    populateAssetBrowser(assets, error = null) {
        this.assetGrid.innerHTML = ''; // Pehle se mojood sab kuch saaf karo
        
        if (error) {
            this.assetGrid.innerHTML = `<p class="asset-placeholder">Error loading assets: ${error.message}</p>`;
            return;
        }

        if (!assets || assets.length === 0) {
            this.assetGrid.innerHTML = `<p class="asset-placeholder">No assets found. Click 'Import' to add new models.</p>`;
            return;
        }

        assets.forEach(asset => {
            const card = document.createElement('div');
            card.className = 'asset-card';
            card.dataset.assetId = asset.id;
            card.innerHTML = `
                <div class="asset-thumbnail" style="background-image: url('${asset.thumbnail}');"></div>
                <div class="asset-name">${asset.name}</div>
            `;
            this.assetGrid.appendChild(card);
        });
    }

    // NAYA FUNCTION: Asset card select karne ke liye
    selectAsset(assetId) {
        this.selectedAssetId = assetId;
        // Saare cards se 'selected' class hatao
        this.assetGrid.querySelectorAll('.asset-card').forEach(card => {
            card.classList.remove('selected');
        });
        // Sirf click kiye gaye card par 'selected' class lagao
        const selectedCard = this.assetGrid.querySelector(`[data-asset-id="${assetId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
    }

    showAssetBrowser() { this.assetBrowserPopup.classList.remove('hidden'); }
    hideAssetBrowser() { this.assetBrowserPopup.classList.add('hidden'); }
    
    showLoading(message = 'Loading...') {
        this.loadingText.textContent = message;
        this.loadingOverlay.classList.remove('hidden');
    }
    
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    updateHistoryButtons(canUndo, canRedo) {
        this.undoBtn.disabled = !canUndo;
        this.redoBtn.disabled = !canRedo;
    }

    updateAll(objects, selectedObject) {
        this.updateHierarchy(objects, selectedObject);
        this.updateInspector(selectedObject);
        this.updateBottomBar(objects.length, selectedObject);
    }

    updateHierarchy(objects, selectedObject) {
        this.hierarchyList.innerHTML = '';
        objects.forEach(obj => {
            const li = document.createElement('li');
            li.textContent = obj.name || `Unnamed (${obj.userData.type || 'Object'})`;
            li.dataset.uuid = obj.uuid;
            if (selectedObject && obj.uuid === selectedObject.uuid) li.classList.add('selected');
            this.hierarchyList.appendChild(li);
        });
    }

    updateInspector(object) {
        if (!object) {
            this.inspectorContent.innerHTML = `<p class="placeholder">Select an object to see its properties.</p>`;
            return;
        }
        const { position, rotation, scale } = object;
        const eulerRotation = { x: THREE.MathUtils.radToDeg(rotation.x), y: THREE.MathUtils.radToDeg(rotation.y), z: THREE.MathUtils.radToDeg(rotation.z) };
        let html = `
            <div class="inspector-group"><h4>General</h4><div class="input-row"><label>N</label><input type="text" id="obj-name" value="${object.name}"></div></div>
            <div class="inspector-group"><h4>Transform</h4><div class="input-row"><label>P</label><div class="input-vec3"><input type="number" step="0.1" data-prop="position" data-axis="x" value="${position.x.toFixed(2)}"><input type="number" step="0.1" data-prop="position" data-axis="y" value="${position.y.toFixed(2)}"><input type="number" step="0.1" data-prop="position" data-axis="z" value="${position.z.toFixed(2)}"></div></div><div class="input-row"><label>R</label><div class="input-vec3"><input type="number" step="1" data-prop="rotation" data-axis="x" value="${eulerRotation.x.toFixed(0)}"><input type="number" step="1" data-prop="rotation" data-axis="y" value="${eulerRotation.y.toFixed(0)}"><input type="number" step="1" data-prop="rotation" data-axis="z" value="${eulerRotation.z.toFixed(0)}"></div></div><div class="input-row"><label>S</label><div class="input-vec3"><input type="number" step="0.1" data-prop="scale" data-axis="x" value="${scale.x.toFixed(2)}"><input type="number" step="0.1" data-prop="scale" data-axis="y" value="${scale.y.toFixed(2)}"><input type="number" step="0.1" data-prop="scale" data-axis="z" value="${scale.z.toFixed(2)}"></div></div></div>
        `;
        this.inspectorContent.innerHTML = html;
        this.addInspectorListeners(object);
    }
    
    addInspectorListeners(object) {
        this.inspectorContent.querySelectorAll('input').forEach(input => {
            let startTransform;
            input.addEventListener('focus', () => {
                 startTransform = {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                };
            });

            input.addEventListener('change', (e) => {
                const prop = e.target.dataset.prop;
                const axis = e.target.dataset.axis;
                let value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                if (isNaN(value) && e.target.type === 'number') return;
                
                if (prop === 'rotation') {
                    object.rotation[axis] = THREE.MathUtils.degToRad(value);
                } else if (prop) {
                    object[prop][axis] = value;
                } else if (input.id === 'obj-name') {
                    object.name = value;
                    this.updateHierarchy(this.app.objects, object);
                    return;
                }
                
                const endTransform = {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                };
                
                if (startTransform && !startTransform.position.equals(endTransform.position)) {
                   this.app.history.add(new TransformCommand(object, startTransform, endTransform));
                }
            });
        });
    }

    updateBottomBar(count, selectedObject) {
        this.objectInfo.textContent = `Objects: ${count} | Selected: ${selectedObject ? selectedObject.name : 'None'}`;
    }

    updateFPS() {
        const time = performance.now();
        this.frameCount++;
        if (time >= this.lastFrameTime + 1000) {
            this.fpsCounter.textContent = `FPS: ${this.frameCount}`;
            this.lastFrameTime = time;
            this.frameCount = 0;
        }
    }
}
//--- END OF FILE UIManager.js ---