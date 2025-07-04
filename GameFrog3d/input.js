// GameForge 3D - Custom Input & Action Mapping System

class InputManager {
    constructor() {
        this.actionMap = {
            'JUMP': ['Space', 'GamepadButton0', 'TouchSwipeUp'],
            'SHOOT': ['MouseLeftClick', 'GamepadRT', 'TouchTapRight'],
            'MOVE_FORWARD': ['KeyW', 'GamepadLeftStickUp'],
            // etc.
        };

        this.currentContext = 'onFoot'; // 'onFoot', 'inCar', 'inMenu'

        this.controlLayout = {
            // User-customizable positions and sizes
            joystick: { x: 100, y: 500, size: 80 },
            jumpButton: { x: 600, y: 480, size: 60 }
        };

        console.log("Input Manager Initialized. Ready for action mapping.");
    }

    // Function to bind an action to a new key/input
    bindAction(action, input) {
        if (this.actionMap[action]) {
            this.actionMap[action].push(input);
        }
    }

    // Function to handle raw input and trigger an action
    handleInput(rawInput) {
        // e.g., rawInput = 'KeyW'
        for (const action in this.actionMap) {
            if (this.actionMap[action].includes(rawInput)) {
                this.triggerAction(action);
                return;
            }
        }
    }

    // Function to perform the game logic for an action
    triggerAction(action) {
        console.log(`Action Triggered: ${action} in context: ${this.currentContext}`);
        // Add switch case or if/else for different actions
        // if (action === 'JUMP' && this.currentContext === 'onFoot') {
        //     player.jump();
        // }
    }
}

// Initialize the input manager
const inputManager = new InputManager();

// Example of how you would use it later
// window.addEventListener('keydown', (e) => inputManager.handleInput(e.code));