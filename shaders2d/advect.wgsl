// Advect particles using semi-Lagrangian advection
struct Uniforms {
    gridWidth: f32,
    gridHeight: f32,
    gridResX: f32,
    gridResY: f32,
    deltaTime: f32,
    particleCount: u32,
    padding: vec2<f32>,
};

struct Particle {
    position: vec4<f32>,
};

struct Velocity {
    velocity: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> positionsIn: array<Particle>;
@group(0) @binding(2) var<storage, read> velocitiesIn: array<Velocity>;
@group(0) @binding(3) var<storage, read_write> positionsOut: array<Particle>;
@group(0) @binding(4) var<storage, read_write> velocitiesOut: array<Velocity>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= uniforms.particleCount) {
        return;
    }
    
    let pos = positionsIn[index].position.xy;
    let vel = velocitiesIn[index].velocity.xy;
    
    // Semi-Lagrangian advection
    var newPos = pos + vel * uniforms.deltaTime;
    
    // Boundary conditions - reflect at walls
    if (newPos.x < 0.0) {
        newPos.x = 0.0;
    }
    if (newPos.x > uniforms.gridWidth) {
        newPos.x = uniforms.gridWidth;
    }
    if (newPos.y < 0.0) {
        newPos.y = 0.0;
    }
    if (newPos.y > uniforms.gridHeight) {
        newPos.y = uniforms.gridHeight;
    }
    
    positionsOut[index].position = vec4<f32>(newPos, 0.0, 1.0);
    velocitiesOut[index].velocity = vec4<f32>(vel, 0.0, 0.0);
}
