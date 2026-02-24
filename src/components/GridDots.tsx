import { useMemo } from 'react';
import * as THREE from 'three';

export default function GridDots({ size = 180, spacing = 1 }) {
  const points = useMemo(() => {
    const pts = [];
    const half = size / 2;
    for (let x = -half; x <= half; x += spacing) {
      for (let y = -half; y <= half; y += spacing) {
        pts.push(x, y, -0.5);
      }
    }
    return new Float32Array(pts);
  }, [size, spacing]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length / 3}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#444"
        sizeAttenuation={true}
        transparent
        opacity={0.5}
      />
    </points>
  );
}
