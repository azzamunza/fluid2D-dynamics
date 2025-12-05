precision highp float;

varying vec3 v_viewSpacePosition;
varying vec3 v_viewSpaceNormal;
varying float v_speed;
varying float v_fluidType;

void main () {
    // Encode speed and fluid type together for transmission through rendering pipeline
    // Format: encodedSpeed = speed + (fluidType * 1000.0)
    // This works because particle speeds are typically well under 100 in this simulation
    float encodedSpeed = v_speed + (v_fluidType * 1000.0);
    gl_FragColor = vec4(v_viewSpaceNormal.x, v_viewSpaceNormal.y, encodedSpeed, v_viewSpacePosition.z);
}
