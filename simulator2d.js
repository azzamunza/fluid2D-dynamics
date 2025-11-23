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
        // Simple advection shader for basic particle movement
        const advectShaderCode = `
            struct Uniforms {
                gridWidth: f32,
                gridHeight: f32,
                deltaTime: f32,
                frameNumber: u32,
                particleCount: u32,
                padding: vec3<f32>,
            }
            
            struct Particle {
                position: vec4<f32>,
            }
            
            struct Velocity {
                velocity: vec4<f32>,
            }
            
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read> positionsIn: array<Particle>;
            @group(0) @binding(2) var<storage, read_write> positionsOut: array<Particle>;
            @group(0) @binding(3) var<storage, read_write> velocities: array<Velocity>;
            
            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let index = global_id.x;
                if (index >= u32(uniforms.particleCount)) {
                    return;
                }
                
                let pos = positionsIn[index].position.xy;
                var vel = velocities[index].velocity.xy;
                
                // Apply gravity
                vel.y = vel.y - 9.8 * uniforms.deltaTime;
                
                // Simple damping
                vel = vel * 0.999;
                
                // Advect position
                var newPos = pos + vel * uniforms.deltaTime;
                
                // Boundary conditions - bounce off walls
                if (newPos.x < 0.1) {
                    newPos.x = 0.1;
                    vel.x = abs(vel.x) * 0.5;
                }
                if (newPos.x > uniforms.gridWidth - 0.1) {
                    newPos.x = uniforms.gridWidth - 0.1;
                    vel.x = -abs(vel.x) * 0.5;
                }
                if (newPos.y < 0.1) {
                    newPos.y = 0.1;
                    vel.y = abs(vel.y) * 0.5;
                }
                if (newPos.y > uniforms.gridHeight - 0.1) {
                    newPos.y = uniforms.gridHeight - 0.1;
                    vel.y = -abs(vel.y) * 0.5;
                }
                
                positionsOut[index].position = vec4<f32>(newPos, 0.0, 1.0);
                velocities[index].velocity = vec4<f32>(vel, 0.0, 0.0);
            }
        `;
        
        this.advectShaderModule = this.device.createShaderModule({
            code: advectShaderCode,
            label: 'Advect Shader'
        });
        
        // Create uniform buffer for compute shaders
        this.computeUniformBuffer = this.gpu.createBuffer(
            64, // Enough for uniforms
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        
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
        if (!this.particlePositionBuffer || !this.advectShaderModule) {
            return; // Not initialized yet
        }
        
        this.frameNumber++;
        
        // Create compute pipeline if needed
        if (!this.advectPipeline) {
            this.advectPipeline = this.device.createComputePipeline({
                label: 'Advect Pipeline',
                layout: 'auto',
                compute: {
                    module: this.advectShaderModule,
                    entryPoint: 'main'
                }
            });
        }
        
        // Create bind group if needed
        if (!this.computeBindGroup) {
            this.computeBindGroup = this.device.createBindGroup({
                layout: this.advectPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.computeUniformBuffer } },
                    { binding: 1, resource: { buffer: this.particlePositionBuffer } },
                    { binding: 2, resource: { buffer: this.particlePositionBufferTemp } },
                    { binding: 3, resource: { buffer: this.particleVelocityBuffer } },
                ],
            });
        }
        
        // Update uniforms
        const uniformData = new Float32Array(16);
        uniformData[0] = this.gridWidth;
        uniformData[1] = this.gridHeight;
        uniformData[2] = timeStep;
        uniformData[3] = this.frameNumber;
        uniformData[4] = this.particleCount;
        this.gpu.writeBuffer(this.computeUniformBuffer, uniformData);
        
        // Run compute shader
        const commandEncoder = this.gpu.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        
        passEncoder.setPipeline(this.advectPipeline);
        passEncoder.setBindGroup(0, this.computeBindGroup);
        
        const workgroupCount = Math.ceil(this.particleCount / 64);
        passEncoder.dispatchWorkgroups(workgroupCount);
        
        passEncoder.end();
        
        // Copy temp buffer back to main buffer
        commandEncoder.copyBufferToBuffer(
            this.particlePositionBufferTemp,
            0,
            this.particlePositionBuffer,
            0,
            this.particleCount * 16
        );
        
        this.gpu.submitCommands(commandEncoder.finish());
        
        // Swap buffers
        const tempPos = this.particlePositionBuffer;
        this.particlePositionBuffer = this.particlePositionBufferTemp;
        this.particlePositionBufferTemp = tempPos;
        
        // Mark bind group for recreation with swapped buffers
        this.computeBindGroup = null;
    };
    
    Simulator2D.prototype.applyForce = function(force) {
        // Apply external force to particles
        // TODO: Implement with compute shader
    };
    
    return Simulator2D;
}());
