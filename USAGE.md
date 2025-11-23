# 2D Fluid Simulation - Usage Guide

## Quick Start

1. **Open the simulation**: Navigate to `index.html` in a WebGPU-compatible browser
2. **Enable WebGPU** (if needed):
   - **Chrome/Edge**: Open `chrome://flags/#enable-unsafe-webgpu` and enable the flag
   - **Firefox**: Open `about:config` and set `dom.webgpu.enabled` to `true`
   - **Safari**: Use Safari Technology Preview

3. **Edit Mode** (default on load):
   - Click and drag to create rectangular fluid regions
   - Drag existing boxes to move them
   - Press `Delete` or `Backspace` to remove a box
   - Use preset button to load example configurations
   - Adjust particle density slider to change simulation quality
   - Adjust particle count slider (10,000 - 300,000)

4. **Start Simulation**:
   - Click the "Start" button once you have at least one box
   - Watch the particles fall and interact!

5. **Simulation Controls**:
   - **Drag**: Pan the camera
   - **Scroll**: Zoom in/out
   - **Toggle Mode**: Switch between circle and metaball rendering
   - **Fluidity Slider**: Adjust fluid behavior (0.5 = more viscous, 0.99 = more fluid)
   - **Speed Slider**: Control simulation speed
   - **Grid Resolution**: Adjust quality vs performance

## Rendering Modes

### Circle Mode (Default)
- Fast and efficient
- Each particle rendered as a solid circle
- Color indicates speed (blue = slow, red = fast)
- Best for performance, especially on mobile
- Recommended for 160,000+ particles

### Metaball Mode
- Liquid-style rendering
- Particles blend smoothly together
- Creates a continuous fluid surface
- More computationally intensive
- Best with fewer particles (<100,000) or powerful GPU

## Performance Tips

### For Desktop (PC)
- **High Quality**: 300,000 particles, grid resolution 2.0, circle mode
- **Balanced**: 160,000 particles, grid resolution 1.0, circle mode
- **Cinematic**: 100,000 particles, metaball mode

### For Samsung S24 ULTRA and Similar Flagships
- **High Quality**: 200,000 particles, grid resolution 1.5, circle mode
- **Balanced**: 160,000 particles, grid resolution 1.0, circle mode
- **Smooth**: 100,000 particles, grid resolution 0.8, metaball mode

### For Older Mobile Devices
- **Performance**: 50,000 particles, grid resolution 0.5, circle mode
- Reduce particle count if frame rate drops below 30 FPS

## Troubleshooting

### "WebGPU not supported" Error
- Update your browser to the latest version
- Enable WebGPU flags (see Quick Start step 2)
- Try a different browser (Chrome 113+ recommended)

### Low Frame Rate
- Reduce particle count
- Lower grid resolution
- Use circle mode instead of metaball mode
- Close other browser tabs and applications

### Particles Moving Too Fast/Slow
- Adjust the Speed slider in simulation mode
- Increase fluidity for more realistic motion
- Time step affects simulation stability (lower = more stable)

## Advanced Usage

### Editing Particle Count
The particle count slider allows you to set exactly how many particles you want:
- **Default**: 160,000 (good balance for most systems)
- **Minimum**: 10,000 (very fast, less detailed)
- **Maximum**: 300,000 (high detail, requires powerful GPU)

### Grid Resolution
Higher grid resolution = more accurate simulation but lower performance:
- **0.5**: Fast, coarse simulation
- **1.0**: Balanced (default)
- **2.0**: High quality, slower

### Custom Scenarios
1. Enter Edit mode
2. Delete all preset boxes
3. Create your own fluid regions
4. Experiment with different shapes and placements
5. Click Start to simulate

## Technical Details

### System Architecture
- **Compute Shaders**: Particle physics on GPU
- **Render Pipelines**: Two modes (circles/metaballs)
- **Buffer Management**: Double-buffering for smooth updates
- **2D Grid**: X-axis (length), Y-axis (height)

### Physics Simulation
- Gravity: 9.8 m/s² downward
- Wall collision: Bouncing with energy loss
- Damping: 0.999 per frame
- Semi-Lagrangian advection

### Recommended Specifications
**Minimum:**
- WebGPU-capable browser
- Integrated GPU (Intel UHD 620 or equivalent)
- 4GB RAM

**Recommended:**
- Chrome 113+ or equivalent
- Dedicated GPU (GTX 1060 or equivalent)
- 8GB RAM

**Optimal (Samsung S24 ULTRA):**
- Native Chrome browser
- Snapdragon 8 Gen 3 GPU
- 12GB RAM
- 120Hz display for smooth 60 FPS

## Known Limitations

- No fluid-fluid interactions (simplified collision model)
- Wall boundaries are axis-aligned only
- No mouse-based particle interaction (planned)
- WebGPU not supported in all browsers yet

## Future Enhancements

- Full PIC/FLIP fluid solver
- Mouse interaction (push/pull particles)
- Pressure-based incompressibility
- Multiple fluid types with different densities
- Export/import custom scenarios
- Recording and playback

---

For issues or questions, please visit the [GitHub repository](https://github.com/azzamunza/fluid2D-dynamics).
