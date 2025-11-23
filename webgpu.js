'use strict'

var WebGPUContext = (function () {
    
    async function checkWebGPUSupport() {
        if (!navigator.gpu) {
            return { supported: false, error: 'WebGPU not supported in this browser' };
        }
        
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance' // Best for Samsung S24 ULTRA
        });
        
        if (!adapter) {
            return { supported: false, error: 'No WebGPU adapter available' };
        }
        
        return { supported: true, adapter: adapter };
    }
    
    function WebGPUContext(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.format = null;
        this.adapter = null;
    }
    
    WebGPUContext.prototype.initialize = async function() {
        const support = await checkWebGPUSupport();
        if (!support.supported) {
            throw new Error(support.error);
        }
        
        this.adapter = support.adapter;
        
        // Request device with required features
        this.device = await this.adapter.requestDevice({
            requiredFeatures: [],
            requiredLimits: {
                maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
                maxBufferSize: this.adapter.limits.maxBufferSize
            }
        });
        
        // Configure canvas context
        this.context = this.canvas.getContext('webgpu');
        this.format = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'premultiplied'
        });
        
        return true;
    };
    
    WebGPUContext.prototype.createBuffer = function(size, usage) {
        return this.device.createBuffer({
            size: size,
            usage: usage,
            mappedAtCreation: false
        });
    };
    
    WebGPUContext.prototype.createBufferWithData = function(data, usage) {
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            usage: usage,
            mappedAtCreation: true
        });
        
        const arrayBuffer = buffer.getMappedRange();
        if (data instanceof Float32Array) {
            new Float32Array(arrayBuffer).set(data);
        } else if (data instanceof Uint32Array) {
            new Uint32Array(arrayBuffer).set(data);
        }
        buffer.unmap();
        
        return buffer;
    };
    
    WebGPUContext.prototype.createTexture = function(width, height, format, usage) {
        return this.device.createTexture({
            size: { width: width, height: height },
            format: format || 'rgba8unorm',
            usage: usage || (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT)
        });
    };
    
    WebGPUContext.prototype.writeBuffer = function(buffer, data, offset) {
        this.device.queue.writeBuffer(buffer, offset || 0, data);
    };
    
    WebGPUContext.prototype.getCurrentTexture = function() {
        return this.context.getCurrentTexture();
    };
    
    WebGPUContext.prototype.createCommandEncoder = function() {
        return this.device.createCommandEncoder();
    };
    
    WebGPUContext.prototype.submitCommands = function(commandBuffer) {
        this.device.queue.submit([commandBuffer]);
    };
    
    // Static method to check support
    WebGPUContext.checkWebGPUSupportWithCallback = async function(onSupported, onNotSupported) {
        try {
            const support = await checkWebGPUSupport();
            if (support.supported) {
                onSupported();
            } else {
                onNotSupported(support.error);
            }
        } catch (error) {
            onNotSupported(error.message);
        }
    };
    
    return WebGPUContext;
}());
