// --- START OF FILE GizmoManager.js ---
import * as THREE from 'three';

export class GizmoManager {
    constructor(camera, canvas, objectUpdatedCallback, onDuplicateCallback, onTransformEndCallback) {
        this.camera = camera;
        this.canvas = canvas;
        this.objectUpdatedCallback = objectUpdatedCallback;
        this.onDuplicateCallback = onDuplicateCallback;
        this.onTransformEndCallback = onTransformEndCallback; // Naya callback

        this.gizmoContainer = document.getElementById('gizmo-container');
        this.scaleHandle = document.getElementById('gizmo-scale');
        this.rotateYHandle = document.getElementById('gizmo-rotate-y');
        this.rotateZHandle = document.getElementById('gizmo-rotate-z');
        this.moveYHandle = document.getElementById('gizmo-move-y');
        this.duplicateHandle = document.getElementById('gizmo-duplicate');

        this.targetObject = null;
        this.isDragging = false;
        // Drag state ab purani transform values ko bhi save karega
        this.dragState = { 
            handle: null, startX: 0, startY: 0,
            initialTransform: { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3() } 
        };
        this.setupEventListeners();
    }
    setupEventListeners() {
        const handles = [
            { el: this.scaleHandle, type: 'scale' }, 
            { el: this.rotateYHandle, type: 'rotateY' }, 
            { el: this.rotateZHandle, type: 'rotateZ' }, 
            { el: this.moveYHandle, type: 'moveY' }, 
            { el: this.duplicateHandle, type: 'duplicate' }
        ];
        handles.forEach(h => {
            const down = (e) => this.onDragStart(e, h.type);
            h.el.addEventListener('mousedown', down);
            h.el.addEventListener('touchstart', down, { passive: false });
        });
        const move = (e) => this.onDragMove(e);
        const up = () => this.onDragEnd();
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', up);
        window.addEventListener('touchend', up);
    }
    show(object) { this.targetObject = object; this.gizmoContainer.classList.remove('hidden'); this.updatePosition(); }
    hide() { this.targetObject = null; this.gizmoContainer.classList.add('hidden'); }
    updatePosition() {
        if (!this.targetObject) return;
        const vector = new THREE.Vector3().setFromMatrixPosition(this.targetObject.matrixWorld).project(this.camera);
        if (vector.z > 1) { this.gizmoContainer.style.display = 'none'; return; }
        this.gizmoContainer.style.display = 'block';
        const x = (vector.x * 0.5 + 0.5) * this.canvas.clientWidth;
        const y = (vector.y * -0.5 + 0.5) * this.canvas.clientHeight;
        this.gizmoContainer.style.left = `${x}px`; this.gizmoContainer.style.top = `${y}px`;
    }
    onDragStart(e, type) {
        if (!this.targetObject) return;
        e.preventDefault(); e.stopPropagation();
        if (type === 'duplicate') { if (this.onDuplicateCallback) { this.onDuplicateCallback(this.targetObject); } return; }
        this.isDragging = true; this.dragState.handle = type;
        const touch = e.touches ? e.touches[0] : e;
        this.dragState.startX = touch.clientX; this.dragState.startY = touch.clientY;
        
        // Drag shuru hone se pehle object ki state save karo
        this.dragState.initialTransform.position.copy(this.targetObject.position);
        this.dragState.initialTransform.rotation.copy(this.targetObject.rotation);
        this.dragState.initialTransform.scale.copy(this.targetObject.scale);
    }
    onDragMove(e) {
        if (!this.isDragging || !this.targetObject) return;
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const deltaX = touch.clientX - this.dragState.startX;
        const deltaY = touch.clientY - this.dragState.startY;

        const initial = this.dragState.initialTransform;

        switch (this.dragState.handle) {
            case 'rotateY': this.targetObject.rotation.y = initial.rotation.y + (deltaX * 0.01); break;
            case 'rotateZ': this.targetObject.rotation.z = initial.rotation.z + (deltaX * 0.01); break;
            case 'moveY': this.targetObject.position.y = initial.position.y - (deltaY * 0.05); break;
            case 'scale': const newScale = Math.max(0.1, initial.scale.x + (-deltaY * 0.01)); this.targetObject.scale.set(newScale, newScale, newScale); break;
        }
        if (this.objectUpdatedCallback) { this.objectUpdatedCallback(); }
    }
    onDragEnd() {
        if (this.isDragging && this.targetObject) {
            // Drag khatam hone par final state get karo
            const finalTransform = {
                position: this.targetObject.position.clone(),
                rotation: this.targetObject.rotation.clone(),
                scale: this.targetObject.scale.clone(),
            };
            // Callback call karo taake history mein save ho
            if(this.onTransformEndCallback) {
                this.onTransformEndCallback(this.targetObject, this.dragState.initialTransform, finalTransform);
            }
        }
        this.isDragging = false; 
        this.dragState.handle = null; 
    }
}
// --- END OF FILE GizmoManager.js ---