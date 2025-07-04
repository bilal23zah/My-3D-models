// --- START OF FILE WorldEditor.js ---

import * as THREE from 'three';

export class WorldEditor {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('world-editor-container');
        this.openToolsBtn = document.getElementById('world-tools-btn');
        
        this.toolsPanel = document.getElementById('tools-panel');
        this.stylePanel = document.getElementById('style-panel');
        this.terrainPanel = document.getElementById('terrain-panel');
        
        this.openStylePanelBtn = document.getElementById('open-style-panel-btn');
        this.openTerrainPanelBtn = document.getElementById('open-terrain-panel-btn');
        this.closeButtons = document.querySelectorAll('.close-panel-btn');
        
        this.generationParams = {
            mountainScale: 100, mountainHeight: 35, mountainOctaves: 6,
            landmassScale: 400, waterLevel: 0.25,   
            persistence: 0.5, lacunarity: 2.0
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.openToolsBtn.addEventListener('click', () => this.showTools());
        this.closeButtons.forEach(btn => btn.addEventListener('click', () => this.hideAll()));
        
        this.openStylePanelBtn.addEventListener('click', () => {
            this.toolsPanel.classList.add('hidden');
            this.stylePanel.classList.remove('hidden');
            this.terrainPanel.classList.add('hidden');
            this.renderStyleEditorContent();
        });

        this.openTerrainPanelBtn.addEventListener('click', () => {
            this.toolsPanel.classList.add('hidden');
            this.stylePanel.classList.add('hidden');
            this.terrainPanel.classList.remove('hidden');
            this.renderTerrainEditorContent();
            this.setActiveToolAndTab('generate-tab', 'none');
        });
    }

    showTools() {
        this.container.classList.remove('hidden');
        this.toolsPanel.classList.remove('hidden');
        this.stylePanel.classList.add('hidden');
        this.terrainPanel.classList.add('hidden');
        this.app.activeTool = 'none';
    }

    hideAll() {
        this.container.classList.add('hidden');
        this.app.activeTool = 'none';
    }
    
    renderStyleEditorContent() {
        const container = this.stylePanel.querySelector('.panel-content');
        container.innerHTML = `
            <h4>Sky Settings</h4>
            <div class="sky-options">
                <button class="simple-btn" id="sky-btn-procedural">Procedural Sky</button>
                <button class="simple-btn" id="sky-btn-hdri">HDRI Skybox</button>
            </div>
        `;
        document.getElementById('sky-btn-procedural').addEventListener('click', () => this.app.setProceduralSky());
        document.getElementById('sky-btn-hdri').addEventListener('click', () => this.app.setSkybox('assets/sky.hdr'));
    }
    
    renderTerrainEditorContent() {
        const container = document.getElementById('terrain-editor-content');
        container.innerHTML = `
            <div class="terrain-tab-nav">
                <button class="terrain-tab-btn active" data-tab="generate-tab">Generate</button>
                <button class="terrain-tab-btn" data-tab="sculpt-tab">Sculpt</button>
                <button class="terrain-tab-btn" data-tab="paint-tab">Paint</button> 
                <button class="terrain-tab-btn" data-tab="properties-tab">Properties</button> 
            </div>
            <div id="generate-tab" class="terrain-tab-content active"></div>
            <div id="sculpt-tab" class="terrain-tab-content"></div>
            <div id="paint-tab" class="terrain-tab-content"></div>
            <div id="properties-tab" class="terrain-tab-content"></div>
        `;
        this.renderGenerateTab();
        this.renderSculptTab();
        this.renderPaintTab();
        this.renderPropertiesTab();
        this.setupTerrainEditorListeners();
    }
    
    renderGenerateTab() {
        const container = document.getElementById('generate-tab');
        container.innerHTML = `
            <p class="panel-desc">Sliders ko move karke live preview dekhein.</p>
            <h5>Landmass Shape</h5>
            <div class="brush-controls">
                <label>Shape Size</label>
                <input type="range" class="gen-slider" id="gen-landmass-scale" min="100" max="800" value="${this.generationParams.landmassScale}"><span id="gen-landmass-scale-value">${this.generationParams.landmassScale}</span>
            </div>
            <div class="brush-controls">
                <label>Water Level</label>
                <input type="range" class="gen-slider" id="gen-water-level" min="0" max="1" step="0.01" value="${this.generationParams.waterLevel}"><span id="gen-water-level-value">${this.generationParams.waterLevel}</span>
            </div>
            <h5 class="mt-15">Mountains</h5>
            <div class="brush-controls">
                <label>Mtn. Size</label>
                <input type="range" class="gen-slider" id="gen-mountain-scale" min="10" max="200" value="${this.generationParams.mountainScale}"><span id="gen-mountain-scale-value">${this.generationParams.mountainScale}</span>
            </div>
            <div class="brush-controls">
                <label>Mtn. Height</label>
                <input type="range" class="gen-slider" id="gen-mountain-height" min="1" max="50" value="${this.generationParams.mountainHeight}"><span id="gen-mountain-height-value">${this.generationParams.mountainHeight}</span>
            </div>
            <div class="brush-controls">
                <label>Mtn. Detail</label>
                <input type="range" class="gen-slider" id="gen-mountain-octaves" min="1" max="10" value="${this.generationParams.mountainOctaves}"><span id="gen-mountain-octaves-value">${this.generationParams.mountainOctaves}</span>
            </div>
            <div class="button-group mt-15">
                <button id="generate-terrain-btn" class="simple-btn primary-btn">Apply & Add Foliage</button>
                <button id="reset-terrain-btn" class="simple-btn danger-btn">Reset to Flat</button>
            </div>
        `;
    }

    renderSculptTab() {
        const container = document.getElementById('sculpt-tab');
        const brush = this.app.terrainBrush;
        container.innerHTML = `
            <h4>Sculpt Brushes</h4>
            <div class="brush-grid">
                <button class="brush-btn active" data-brush="raise">Raise</button>
                <button class="brush-btn" data-brush="lower">Lower</button>
                <button class="brush-btn" data-brush="flatten">Flatten</button>
                <button class="brush-btn" data-brush="smooth">Smooth</button>
            </div>
            <hr class="panel-divider">
            <h4>Brush Settings</h4>
            <div class="brush-controls">
                <label>Size</label>
                <input type="range" id="sculpt-brush-size" min="1" max="50" value="${brush.size}"><span id="sculpt-brush-size-value">${brush.size}</span>
            </div>
            <div class="brush-controls">
                <label>Strength</label>
                <input type="range" id="sculpt-brush-strength" min="0.05" max="1" step="0.05" value="${brush.strength}"><span id="sculpt-brush-strength-value">${brush.strength.toFixed(2)}</span>
            </div>
        `;
    }

    renderPaintTab() {
        const container = document.getElementById('paint-tab');
        const brush = this.app.paintBrush;
        container.innerHTML = `
            <h4>Texture Palette</h4>
            <p class="panel-desc">Texture chunein aur zameen par paint karein.</p>
            <div class="texture-paint-grid">
                <button class="texture-paint-btn active" data-texture="grass" style="background-image: url('assets/textures/grass.jpg');" title="Grass"></button>
                <button class="texture-paint-btn" data-texture="rock" style="background-image: url('assets/textures/rock.jpg');" title="Rock"></button>
                <button class="texture-paint-btn" data-texture="sand" style="background-image: url('assets/textures/sand.jpg');" title="Sand"></button>
                <button class="texture-paint-btn" data-texture="erase" style="background-image: url('assets/icons/eraser.svg'); background-color: #555;" title="Erase (Return to Grass)"></button>
            </div>
            <hr class="panel-divider">
            <h4>Brush Settings</h4>
            <div class="brush-controls">
                <label>Size</label>
                <input type="range" id="paint-brush-size" min="1" max="50" value="${brush.size}"><span id="paint-brush-size-value">${brush.size}</span>
            </div>
            <div class="brush-controls">
                <label>Strength</label>
                <input type="range" id="paint-brush-strength" min="0.01" max="1" step="0.01" value="${brush.strength}"><span id="paint-brush-strength-value">${brush.strength.toFixed(2)}</span>
            </div>
        `;
    }

    renderPropertiesTab() {
        const container = document.getElementById('properties-tab');
        const terrain = this.app.terrain;
        container.innerHTML = `
            <h4>Base Properties</h4>
            <p class="panel-desc">Zameen ki bunyadi sakht (structure) badlein. Yeh terrain ko reset kar dega.</p>
            <div class="brush-controls">
                <label>Size (W/L)</label>
                <input type="range" id="terrain-prop-size" min="100" max="1000" step="50" value="${terrain.size}"><span id="terrain-prop-size-value">${terrain.size}</span>
            </div>
            <div class="brush-controls">
                <label>Segments</label>
                <input type="range" id="terrain-prop-segments" min="64" max="512" step="64" value="${terrain.segments}"><span id="terrain-prop-segments-value">${terrain.segments}</span>
            </div>
            <button id="recreate-terrain-btn" class="simple-btn mt-15">Apply & Recreate</button>
            <hr class="panel-divider">
            <h4>Material Properties</h4>
            <div class="brush-controls">
                <label>Brightness</label>
                <input type="range" id="terrain-prop-brightness" min="0.1" max="2" step="0.05" value="1.0"><span id="terrain-prop-brightness-value">1.0</span>
            </div>
        `;
    }

    setActiveToolAndTab(tabId, toolName) {
        const container = document.getElementById('terrain-editor-content');
        container.querySelectorAll('.terrain-tab-btn, .terrain-tab-content').forEach(el => el.classList.remove('active'));
        
        const tabButton = container.querySelector(`.terrain-tab-btn[data-tab="${tabId}"]`);
        const tabContent = document.getElementById(tabId);

        if(tabButton) tabButton.classList.add('active');
        if(tabContent) tabContent.classList.add('active');
        
        this.app.activeTool = toolName;

        if(tabId === 'sculpt-tab') this.app.terrainBrush.type = 'raise';
        if(tabId === 'paint-tab') this.app.paintBrush.type = 'grass';
    }

    setupTerrainEditorListeners() {
        const container = document.getElementById('terrain-editor-content');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.matches('.terrain-tab-btn')) {
                const tabId = target.dataset.tab;
                const toolMap = { 'generate-tab': 'none', 'sculpt-tab': 'sculpt', 'paint-tab': 'paint', 'properties-tab': 'none' };
                this.setActiveToolAndTab(tabId, toolMap[tabId]);
            }
            if (target.id === 'generate-terrain-btn') {
                this.app.createVegetation();
                this.app.createGrass();
            }
            if (target.id === 'reset-terrain-btn') {
                this.app.terrain.reset();
                this.app.createVegetation(); 
                this.app.createGrass();      
            }
            if (target.matches('#sculpt-tab .brush-btn')) {
                this.app.terrainBrush.type = target.dataset.brush;
                container.querySelectorAll('#sculpt-tab .brush-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
            }
            if (target.matches('#paint-tab .texture-paint-btn')) {
                const textureType = target.dataset.texture;
                this.app.paintBrush.type = textureType;
                
                const colorMap = {
                    'rock':  { r: 255, g: 0, b: 0 },
                    'grass': { r: 0, g: 255, b: 0 },
                    'sand':  { r: 0, g: 0, b: 255 },
                    'erase': { r: 0, g: 255, b: 0 } 
                };
                this.app.paintBrush.color = colorMap[textureType];
                container.querySelectorAll('#paint-tab .texture-paint-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
            }
            if (target.id === 'recreate-terrain-btn') {
                const size = parseInt(document.getElementById('terrain-prop-size').value);
                const segments = parseInt(document.getElementById('terrain-prop-segments').value);
                this.app.terrain.recreate(size, segments);
            }
        });

        container.addEventListener('input', (e) => {
            const target = e.target;
            if (target.type !== 'range') return;
            
            const value = parseFloat(target.value);
            const valueSpan = document.getElementById(`${target.id}-value`);

            if(target.matches('.gen-slider')) {
                const paramName = target.id.replace('gen-', '').replace(/-/g, '_');
                const key = paramName.split('_').map((word, index) => index > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join('');
                this.generationParams[key] = value;
                valueSpan.textContent = target.step === "0.01" ? value.toFixed(2) : value;
                this.app.terrain.generate(this.generationParams);
            }
            
            if(target.id.startsWith('sculpt-brush')) {
                const prop = target.id.includes('size') ? 'size' : 'strength';
                this.app.terrainBrush[prop] = value;
                valueSpan.textContent = prop === 'strength' ? value.toFixed(2) : value;
            }

            if(target.id.startsWith('paint-brush')) {
                const prop = target.id.includes('size') ? 'size' : 'strength';
                this.app.paintBrush[prop] = value;
                valueSpan.textContent = prop === 'strength' ? value.toFixed(2) : value;
            }
            
            if (target.id === 'terrain-prop-brightness') {
                this.app.terrain.setBrightness(value);
                valueSpan.textContent = value.toFixed(2);
            } else if (target.id.startsWith('terrain-prop-')) {
                 valueSpan.textContent = value;
            }
        });
    }
}
// --- END OF FILE WorldEditor.js ---