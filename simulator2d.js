'use strict'

var Simulator2D = (function () {
    
    // 2D simulation - X is length, Y is height (no Z depth)
    function Simulator2D(gpuContext, onLoaded) {
        this.gpu = gpuContext;
        this.device = gpuContext.device;
        
        this.particlesWidth = 0;
        this.particlesHeight = 0;
        
        this.gridWidth = 0;  // X dimension
        this.gridHeight = 0; // Y dimension
        
        this.gridResolutionX = 0;
        this.gridResolutionY = 0;
        
        this.particleDensity = 0;
        
        // Simulation parameters
        this.flipness = 0.99; // 0 is full PIC, 1 is full FLIP
        this.frameNumber = 0;
        
        // Buffers for particle data
        this.particlePositionBuffer = null;
        this.particlePositionBufferTemp = null;
        this.particleVelocityBuffer = null;
        this.particleVelocityBufferTemp = null;
        
        // Grid buffers
        this.gridVelocityBuffer = null;
        this.gridWeightBuffer = null;
        this.gridMarkerBuffer = null;
        this.gridPressureBuffer = null;
        this.gridDivergenceBuffer = null;
        
        // Pipeline objects
        this.computePipelines = {};
        this.bindGroups = {};
        
        this.initializeComputeShaders(onLoaded);
    }
    
    Simulator2D.prototype.initializeComputeShaders = function(onLoaded) {
        // We'll initialize compute shaders for:
        // 1. Transfer particles to grid
        // 2. Apply forces
        // 3. Compute divergence
        // 4. Pressure solve (Jacobi iterations)
        // 5. Subtract pressure gradient
        // 6. Transfer grid velocities back to particles
        // 7. Advect particles
        
        // For now, mark as loaded - we'll implement shaders progressively
        if (onLoaded) {
            setTimeout(onLoaded, 0);
        }
    };
    
    Simulator2D.prototype.reset = function(particlesWidth, particlesHeight, particlePositions, gridWidth, gridHeight, gridResolutionX, gridResolutionY, particleDensity) {
        this.particlesWidth = particlesWidth;
        this.particlesHeight = particlesHeight;
        this.particleCount = particlesWidth * particlesHeight;
        
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.gridResolutionX = gridResolutionX;
        this.gridResolutionY = gridResolutionY;
        this.particleDensity = particleDensity;
        
        this.gridCellsX = gridResolutionX + 1; // MAC grid
        this.gridCellsY = gridResolutionY + 1;
        
        // Create particle position buffer with initial positions
        const positionData = new Float32Array(this.particleCount * 4); // vec4 for alignment
        for (let i = 0; i < particlePositions.length; i++) {
            const pos = particlePositions[i];
            positionData[i * 4 + 0] = pos[0]; // x
            positionData[i * 4 + 1] = pos[1]; // y
            positionData[i * 4 + 2] = 0.0;    // unused (was z)
            positionData[i * 4 + 3] = 1.0;    // w for padding
        }
        
        this.particlePositionBuffer = this.gpu.createBufferWithData(
            positionData,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        );
        
        this.particlePositionBufferTemp = this.gpu.createBuffer(
            positionData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        );
        
        // Create particle velocity buffer (initially zero)
        const velocityData = new Float32Array(this.particleCount * 4);
        this.particleVelocityBuffer = this.gpu.createBufferWithData(
            velocityData,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        );
        
        this.particleVelocityBufferTemp = this.gpu.createBuffer(
            velocityData.byteLength,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        );
        
        // Create grid buffers
        const gridSize = this.gridCellsX * this.gridCellsY;
        const gridBufferSize = gridSize * 4 * 4; // vec4 of floats
        
        this.gridVelocityBuffer = this.gpu.createBuffer(
            gridBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        this.gridWeightBuffer = this.gpu.createBuffer(
            gridBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        this.gridMarkerBuffer = this.gpu.createBuffer(
            gridBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        this.gridPressureBuffer = this.gpu.createBuffer(
            gridBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        this.gridDivergenceBuffer = this.gpu.createBuffer(
            gridBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        
        this.frameNumber = 0;
    };
    
    Simulator2D.prototype.simulate = function(timeStep, mouseVelocity, mouseRayOrigin, mouseRayDirection) {
        if (!this.particlePositionBuffer) {
            return; // Not initialized yet
        }
        
        // For now, just increment frame number
        // Full simulation will be implemented with compute shaders
        this.frameNumber++;
        
        // TODO: Implement full 2D FLIP/PIC simulation using WebGPU compute shaders
        // 1. Clear grid
        // 2. Transfer particle velocities to grid
        // 3. Apply external forces (gravity, mouse interaction)
        // 4. Compute divergence
        // 5. Solve pressure (Jacobi iterations)
        // 6. Subtract pressure gradient
        // 7. Transfer grid velocities to particles
        // 8. Advect particles
    };
    
    Simulator2D.prototype.applyForce = function(force) {
        // Apply external force to particles
        // TODO: Implement with compute shader
    };
    
    return Simulator2D;
}());
