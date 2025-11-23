#### 2D Fluid Particles (WebGPU)

Real-time particle-based **2D** fluid simulation and rendering using **WebGPU**.

This is a 2D adaptation of the original 3D fluid simulation, optimized for modern devices including Samsung S24 ULTRA.

## Features

- **WebGPU-powered**: Uses the latest WebGPU API for maximum performance on modern browsers and mobile devices
- **2D Simulation**: Simplified 2D grid (X = length, Y = height) with PIC/FLIP fluid simulation
- **Dual Rendering Modes**:
  - **Circle Mode**: Fast, simple solid circle rendering for each particle
  - **Metaball Mode**: Liquid-style rendering with smooth metaball blending
- **Interactive Controls**:
  - Particle count slider (default: 160,000 particles, max: 300,000)
  - Performance optimization sliders (grid resolution, simulation speed)
  - Easy preset scenes
  - 2D camera with pan and zoom
- **Optimized for Mobile**: Designed for high performance on flagship devices like Samsung S24 ULTRA

## Browser Support

Requires WebGPU support:
- Chrome/Edge 113+ (may need to enable `chrome://flags/#enable-unsafe-webgpu`)
- Firefox Nightly (enable `dom.webgpu.enabled` in `about:config`)
- Safari Technology Preview

## Original 3D Version

The original 3D WebGL version can be found in `index3d.html`.

[Original by david.li](http://david.li/fluid) ([video](http://www.youtube.com/watch?v=DhNt_A3k4B4))

Fluid simulation is a GPU implementation of the PIC/FLIP method (with various additions).
