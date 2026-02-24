import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import GridLines from './components/GridLines';
import Walker from './components/Walker';

export default function Scene({ onProgress, imageData }: { onProgress?: (current: number, total: number) => void, imageData?: Uint8ClampedArray | null }) {
  return (
    <>
      <fog attach="fog" args={['#050505', 60, 250]} />
      
      <GridLines size={180} spacing={1} />
      {imageData && <Walker onProgress={onProgress} imageData={imageData} />}
      
      {/* Simple Background Plate */}
      <mesh position={[0, 0, -2]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Main Spotlight */}
      <spotLight
        position={[0, 0, 150]}
        angle={Math.PI / 2}
        penumbra={1}
        intensity={200}
        distance={600}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#ffffff"
      />
      
      {/* Fill Light */}
      <ambientLight intensity={1.0} />
      <pointLight position={[-50, -50, 50]} intensity={50} color="#4444ff" distance={400} />
      <pointLight position={[50, 50, 50]} intensity={50} color="#ff4444" distance={400} />
    </>
  );
}
