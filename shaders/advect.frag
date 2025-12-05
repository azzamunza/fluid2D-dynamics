//advects particle positions with second order runge kutta

varying vec2 v_coordinates;

uniform sampler2D u_positionsTexture;
uniform sampler2D u_randomsTexture;

uniform sampler2D u_velocityGrid;

uniform vec3 u_gridResolution;
uniform vec3 u_gridSize;

uniform float u_timeStep;

uniform float u_frameNumber;

uniform vec2 u_particlesResolution;

float sampleXVelocity (vec3 position) {
    vec3 cellIndex = vec3(position.x, position.y - 0.5, position.z - 0.5);
    return texture3D(u_velocityGrid, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).x;
}

float sampleYVelocity (vec3 position) {
    vec3 cellIndex = vec3(position.x - 0.5, position.y, position.z - 0.5);
    return texture3D(u_velocityGrid, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).y;
}

float sampleZVelocity (vec3 position) {
    vec3 cellIndex = vec3(position.x - 0.5, position.y - 0.5, position.z);
    return texture3D(u_velocityGrid, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).z;
}

vec3 sampleVelocity (vec3 position) {
    vec3 gridPosition = (position / u_gridSize) * u_gridResolution;
    return vec3(sampleXVelocity(gridPosition), sampleYVelocity(gridPosition), sampleZVelocity(gridPosition));
}

// Constants for surface tension calculation
const float MIN_PARTICLE_DISTANCE = 0.01; // Minimum distance to avoid division issues
const float SURFACE_TENSION_SCALE = 0.01; // Scale factor for surface tension effect

// Sample fluid type and position from nearby particle texture coordinates
vec4 sampleNearbyParticle(vec2 offset) {
    vec2 sampleCoord = v_coordinates + offset / u_particlesResolution;
    if (sampleCoord.x < 0.0 || sampleCoord.x >= 1.0 || sampleCoord.y < 0.0 || sampleCoord.y >= 1.0) {
        return vec4(-1.0); // Invalid sample
    }
    return texture2D(u_positionsTexture, sampleCoord);
}

// Compute surface tension force based on nearby particles of different fluid type
vec3 computeSurfaceTension(vec3 position, float fluidType) {
    vec3 surfaceTensionForce = vec3(0.0);
    float surfaceTensionStrength = 15.0; // Surface tension coefficient
    float interactionRadius = 2.0; // Radius for particle interaction
    
    // Sample nearby particles in a grid pattern
    for (float dx = -2.0; dx <= 2.0; dx += 1.0) {
        for (float dy = -2.0; dy <= 2.0; dy += 1.0) {
            if (dx == 0.0 && dy == 0.0) continue;
            
            vec4 neighborData = sampleNearbyParticle(vec2(dx, dy));
            if (neighborData.x < 0.0) continue; // Invalid sample
            
            vec3 neighborPos = neighborData.rgb;
            float neighborType = neighborData.a;
            
            // Only apply surface tension between different fluid types
            if (abs(neighborType - fluidType) > 0.5) {
                vec3 toNeighbor = neighborPos - position;
                float dist = length(toNeighbor);
                
                if (dist > MIN_PARTICLE_DISTANCE && dist < interactionRadius) {
                    // Repulsive force at interface between different fluids
                    vec3 direction = toNeighbor / dist;
                    // Force decreases with distance, creates surface tension effect
                    float forceMagnitude = surfaceTensionStrength * (1.0 - dist / interactionRadius);
                    surfaceTensionForce -= direction * forceMagnitude;
                }
            }
        }
    }
    
    return surfaceTensionForce;
}

void main () {
    vec4 positionData = texture2D(u_positionsTexture, v_coordinates);
    vec3 position = positionData.rgb;
    float fluidType = positionData.a; // Preserve fluid type (0 = blue, 1 = white)
    
    vec3 randomDirection = texture2D(u_randomsTexture, fract(v_coordinates + u_frameNumber / u_particlesResolution)).rgb;

    vec3 velocity = sampleVelocity(position);

    vec3 halfwayPosition = position + velocity * u_timeStep * 0.5;
    vec3 halfwayVelocity = sampleVelocity(halfwayPosition);

    vec3 step = halfwayVelocity * u_timeStep;

    step += 0.05 * randomDirection * length(velocity) * u_timeStep;
    
    // Apply differential buoyancy: white liquid (type 1) is twice as buoyant as blue (type 0)
    // This is implemented as an upward force that counteracts gravity more for white fluid
    // Base gravity is -40 (from addforce.frag), so we add buoyancy compensation
    // Blue (type 0): no extra buoyancy
    // White (type 1): extra upward force to make it 2x more buoyant (counteract half the gravity)
    float buoyancyFactor = fluidType * 20.0; // White gets +20 upward (counteracts half of -40 gravity)
    step.y += buoyancyFactor * u_timeStep;
    
    // Apply surface tension between the two liquid types
    vec3 surfaceTension = computeSurfaceTension(position, fluidType);
    step += surfaceTension * u_timeStep * SURFACE_TENSION_SCALE;

    //step = clamp(step, -vec3(1.0), vec3(1.0)); //enforce CFL condition

    vec3 newPosition = position + step;

    newPosition = clamp(newPosition, vec3(0.01), u_gridSize - 0.01);

    gl_FragColor = vec4(newPosition, fluidType);
}
