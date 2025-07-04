// --- START OF FILE HistoryManager.js ---

// Yeh class ek action ko represent karti hai jise undo ya redo kiya ja sakta hai.
class Command {
    constructor() {
        if (this.constructor === Command) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }
    execute() { throw new Error("Method 'execute()' must be implemented."); }
    undo() { throw new Error("Method 'undo()' must be implemented."); }
}

// Object add karne ka command
export class AddObjectCommand extends Command {
    constructor(app, object) {
        super();
        this.app = app;
        this.object = object;
    }

    execute() {
        this.app.scene.add(this.object);
        if (!this.app.objects.includes(this.object)) {
            this.app.objects.push(this.object);
        }
    }

    undo() {
        this.app.scene.remove(this.object);
        const index = this.app.objects.indexOf(this.object);
        if (index > -1) {
            this.app.objects.splice(index, 1);
        }
    }
}

// Object delete karne ka command
export class DeleteObjectCommand extends Command {
    constructor(app, object) {
        super();
        this.app = app;
        this.object = object;
        this.index = app.objects.indexOf(object);
    }

    execute() {
        // execute mein bhi undo wala kaam hoga, kyunki action pehle hi ho chuka hai
        this.app.scene.remove(this.object);
        const index = this.app.objects.indexOf(this.object);
        if (index > -1) {
            this.app.objects.splice(index, 1);
        }
    }

    undo() {
        // undo mein object wapis aa jayega
        this.app.scene.add(this.object);
        this.app.objects.splice(this.index, 0, this.object);
    }
}

// Object ki position, rotation, scale change karne ka command
export class TransformCommand extends Command {
    constructor(object, oldTransform, newTransform) {
        super();
        this.object = object;
        this.oldTransform = oldTransform;
        this.newTransform = newTransform;
    }

    execute() {
        this.object.position.copy(this.newTransform.position);
        this.object.rotation.copy(this.newTransform.rotation);
        this.object.scale.copy(this.newTransform.scale);
        this.object.updateMatrixWorld();
    }

    undo() {
        this.object.position.copy(this.oldTransform.position);
        this.object.rotation.copy(this.oldTransform.rotation);
        this.object.scale.copy(this.oldTransform.scale);
        this.object.updateMatrixWorld();
    }
}

// Main History Manager Class
export class HistoryManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.undoStack = [];
        this.redoStack = [];
        this.updateUI();
    }

    add(command) {
        this.undoStack.push(command);
        this.redoStack.length = 0; // Jab naya action ho to redo stack clear ho jata hai
        this.updateUI();
    }

    undo() {
        if (this.undoStack.length > 0) {
            const command = this.undoStack.pop();
            command.undo();
            this.redoStack.push(command);
            this.updateUI();
            console.log("Action Undone");
            return command.object; // Taake UI update ho sake
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const command = this.redoStack.pop();
            command.execute();
            this.undoStack.push(command);
            this.updateUI();
            console.log("Action Redone");
            return command.object; // Taake UI update ho sake
        }
    }

    updateUI() {
        this.uiManager.updateHistoryButtons(this.undoStack.length > 0, this.redoStack.length > 0);
    }
}
// --- END OF FILE HistoryManager.js ---