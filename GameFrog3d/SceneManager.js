export class SceneManager {
    constructor(app) {
        this.app = app; // Reference to the main application
        document.getElementById('save-scene-btn').addEventListener('click', () => this.saveScene());
    }

    saveScene() {
        const sceneData = {
            objects: []
        };

        this.app.objects.forEach(obj => {
            const objectData = {
                name: obj.name,
                type: obj.userData.type,
                position: obj.position.toArray(),
                rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
                scale: obj.scale.toArray()
            };
            sceneData.objects.push(objectData);
        });

        const jsonString = JSON.stringify(sceneData, null, 2);
        this.download(jsonString, 'scene.json', 'application/json');
        console.log('Scene Saved!', sceneData);
    }
    
    download(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }
}