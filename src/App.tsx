/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Suspense, useState, useCallback } from 'react';
import * as THREE from 'three';
import Scene from './Scene';
import FPSCounter from './components/FPSCounter';

export default function App() {
  const [key, setKey] = useState(0);
  const [progress, setProgress] = useState({ current: 0, total: 32761 });
  const [imageData, setImageData] = useState<Uint8ClampedArray | null>(null);

  const handleProgress = useCallback((current: number, total: number) => {
    setProgress({ current, total });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const gridSize = 181; // 90 * 2 + 1
        const canvas = document.createElement('canvas');
        canvas.width = gridSize;
        canvas.height = gridSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Fill with black first
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, gridSize, gridSize);
        
        // Draw image scaled to cover the entire grid
        const scale = Math.max(gridSize / img.width, gridSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (gridSize - w) / 2;
        const y = (gridSize - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        
        const data = ctx.getImageData(0, 0, gridSize, gridSize).data;
        setImageData(data);
        setKey(k => k + 1); // Reset the scene
        setProgress({ current: 1, total: 32761 }); // 181 * 181
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const percentage = ((progress.current / progress.total) * 100).toFixed(1);

  return (
    <div className="w-full h-screen bg-black relative">
      <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, 0, 120], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={['#050505']} />
        <Suspense fallback={null}>
          <Scene key={key} onProgress={handleProgress} imageData={imageData} />
        </Suspense>
        <OrbitControls makeDefault />
        <EffectComposer disableNormalPass={false}>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.8} height={300} intensity={2.0} />
        </EffectComposer>
      </Canvas>
      
      <div className="absolute top-4 left-4 text-white/50 font-mono text-sm pointer-events-none select-none flex flex-col gap-1">
        <h1 className="text-white font-bold text-lg tracking-tight">Algorithmic Weaver</h1>
        {imageData ? (
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/90 font-medium">
            <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} visited</span>
            <div className="w-24 h-[1px] bg-white/20 relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-white transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span>{percentage}%</span>
          </div>
        ) : (
          <div className="text-white/50 text-xs uppercase tracking-widest font-medium mt-1 animate-pulse">
            Waiting for image upload...
          </div>
        )}
      </div>

      <FPSCounter />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 font-mono text-xs tracking-widest pointer-events-none select-none">
        &lt;Shahnab&gt;
      </div>

      <div className="absolute bottom-8 right-8 flex items-center gap-4">
        <label className="cursor-pointer bg-transparent hover:bg-white/10 text-white/80 hover:text-white w-10 h-10 rounded-full backdrop-blur-xl transition-all duration-300 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.1)]" title="Upload Image">
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <span className="text-xl leading-none mb-1">+</span>
        </label>
        <button 
          onClick={() => {
            setImageData(null);
            setKey(k => k + 1);
            setProgress({ current: 0, total: 32761 });
          }}
          className="bg-transparent hover:bg-white/10 text-white/80 hover:text-white px-6 py-2 rounded-full backdrop-blur-xl transition-all duration-300 font-mono text-xs tracking-widest uppercase border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.1)]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

