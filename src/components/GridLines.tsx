import { Grid } from '@react-three/drei';

export default function GridLines({ size = 60, spacing = 1 }) {
  return (
    <Grid
      position={[0, 0, -0.05]}
      args={[size, size]}
      cellSize={spacing}
      sectionSize={spacing * 5}
      infiniteGrid={false}
      fadeDistance={800}
      fadeStrength={1}
      cellColor="#333333"
      sectionColor="#555555"
      cellThickness={0.8}
      sectionThickness={1.5}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}
