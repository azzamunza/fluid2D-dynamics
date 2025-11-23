'use strict'

var FluidParticles2D = (function () {
    
    var State = {
        EDITING: 0,
        SIMULATING: 1
    };
    
    var GRID_WIDTH = 40;   // X dimension
    var GRID_HEIGHT = 20;  // Y dimension
    
    var PARTICLES_PER_CELL = 10;
    
    function FluidParticles2D() {
        this.canvas = document.getElementById('canvas');
        this.state = null;
        this.gpuContext = null;
        
        this.initializeAsync();
    }
    
    FluidParticles2D.prototype.initializeAsync = async function() {
        try {
            this.gpuContext = new WebGPUContext(this.canvas);
            await this.gpuContext.initialize();
            
            window.gpu = this.gpuContext; // For debugging
            
            this.camera = new Camera2D(this.canvas, [GRID_WIDTH / 2, GRID_HEIGHT / 2]);
            
            var boxEditorLoaded = false,
                rendererLoaded = false,
                simulatorLoaded = false;
            
            var start = function() {
                if (boxEditorLoaded && rendererLoaded && simulatorLoaded) {
                    this.setupUI();
                    this.startUpdateLoop();
                }
            }.bind(this);
            
            this.boxEditor = new BoxEditor2D.BoxEditor2D(
                this.canvas, 
                this.gpuContext, 
                this.camera, 
                [GRID_WIDTH, GRID_HEIGHT],
                function() {
                    boxEditorLoaded = true;
                    start();
                },
                this.redrawUI.bind(this)
            );
            
            this.renderer = new Renderer2D(
                this.canvas,
                this.gpuContext,
                this.camera,
                function() {
                    rendererLoaded = true;
                    start();
                }
            );
            
            this.simulator = new Simulator2D(
                this.gpuContext,
                function() {
                    simulatorLoaded = true;
                    start();
                }
            );
            
        } catch (error) {
            console.error('WebGPU initialization failed:', error);
            this.showError('WebGPU not supported: ' + error.message);
        }
    };
    
    FluidParticles2D.prototype.setupUI = function() {
        this.state = State.EDITING;
        
        // Start button
        this.startButton = document.getElementById('start-button');
        this.startButton.addEventListener('click', function() {
            if (this.state === State.EDITING) {
                if (this.boxEditor.boxes.length > 0) {
                    this.startSimulation();
                }
                this.redrawUI();
            } else if (this.state === State.SIMULATING) {
                this.stopSimulation();
                this.redrawUI();
            }
        }.bind(this));
        
        // Preset button
        this.currentPresetIndex = 0;
        this.editedSinceLastPreset = false;
        var PRESETS = [
            // Left column
            [new BoxEditor2D.AABB2D([0, 0], [15, 20])],
            // Bottom bar + top block
            [
                new BoxEditor2D.AABB2D([0, 0], [40, 7]),
                new BoxEditor2D.AABB2D([12, 12], [28, 20])
            ],
            // Two columns
            [
                new BoxEditor2D.AABB2D([0, 0], [10, 15]),
                new BoxEditor2D.AABB2D([30, 5], [40, 20])
            ],
        ];
        
        this.presetButton = document.getElementById('preset-button');
        this.presetButton.addEventListener('click', function() {
            this.editedSinceLastPreset = false;
            this.boxEditor.boxes.length = 0;
            
            var preset = PRESETS[this.currentPresetIndex];
            for (var i = 0; i < preset.length; ++i) {
                this.boxEditor.boxes.push(preset[i].clone());
            }
            
            this.currentPresetIndex = (this.currentPresetIndex + 1) % PRESETS.length;
            this.redrawUI();
        }.bind(this));
        
        // Parameters
        this.gridCellDensity = 1.0;
        this.timeStep = 1.0 / 60.0;
        this.particleCount = 160000;
        this.maxParticleCount = 300000;
        
        // Density slider
        this.densitySlider = new Slider(
            document.getElementById('density-slider'),
            this.gridCellDensity,
            0.2, 3.0,
            function(value) {
                this.gridCellDensity = value;
                this.redrawUI();
            }.bind(this)
        );
        
        // Fluidity slider
        this.flipnessSlider = new Slider(
            document.getElementById('fluidity-slider'),
            this.simulator.flipness,
            0.5, 0.99,
            function(value) {
                this.simulator.flipness = value;
            }.bind(this)
        );
        
        // Speed slider
        this.speedSlider = new Slider(
            document.getElementById('speed-slider'),
            this.timeStep,
            0.0, 1.0 / 60.0,
            function(value) {
                this.timeStep = value;
            }.bind(this)
        );
        
        // Particle count slider
        this.particleCountSlider = new Slider(
            document.getElementById('particle-count-slider'),
            this.particleCount,
            10000, this.maxParticleCount,
            function(value) {
                this.particleCount = Math.round(value);
                this.redrawUI();
            }.bind(this)
        );
        
        // Render mode toggle
        this.renderModeToggle = document.getElementById('render-mode-toggle');
        if (this.renderModeToggle) {
            this.renderModeToggle.addEventListener('click', function() {
                const currentMode = this.renderer.renderMode;
                const newMode = currentMode === Renderer2D.RenderMode.CIRCLES ? 
                    Renderer2D.RenderMode.METABALLS : Renderer2D.RenderMode.CIRCLES;
                this.renderer.setRenderMode(newMode);
                this.redrawUI();
            }.bind(this));
        }
        
        // Performance sliders (grid resolution)
        this.gridResolutionScale = 1.0;
        this.gridResSlider = new Slider(
            document.getElementById('grid-resolution-slider'),
            this.gridResolutionScale,
            0.5, 2.0,
            function(value) {
                this.gridResolutionScale = value;
                this.redrawUI();
            }.bind(this)
        );
        
        // Mouse events
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        window.addEventListener('resize', this.onResize.bind(this));
        this.onResize();
        
        this.redrawUI();
        this.presetButton.click();
    };
    
    FluidParticles2D.prototype.startUpdateLoop = function() {
        var lastTime = 0;
        var update = function(currentTime) {
            var deltaTime = currentTime - lastTime || 0;
            lastTime = currentTime;
            
            this.update(deltaTime);
            requestAnimationFrame(update);
        }.bind(this);
        update(0);
    };
    
    FluidParticles2D.prototype.onResize = function() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Reconfigure WebGPU context
        if (this.gpuContext && this.gpuContext.context) {
            this.gpuContext.context.configure({
                device: this.gpuContext.device,
                format: this.gpuContext.format,
                alphaMode: 'premultiplied'
            });
        }
        
        this.camera.updateMatrix();
    };
    
    FluidParticles2D.prototype.onMouseMove = function(event) {
        event.preventDefault();
        
        if (this.state === State.EDITING) {
            this.boxEditor.onMouseMove(event);
            if (this.boxEditor.interactionState !== null) {
                this.editedSinceLastPreset = true;
            }
        } else if (this.state === State.SIMULATING) {
            this.camera.onMouseMove(event);
        }
    };
    
    FluidParticles2D.prototype.onMouseDown = function(event) {
        event.preventDefault();
        
        if (this.state === State.EDITING) {
            this.boxEditor.onMouseDown(event);
        } else if (this.state === State.SIMULATING) {
            this.camera.onMouseDown(event);
        }
    };
    
    FluidParticles2D.prototype.onMouseUp = function(event) {
        event.preventDefault();
        
        if (this.state === State.EDITING) {
            this.boxEditor.onMouseUp(event);
        } else if (this.state === State.SIMULATING) {
            this.camera.onMouseUp(event);
        }
    };
    
    FluidParticles2D.prototype.onMouseWheel = function(event) {
        if (this.state === State.SIMULATING) {
            this.camera.onMouseWheel(event);
        }
    };
    
    FluidParticles2D.prototype.onKeyDown = function(event) {
        if (this.state === State.EDITING) {
            this.boxEditor.onKeyDown(event);
        }
    };
    
    FluidParticles2D.prototype.onKeyUp = function(event) {
        if (this.state === State.EDITING) {
            this.boxEditor.onKeyUp(event);
        }
    };
    
    FluidParticles2D.prototype.redrawUI = function() {
        if (!this.startButton) return;
        
        var simulatingElements = document.querySelectorAll('.simulating-ui');
        var editingElements = document.querySelectorAll('.editing-ui');
        
        if (this.state === State.SIMULATING) {
            for (var i = 0; i < simulatingElements.length; ++i) {
                simulatingElements[i].style.display = 'block';
            }
            for (var i = 0; i < editingElements.length; ++i) {
                editingElements[i].style.display = 'none';
            }
            this.startButton.textContent = 'Edit';
            this.startButton.className = 'start-button-active';
        } else if (this.state === State.EDITING) {
            for (var i = 0; i < simulatingElements.length; ++i) {
                simulatingElements[i].style.display = 'none';
            }
            for (var i = 0; i < editingElements.length; ++i) {
                editingElements[i].style.display = 'block';
            }
            
            document.getElementById('particle-count').innerHTML = 
                this.getParticleCount().toFixed(0) + ' particles';
            
            if (this.boxEditor.boxes.length > 0) {
                this.startButton.className = 'start-button-active';
            } else {
                this.startButton.className = 'start-button-inactive';
            }
            
            this.startButton.textContent = 'Start';
            
            if (this.editedSinceLastPreset) {
                this.presetButton.innerHTML = 'Use Preset';
            } else {
                this.presetButton.innerHTML = 'Next Preset';
            }
        }
        
        // Update render mode button
        if (this.renderModeToggle && this.renderer) {
            if (this.renderer.renderMode === Renderer2D.RenderMode.CIRCLES) {
                this.renderModeToggle.textContent = 'Mode: Circles';
            } else {
                this.renderModeToggle.textContent = 'Mode: Metaballs';
            }
        }
        
        this.flipnessSlider.redraw();
        this.densitySlider.redraw();
        this.speedSlider.redraw();
        if (this.particleCountSlider) this.particleCountSlider.redraw();
        if (this.gridResSlider) this.gridResSlider.redraw();
    };
    
    FluidParticles2D.prototype.getParticleCount = function() {
        if (this.particleCountSlider) {
            return this.particleCount;
        }
        
        // Calculate based on grid density and box volumes
        var gridCells = GRID_WIDTH * GRID_HEIGHT * this.gridCellDensity;
        var gridResolutionY = Math.ceil(Math.sqrt(gridCells / 2));
        var gridResolutionX = gridResolutionY * 2;
        
        var totalArea = 0;
        for (var i = 0; i < this.boxEditor.boxes.length; ++i) {
            totalArea += this.boxEditor.boxes[i].computeArea();
        }
        
        var fractionFilled = totalArea / (GRID_WIDTH * GRID_HEIGHT);
        var desiredParticleCount = fractionFilled * gridResolutionX * gridResolutionY * PARTICLES_PER_CELL;
        
        return Math.min(desiredParticleCount, this.maxParticleCount);
    };
    
    FluidParticles2D.prototype.startSimulation = function() {
        this.state = State.SIMULATING;
        
        var particleCount = this.particleCount || this.getParticleCount();
        var particlesWidth = 512;
        var particlesHeight = Math.ceil(particleCount / particlesWidth);
        particleCount = particlesWidth * particlesHeight;
        
        // Generate particle positions from boxes
        var particlePositions = [];
        var totalArea = 0;
        for (var i = 0; i < this.boxEditor.boxes.length; ++i) {
            totalArea += this.boxEditor.boxes[i].computeArea();
        }
        
        var particlesCreatedSoFar = 0;
        for (var i = 0; i < this.boxEditor.boxes.length; ++i) {
            var box = this.boxEditor.boxes[i];
            var particlesInBox = 0;
            
            if (i < this.boxEditor.boxes.length - 1) {
                particlesInBox = Math.floor(particleCount * box.computeArea() / totalArea);
            } else {
                particlesInBox = particleCount - particlesCreatedSoFar;
            }
            
            for (var j = 0; j < particlesInBox; ++j) {
                var position = box.randomPoint();
                particlePositions.push(position);
            }
            
            particlesCreatedSoFar += particlesInBox;
        }
        
        // Calculate grid resolution
        var gridCells = GRID_WIDTH * GRID_HEIGHT * this.gridCellDensity * this.gridResolutionScale;
        var gridResolutionY = Math.ceil(Math.sqrt(gridCells / 2));
        var gridResolutionX = Math.ceil(gridResolutionY * 2);
        
        // Initialize simulator
        this.simulator.reset(
            particlesWidth,
            particlesHeight,
            particlePositions,
            GRID_WIDTH,
            GRID_HEIGHT,
            gridResolutionX,
            gridResolutionY,
            PARTICLES_PER_CELL
        );
        
        // Set particle buffers for renderer
        this.renderer.setParticleBuffers(
            this.simulator.particlePositionBuffer,
            this.simulator.particleVelocityBuffer,
            particleCount
        );
        
        var sphereRadius = 4.0 / gridResolutionX;
        this.renderer.particleRadius = sphereRadius;
    };
    
    FluidParticles2D.prototype.stopSimulation = function() {
        this.state = State.EDITING;
    };
    
    FluidParticles2D.prototype.update = function(deltaTime) {
        this.camera.update();
        
        if (this.state === State.EDITING) {
            this.boxEditor.draw();
        } else if (this.state === State.SIMULATING) {
            this.simulator.simulate(this.timeStep, null, null, null);
            this.renderer.render();
        }
    };
    
    FluidParticles2D.prototype.showError = function(message) {
        document.getElementById('placeholder').innerHTML = 
            '<div style="color: white; padding: 20px; text-align: center;">' + message + '</div>';
    };
    
    return FluidParticles2D;
}());
