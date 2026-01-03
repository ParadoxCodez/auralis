export const vertexShader = `
uniform float uTime;
uniform float uSize;
uniform vec3 uColor;
uniform float uGestureScale;
uniform float uGestureSpread;
uniform float uNoiseStrength;
uniform vec3 uMouse;
uniform float uBeatSignal;
uniform float uMorphFactor; // 0 to 1, transition between shapes

attribute vec3 targetPosition;
attribute vec3 currentPosition; // Used for morphing buffer
attribute float aSize;
attribute float aSeed;

varying vec3 vColor;
varying float vDistance;
varying float vAlphaBoost;
varying float vViewZ;

// Simplex noise function
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  return 10.0 * ( dot(p0, x0) + dot(p1, x1) + dot(p2, x2) + dot(p3, x3) );
}

void main() {
  // Morphing
  vec3 pos = mix(currentPosition, targetPosition, uMorphFactor);

  // Gesture Influence (Spread/Scale)
  // Expand outwards based on distance from center
  vec3 direction = normalize(pos);
  if (length(pos) < 0.001) direction = vec3(0.0, 1.0, 0.0);
  
  float dist = length(pos);
  
  // Apply gesture scale
  pos += direction * (uGestureSpread * 2.0);
  pos *= uGestureScale;

  // Audio reactive pulse
  pos *= (1.0 + uBeatSignal * 0.3);

  // Controlled float (stable per-particle phase, minimal shape distortion)
  float t = uTime * 0.65 + aSeed * 10.0;
  vec3 n;
  n.x = snoise(vec3(pos * 0.22 + t));
  n.y = snoise(vec3(pos.yzx * 0.22 + t * 1.11));
  n.z = snoise(vec3(pos.zxy * 0.22 - t * 0.97));

  // Add mostly-tangential drift, not radial (keeps silhouettes crisp)
  vec3 tangent = normalize(cross(direction, vec3(0.0, 1.0, 0.0)));
  if (length(tangent) < 0.01) tangent = vec3(1.0, 0.0, 0.0);

  float floatAmp = 0.10 * uNoiseStrength;
  pos += tangent * n.x * floatAmp;
  pos += normalize(cross(direction, tangent)) * n.y * (floatAmp * 0.7);

  // Mouse repulsion (3D, smoother falloff)
  float mDist = distance(pos, uMouse);
  float m = smoothstep(1.25, 0.0, mDist);
  if (m > 0.0) {
      vec3 repulsion = normalize(pos - uMouse);
      pos += repulsion * m * 0.85;
  }

  vAlphaBoost = 0.75 + 0.25 * (0.5 + 0.5 * n.z);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vViewZ = -mvPosition.z;

  // Size attenuation (clamped for crisp silhouettes)
  float px = uSize * aSize * (95.0 / vViewZ);
  gl_PointSize = clamp(px, 1.0, 12.0);

  vColor = uColor;
  vDistance = dist;
}
`;

export const fragmentShader = `
uniform vec3 uColor;

varying vec3 vColor;
varying float vDistance;
varying float vAlphaBoost;
varying float vViewZ;

void main() {
  // Circular particle
  float r = distance(gl_PointCoord, vec2(0.5));
  if (r > 0.5) discard;

  // Tighter core + softer halo (clearer points)
  float core = smoothstep(0.28, 0.0, r);
  float halo = smoothstep(0.50, 0.15, r);

  // Mild fades for clarity
  float radiusFade = smoothstep(7.0, 1.5, vDistance);
  float viewFade = smoothstep(24.0, 8.0, vViewZ);

  float alpha = (core * 0.82 + halo * 0.22) * radiusFade * viewFade * vAlphaBoost;
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(vColor, alpha);
}
`;