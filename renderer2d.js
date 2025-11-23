'use strict'

var Renderer2D = (function () {
    
    var RenderMode = {
        CIRCLES: 0,
        METABALLS: 1
    };
    
    function Renderer2D(canvas, gpuContext, camera2d, onLoaded) {
        this.canvas = canvas;
        this.gpu = gpuContext;
        this.device = gpuContext.device;
        this.camera = camera2d;
        
        this.particlePositionBuffer = null;
        this.particleVelocityBuffer = null;
        this.particleCount = 0;
        this.particleRadius = 0.05;
        
        this.renderMode = RenderMode.CIRCLES;
        
        this.renderPipeline = null;
        this.bindGroup = null;
        
        this.initializeRenderPipelines(onLoaded);
    }
    
    Renderer2D.prototype.initializeRenderPipelines = function(onLoaded) {
        // Circle shader (simple solid circles)
        const circleShaderCode = `
            struct Uniforms {
                viewProjectionMatrix: mat4x4<f32>,
                particleRadius: f32,
                screenWidth: f32,
                screenHeight: f32,
                padding: f32,
            };
            
            struct Particle {
                position: vec4<f32>,
            };
            
            struct Velocity {
                velocity: vec4<f32>,
            };
            
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read> particles: array<Particle>;
            @group(0) @binding(2) var<storage, read> velocities: array<Velocity>;
            
            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) uv: vec2<f32>,
                @location(1) particlePos: vec2<f32>,
                @location(2) velocity: vec3<f32>,
                @location(3) speed: f32,
            };
            
            @vertex
            fn vertexMain(
                @builtin(vertex_index) vertexIndex: u32,
                @builtin(instance_index) instanceIndex: u32
            ) -> VertexOutput {
                var output: VertexOutput;
                
                // Quad vertices for each particle
                var positions = array<vec2<f32>, 6>(
                    vec2<f32>(-1.0, -1.0),
                    vec2<f32>(1.0, -1.0),
                    vec2<f32>(-1.0, 1.0),
                    vec2<f32>(-1.0, 1.0),
                    vec2<f32>(1.0, -1.0),
                    vec2<f32>(1.0, 1.0)
                );
                
                let quadPos = positions[vertexIndex];
                output.uv = quadPos;
                
                let particle = particles[instanceIndex];
                let velocity = velocities[instanceIndex];
                
                output.particlePos = particle.position.xy;
                output.velocity = velocity.velocity.xyz;
                output.speed = length(velocity.velocity.xy);
                
                // Billboard quad in screen space
                let worldPos = particle.position.xy + quadPos * uniforms.particleRadius;
                output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 0.0, 1.0);
                
                return output;
            }
            
            @fragment
            fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
                let dist = length(input.uv);
                
                // Discard pixels outside circle
                if (dist > 1.0) {
                    discard;
                }
                
                // Color based on speed
                let slowColor = vec3<f32>(0.0, 0.4, 0.9);
                let fastColor = vec3<f32>(1.0, 0.3, 0.2);
                let speedFactor = clamp(input.speed * 0.5, 0.0, 1.0);
                let color = mix(slowColor, fastColor, speedFactor);
                
                // Smooth edge antialiasing
                let alpha = 1.0 - smoothstep(0.9, 1.0, dist);
                
                return vec4<f32>(color, alpha);
            }
        `;
        
        // Metaball shader
        const metaballShaderCode = `
            struct Uniforms {
                viewProjectionMatrix: mat4x4<f32>,
                particleRadius: f32,
                screenWidth: f32,
                screenHeight: f32,
                threshold: f32,
            };
            
            struct Particle {
                position: vec4<f32>,
            };
            
            struct Velocity {
                velocity: vec4<f32>,
            };
            
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var<storage, read> particles: array<Particle>;
            @group(0) @binding(2) var<storage, read> velocities: array<Velocity>;
            
            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) worldPos: vec2<f32>,
            };
            
            @vertex
            fn vertexMain(
                @builtin(vertex_index) vertexIndex: u32
            ) -> VertexOutput {
                var output: VertexOutput;
                
                // Full screen quad
                var positions = array<vec2<f32>, 6>(
                    vec2<f32>(-1.0, -1.0),
                    vec2<f32>(1.0, -1.0),
                    vec2<f32>(-1.0, 1.0),
                    vec2<f32>(-1.0, 1.0),
                    vec2<f32>(1.0, -1.0),
                    vec2<f32>(1.0, 1.0)
                );
                
                output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
                output.worldPos = positions[vertexIndex];
                
                return output;
            }
            
            @fragment
            fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
                // Convert screen space to world space (simplified)
                let worldPos = input.worldPos * vec2<f32>(uniforms.screenWidth, uniforms.screenHeight) * 0.01;
                
                var sum: f32 = 0.0;
                var velocitySum = vec2<f32>(0.0, 0.0);
                
                // Calculate metaball field
                for (var i: u32 = 0u; i < arrayLength(&particles); i = i + 1u) {
                    let particle = particles[i];
                    let diff = worldPos - particle.position.xy;
                    let distSq = dot(diff, diff);
                    
                    if (distSq < 1.0) {
                        let influence = 1.0 / (distSq + 0.01);
                        sum = sum + influence;
                        
                        let velocity = velocities[i];
                        velocitySum = velocitySum + velocity.velocity.xy * influence;
                    }
                }
                
                // Threshold for surface
                if (sum < uniforms.threshold) {
                    discard;
                }
                
                let speed = length(velocitySum) / max(sum, 1.0);
                let slowColor = vec3<f32>(0.1, 0.5, 0.9);
                let fastColor = vec3<f32>(1.0, 0.4, 0.3);
                let speedFactor = clamp(speed * 0.3, 0.0, 1.0);
                let color = mix(slowColor, fastColor, speedFactor);
                
                return vec4<f32>(color, 1.0);
            }
        `;
        
        this.circleShaderModule = this.device.createShaderModule({
            code: circleShaderCode,
            label: 'Circle Shader'
        });
        
        this.metaballShaderModule = this.device.createShaderModule({
            code: metaballShaderCode,
            label: 'Metaball Shader'
        });
        
        // Create uniform buffer
        this.uniformBuffer = this.gpu.createBuffer(
            64 + 16, // mat4x4 + 4 floats
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        
        if (onLoaded) {
            setTimeout(onLoaded, 0);
        }
    };
    
    Renderer2D.prototype.setRenderMode = function(mode) {
        this.renderMode = mode;
        this.renderPipeline = null; // Force pipeline recreation
    };
    
    Renderer2D.prototype.setParticleBuffers = function(positionBuffer, velocityBuffer, particleCount) {
        this.particlePositionBuffer = positionBuffer;
        this.particleVelocityBuffer = velocityBuffer;
        this.particleCount = particleCount;
        this.bindGroup = null; // Force bind group recreation
    };
    
    Renderer2D.prototype.createRenderPipeline = function() {
        const isCircleMode = this.renderMode === RenderMode.CIRCLES;
        
        const pipelineDescriptor = {
            label: isCircleMode ? 'Circle Pipeline' : 'Metaball Pipeline',
            layout: 'auto',
            vertex: {
                module: isCircleMode ? this.circleShaderModule : this.metaballShaderModule,
                entryPoint: 'vertexMain',
            },
            fragment: {
                module: isCircleMode ? this.circleShaderModule : this.metaballShaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: this.gpu.format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        };
        
        this.renderPipeline = this.device.createRenderPipeline(pipelineDescriptor);
    };
    
    Renderer2D.prototype.render = function() {
        if (!this.particlePositionBuffer || !this.particleVelocityBuffer) {
            return;
        }
        
        if (!this.renderPipeline) {
            this.createRenderPipeline();
        }
        
        if (!this.bindGroup) {
            this.bindGroup = this.device.createBindGroup({
                layout: this.renderPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.uniformBuffer } },
                    { binding: 1, resource: { buffer: this.particlePositionBuffer } },
                    { binding: 2, resource: { buffer: this.particleVelocityBuffer } },
                ],
            });
        }
        
        // Update uniforms
        const viewProjectionMatrix = this.camera.getViewProjectionMatrix();
        const uniformData = new Float32Array(20);
        uniformData.set(viewProjectionMatrix, 0); // 16 floats
        uniformData[16] = this.particleRadius;
        uniformData[17] = this.canvas.width;
        uniformData[18] = this.canvas.height;
        uniformData[19] = this.renderMode === RenderMode.METABALLS ? 10.0 : 0.0; // threshold
        this.gpu.writeBuffer(this.uniformBuffer, uniformData);
        
        const commandEncoder = this.gpu.createCommandEncoder();
        const textureView = this.gpu.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        
        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        
        if (this.renderMode === RenderMode.CIRCLES) {
            renderPass.draw(6, this.particleCount, 0, 0); // 6 vertices per quad, instanced
        } else {
            renderPass.draw(6, 1, 0, 0); // Full screen quad for metaballs
        }
        
        renderPass.end();
        
        this.gpu.submitCommands(commandEncoder.finish());
    };
    
    Renderer2D.RenderMode = RenderMode;
    
    return Renderer2D;
}());
