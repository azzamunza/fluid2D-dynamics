precision highp float;

varying vec3 v_viewSpacePosition;
varying vec3 v_viewSpaceNormal;
varying float v_speed;
varying float v_fluidType;

void main () {
    // Pack speed and fluid type together: speed in B, fluid type encoded in sign of speed
    // Use a trick: store fluidType as an offset to speed to differentiate fluid types
    // Since speed is always positive, we encode: speed + (fluidType * 1000.0)
    float encodedSpeed = v_speed + (v_fluidType * 1000.0);
    gl_FragColor = vec4(v_viewSpaceNormal.x, v_viewSpaceNormal.y, encodedSpeed, v_viewSpacePosition.z);
}
