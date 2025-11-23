'use strict'

var Camera2D = (function () {
    
    function Camera2D(canvas, initialCenter) {
        this.canvas = canvas;
        
        // 2D camera only needs position and zoom
        this.centerX = initialCenter ? initialCenter[0] : 0;
        this.centerY = initialCenter ? initialCenter[1] : 0;
        this.zoom = 1.0;
        
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.targetZoom = this.zoom;
        this.minZoom = 0.1;
        this.maxZoom = 10.0;
        
        this.viewProjectionMatrix = new Float32Array(16);
        this.updateMatrix();
    }
    
    Camera2D.prototype.updateMatrix = function() {
        const aspect = this.canvas.width / this.canvas.height;
        const halfWidth = 20 / this.zoom; // View width in world units
        const halfHeight = halfWidth / aspect;
        
        // Orthographic projection for 2D
        // Left, Right, Bottom, Top, Near, Far
        const left = this.centerX - halfWidth;
        const right = this.centerX + halfWidth;
        const bottom = this.centerY - halfHeight;
        const top = this.centerY + halfHeight;
        const near = -1.0;
        const far = 1.0;
        
        // Create orthographic projection matrix
        const m = this.viewProjectionMatrix;
        
        m[0] = 2 / (right - left);
        m[1] = 0;
        m[2] = 0;
        m[3] = 0;
        
        m[4] = 0;
        m[5] = 2 / (top - bottom);
        m[6] = 0;
        m[7] = 0;
        
        m[8] = 0;
        m[9] = 0;
        m[10] = -2 / (far - near);
        m[11] = 0;
        
        m[12] = -(right + left) / (right - left);
        m[13] = -(top + bottom) / (top - bottom);
        m[14] = -(far + near) / (far - near);
        m[15] = 1;
    };
    
    Camera2D.prototype.getViewProjectionMatrix = function() {
        return this.viewProjectionMatrix;
    };
    
    Camera2D.prototype.onMouseDown = function(event) {
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    };
    
    Camera2D.prototype.onMouseMove = function(event) {
        if (this.isDragging) {
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;
            
            // Convert screen delta to world delta
            const worldScale = 40 / (this.zoom * this.canvas.width);
            this.centerX -= deltaX * worldScale;
            this.centerY += deltaY * worldScale; // Flip Y
            
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            
            this.updateMatrix();
        }
    };
    
    Camera2D.prototype.onMouseUp = function(event) {
        this.isDragging = false;
    };
    
    Camera2D.prototype.onMouseWheel = function(event) {
        event.preventDefault();
        
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
    };
    
    Camera2D.prototype.update = function() {
        // Smooth zoom
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        this.updateMatrix();
    };
    
    Camera2D.prototype.screenToWorld = function(screenX, screenY) {
        const aspect = this.canvas.width / this.canvas.height;
        const halfWidth = 20 / this.zoom;
        const halfHeight = halfWidth / aspect;
        
        const ndcX = (screenX / this.canvas.width) * 2 - 1;
        const ndcY = 1 - (screenY / this.canvas.height) * 2;
        
        const worldX = this.centerX + ndcX * halfWidth;
        const worldY = this.centerY + ndcY * halfHeight;
        
        return [worldX, worldY];
    };
    
    return Camera2D;
}());
