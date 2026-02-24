import { useEffect, useState } from 'react';
import { addEffect } from '@react-three/fiber';

export default function FPSCounter() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const unsubscribe = addEffect(() => {
      const time = performance.now();
      frameCount++;
      if (time - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="absolute top-4 right-4 text-white/50 font-mono text-xs tracking-widest pointer-events-none select-none">
      {fps} FPS
    </div>
  );
}
