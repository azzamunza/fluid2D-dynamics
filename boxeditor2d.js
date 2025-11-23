'use strict'

var BoxEditor2D = (function () {
    
    // 2D AABB (Axis-Aligned Bounding Box) - only X and Y
    function AABB2D(min, max) {
        this.min = [min[0], min[1]];
        this.max = [max[0], max[1]];
    }
    
    AABB2D.prototype.computeArea = function() {
        return (this.max[0] - this.min[0]) * (this.max[1] - this.min[1]);
    };
    
    AABB2D.prototype.randomPoint = function() {
        return [
            this.min[0] + Math.random() * (this.max[0] - this.min[0]),
            this.min[1] + Math.random() * (this.max[1] - this.min[1])
        ];
    };
    
    AABB2D.prototype.clone = function() {
        return new AABB2D(this.min.slice(), this.max.slice());
    };
    
    AABB2D.prototype.contains = function(x, y) {
        return x >= this.min[0] && x <= this.max[0] &&
               y >= this.min[1] && y <= this.max[1];
    };
    
    function BoxEditor2D(canvas, gpuContext, camera, gridDimensions, onLoaded, onChange) {
        this.canvas = canvas;
        this.gpu = gpuContext;
        this.camera = camera;
        this.gridWidth = gridDimensions[0];
        this.gridHeight = gridDimensions[1];
        
        this.boxes = [];
        this.interactionState = null;
        
        this.onLoaded = onLoaded;
        this.onChange = onChange;
        
        // Simple visual state
        this.hoveredBox = null;
        
        if (this.onLoaded) {
            setTimeout(this.onLoaded, 0);
        }
    }
    
    BoxEditor2D.prototype.onMouseDown = function(event) {
        const worldPos = this.camera.screenToWorld(event.clientX, event.clientY);
        
        // Check if clicking on existing box
        for (let i = 0; i < this.boxes.length; i++) {
            const box = this.boxes[i];
            if (box.contains(worldPos[0], worldPos[1])) {
                // Start dragging box
                this.interactionState = {
                    mode: 'dragging',
                    boxIndex: i,
                    startPos: worldPos,
                    originalMin: box.min.slice(),
                    originalMax: box.max.slice()
                };
                return;
            }
        }
        
        // Start creating new box
        this.interactionState = {
            mode: 'creating',
            startPos: worldPos
        };
    };
    
    BoxEditor2D.prototype.onMouseMove = function(event) {
        const worldPos = this.camera.screenToWorld(event.clientX, event.clientY);
        
        if (this.interactionState) {
            if (this.interactionState.mode === 'creating') {
                // Update box being created
                const start = this.interactionState.startPos;
                const min = [
                    Math.min(start[0], worldPos[0]),
                    Math.min(start[1], worldPos[1])
                ];
                const max = [
                    Math.max(start[0], worldPos[0]),
                    Math.max(start[1], worldPos[1])
                ];
                
                // Clamp to grid boundaries
                min[0] = Math.max(0, Math.min(this.gridWidth, min[0]));
                min[1] = Math.max(0, Math.min(this.gridHeight, min[1]));
                max[0] = Math.max(0, Math.min(this.gridWidth, max[0]));
                max[1] = Math.max(0, Math.min(this.gridHeight, max[1]));
                
                this.interactionState.currentBox = new AABB2D(min, max);
            } else if (this.interactionState.mode === 'dragging') {
                // Update box position
                const delta = [
                    worldPos[0] - this.interactionState.startPos[0],
                    worldPos[1] - this.interactionState.startPos[1]
                ];
                
                const box = this.boxes[this.interactionState.boxIndex];
                box.min[0] = this.interactionState.originalMin[0] + delta[0];
                box.min[1] = this.interactionState.originalMin[1] + delta[1];
                box.max[0] = this.interactionState.originalMax[0] + delta[0];
                box.max[1] = this.interactionState.originalMax[1] + delta[1];
                
                // Clamp to grid
                const width = box.max[0] - box.min[0];
                const height = box.max[1] - box.min[1];
                if (box.min[0] < 0) {
                    box.min[0] = 0;
                    box.max[0] = width;
                }
                if (box.max[0] > this.gridWidth) {
                    box.max[0] = this.gridWidth;
                    box.min[0] = this.gridWidth - width;
                }
                if (box.min[1] < 0) {
                    box.min[1] = 0;
                    box.max[1] = height;
                }
                if (box.max[1] > this.gridHeight) {
                    box.max[1] = this.gridHeight;
                    box.min[1] = this.gridHeight - height;
                }
            }
            
            if (this.onChange) {
                this.onChange();
            }
        } else {
            // Update hover state
            this.hoveredBox = null;
            for (let i = 0; i < this.boxes.length; i++) {
                if (this.boxes[i].contains(worldPos[0], worldPos[1])) {
                    this.hoveredBox = i;
                    break;
                }
            }
        }
    };
    
    BoxEditor2D.prototype.onMouseUp = function(event) {
        if (this.interactionState && this.interactionState.mode === 'creating') {
            if (this.interactionState.currentBox) {
                // Add box if it has some size
                const box = this.interactionState.currentBox;
                if (box.computeArea() > 0.1) {
                    this.boxes.push(box);
                    if (this.onChange) {
                        this.onChange();
                    }
                }
            }
        }
        
        this.interactionState = null;
    };
    
    BoxEditor2D.prototype.onKeyDown = function(event) {
        // Delete box with Delete/Backspace
        if ((event.keyCode === 46 || event.keyCode === 8) && this.hoveredBox !== null) {
            event.preventDefault();
            this.boxes.splice(this.hoveredBox, 1);
            this.hoveredBox = null;
            if (this.onChange) {
                this.onChange();
            }
        }
    };
    
    BoxEditor2D.prototype.onKeyUp = function(event) {
        // Nothing needed
    };
    
    BoxEditor2D.prototype.draw = function() {
        // Clear canvas
        const commandEncoder = this.gpu.createCommandEncoder();
        const textureView = this.gpu.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        
        renderPass.end();
        this.gpu.submitCommands(commandEncoder.finish());
        
        // For now, just clear - we'll add box rendering with a simple shader later
        // TODO: Draw boxes, grid, and current interaction state
    };
    
    return {
        BoxEditor2D: BoxEditor2D,
        AABB2D: AABB2D
    };
}());
