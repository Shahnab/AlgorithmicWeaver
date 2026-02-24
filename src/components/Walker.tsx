import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MOVES = [
  { dx: 1, dy: 2 }, { dx: 1, dy: -2 },
  { dx: -1, dy: 2 }, { dx: -1, dy: -2 },
  { dx: 2, dy: 1 }, { dx: 2, dy: -1 },
  { dx: -2, dy: 1 }, { dx: -2, dy: -1 }
];

const SPEED = 400; // Much faster speed for larger grid
const MAX_INSTANCES = 150000; // Increased max instances for larger grid

export const GRID_HALF_SIZE = 90; // 181x181 grid for high detail
export const TOTAL_SQUARES = (GRID_HALF_SIZE * 2 + 1) ** 2;

export default function Walker({ onProgress, imageData }: { onProgress?: (current: number, total: number) => void, imageData?: Uint8ClampedArray | null }) {
  const headPos = useRef(new THREE.Vector3(0, 0, 0));
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const lastFixedPos = useRef(new THREE.Vector3(0, 0, 0));
  
  const isMoving = useRef(false);
  const isFinished = useRef(false);
  const [finished, setFinished] = useState(false);
  const moveStage = useRef<'idle' | 'elbow' | 'end'>('idle');
  
  const gridPos = useRef({ x: 0, y: 0 });
  const finalEndRef = useRef(new THREE.Vector3());
  const visited = useRef(new Set<string>(["0,0"]));

  // InstancedMesh refs
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const historyCount = useRef(0);
  
  // Active segment refs
  const activeSegmentRef = useRef<THREE.Mesh>(null);
  const activeSegmentMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Head refs
  const headMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const headLightRef = useRef<THREE.PointLight>(null);

  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 1, 6), []);

  useEffect(() => {
    if (instancedMeshRef.current) {
      const colors = new Float32Array(MAX_INSTANCES * 3);
      instancedMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      instancedMeshRef.current.count = 0;
    }
  }, []);

  const getValidMoves = (x: number, y: number, visitedSet: Set<string>) => {
    return MOVES.filter(m => {
      const nx = x + m.dx;
      const ny = y + m.dy;
      const inBounds = Math.abs(nx) <= GRID_HALF_SIZE && Math.abs(ny) <= GRID_HALF_SIZE;
      if (!inBounds) return false;
      return !visitedSet.has(`${nx},${ny}`);
    });
  };

  const getAllNeighbors = (x: number, y: number) => {
    return MOVES.filter(m => {
      const nx = x + m.dx;
      const ny = y + m.dy;
      return Math.abs(nx) <= GRID_HALF_SIZE && Math.abs(ny) <= GRID_HALF_SIZE;
    });
  };

  const addSegmentToHistory = (start: THREE.Vector3, end: THREE.Vector3) => {
    if (!instancedMeshRef.current) return;
    if (historyCount.current >= MAX_INSTANCES) return;

    const distance = start.distanceTo(end);
    if (distance < 0.001) return;

    const midpoint = start.clone().lerp(end, 0.5);
    const dir = end.clone().sub(start).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const scale = new THREE.Vector3(1, distance, 1);
    
    const matrix = new THREE.Matrix4().compose(midpoint, quaternion, scale);
    
    const idx = historyCount.current;
    instancedMeshRef.current.setMatrixAt(idx, matrix);
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    
    historyCount.current++;
    instancedMeshRef.current.count = historyCount.current;
  };

  const plannedPath = useRef<{dx: number, dy: number}[]>([]);

  const findPathToUnvisited = (startX: number, startY: number, visitedSet: Set<string>) => {
    const gridSize = GRID_HALF_SIZE * 2 + 1;
    const totalCells = gridSize * gridSize;
    
    const queue = new Int32Array(totalCells);
    const parentIdx = new Int32Array(totalCells).fill(-1);
    const parentMove = new Int8Array(totalCells).fill(-1);
    const bfsVisited = new Uint8Array(totalCells);
    
    const toIndex = (x: number, y: number) => (y + GRID_HALF_SIZE) * gridSize + (x + GRID_HALF_SIZE);
    
    const startIdx = toIndex(startX, startY);
    queue[0] = startIdx;
    bfsVisited[startIdx] = 1;
    
    let head = 0;
    let tail = 1;
    
    let targetIdx = -1;
    let targetParentIdx = -1;
    let targetMoveIdx = -1;

    while(head < tail) {
      const currIdx = queue[head++];
      const cx = (currIdx % gridSize) - GRID_HALF_SIZE;
      const cy = Math.floor(currIdx / gridSize) - GRID_HALF_SIZE;
      
      for (let i = 0; i < MOVES.length; i++) {
        const move = MOVES[i];
        const nx = cx + move.dx;
        const ny = cy + move.dy;
        
        if (Math.abs(nx) <= GRID_HALF_SIZE && Math.abs(ny) <= GRID_HALF_SIZE) {
          const nIdx = toIndex(nx, ny);
          if (bfsVisited[nIdx] === 0) {
            if (!visitedSet.has(`${nx},${ny}`)) {
              targetIdx = nIdx;
              targetParentIdx = currIdx;
              targetMoveIdx = i;
              break;
            }
            bfsVisited[nIdx] = 1;
            parentIdx[nIdx] = currIdx;
            parentMove[nIdx] = i;
            queue[tail++] = nIdx;
          }
        }
      }
      if (targetIdx !== -1) break;
    }

    if (targetIdx === -1) return [];

    const path: {dx: number, dy: number}[] = [MOVES[targetMoveIdx]];
    let curr = targetParentIdx;
    
    while (curr !== startIdx) {
      const pMoveIdx = parentMove[curr];
      if (pMoveIdx === -1) break;
      path.push(MOVES[pMoveIdx]);
      curr = parentIdx[curr];
    }
    
    return path.reverse();
  };

  useFrame((state, delta) => {
    // --- LOGIC UPDATE ---
    if (!isFinished.current) {
      if (!isMoving.current) {
        if (visited.current.size >= TOTAL_SQUARES) {
          console.log("Tour complete!");
          isFinished.current = true;
          setFinished(true);
        } else {
          const currentX = gridPos.current.x;
          const currentY = gridPos.current.y;
          
          let selectedMove;

          if (plannedPath.current.length > 0) {
            selectedMove = plannedPath.current.shift()!;
          } else {
            const unvisitedMoves = getValidMoves(currentX, currentY, visited.current);

            if (unvisitedMoves.length > 0) {
              const movesWithDegree = unvisitedMoves.map(move => {
                const nx = currentX + move.dx;
                const ny = currentY + move.dy;
                const degree = getValidMoves(nx, ny, visited.current).length;
                return { move, degree };
              });

              movesWithDegree.sort((a, b) => a.degree - b.degree);
              const minDegree = movesWithDegree[0].degree;
              const bestMoves = movesWithDegree.filter(m => m.degree === minDegree);
              selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
            } else {
              const path = findPathToUnvisited(currentX, currentY, visited.current);
              if (path.length > 0) {
                selectedMove = path.shift()!;
                plannedPath.current = path;
              } else {
                const allNeighbors = getAllNeighbors(currentX, currentY);
                selectedMove = allNeighbors[Math.floor(Math.random() * allNeighbors.length)];
              }
            }
          }
          
          const nextX = currentX + selectedMove.dx;
          const nextY = currentY + selectedMove.dy;
          visited.current.add(`${nextX},${nextY}`);
          
          if (onProgress) {
            onProgress(visited.current.size, TOTAL_SQUARES);
          }
          
          let elbowDx = 0;
          let elbowDy = 0;
          
          if (Math.abs(selectedMove.dx) < Math.abs(selectedMove.dy)) {
            elbowDy = Math.sign(selectedMove.dy);
          } else {
            elbowDx = Math.sign(selectedMove.dx);
          }
          
          const elbow = new THREE.Vector3(currentX + elbowDx, currentY + elbowDy, 0);
          const end = new THREE.Vector3(currentX + selectedMove.dx, currentY + selectedMove.dy, 0);
          
          targetPos.current.copy(elbow);
          finalEndRef.current.copy(end);
          
          moveStage.current = 'elbow';
          isMoving.current = true;
        }
      } else {
        const step = SPEED * delta;
        const dist = headPos.current.distanceTo(targetPos.current);
        
        if (dist <= step) {
          headPos.current.copy(targetPos.current);
          
          addSegmentToHistory(lastFixedPos.current, headPos.current);
          lastFixedPos.current.copy(headPos.current);
          
          if (moveStage.current === 'elbow') {
            targetPos.current.copy(finalEndRef.current);
            moveStage.current = 'end';
          } else if (moveStage.current === 'end') {
            isMoving.current = false;
            moveStage.current = 'idle';
            gridPos.current.x = targetPos.current.x;
            gridPos.current.y = targetPos.current.y;
          }
        } else {
          const dir = new THREE.Vector3().subVectors(targetPos.current, headPos.current).normalize();
          headPos.current.add(dir.multiplyScalar(step));
        }
      }
    }

    // --- RENDER UPDATE ---
    
    // 1. Update Active Segment
    if (activeSegmentRef.current && !finished) {
      const start = lastFixedPos.current;
      const end = headPos.current;
      const distance = start.distanceTo(end);
      
      if (distance > 0.001) {
        activeSegmentRef.current.visible = true;
        const midpoint = start.clone().lerp(end, 0.5);
        const dir = end.clone().sub(start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        
        activeSegmentRef.current.position.copy(midpoint);
        activeSegmentRef.current.quaternion.copy(quaternion);
        activeSegmentRef.current.scale.set(1, distance, 1);
      } else {
        activeSegmentRef.current.visible = false;
      }
    }

    if (activeSegmentMaterialRef.current && !finished) {
       // Always keep the active segment bright orange
       activeSegmentMaterialRef.current.color.setRGB(10.0, 2.5, 0.2);
    }

    // 2. Update History Colors
    if (instancedMeshRef.current && instancedMeshRef.current.instanceColor) {
      const count = historyCount.current;
      const c = new THREE.Color();
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();

      for (let i = 0; i < count; i++) {
        const freshness = i / Math.max(count, 1);
        
        let targetR = 0.5, targetG = 0.5, targetB = 0.5;
        let isImageColor = false;

        if (imageData) {
          instancedMeshRef.current.getMatrixAt(i, matrix);
          pos.setFromMatrixPosition(matrix);
          
          const imgX = Math.round(pos.x + GRID_HALF_SIZE);
          const imgY = Math.round(GRID_HALF_SIZE - pos.y);
          const gridSize = GRID_HALF_SIZE * 2 + 1;
          if (imgX >= 0 && imgX < gridSize && imgY >= 0 && imgY < gridSize) {
            const idx = (imgY * gridSize + imgX) * 4;
            const r = imageData[idx] / 255;
            const g = imageData[idx + 1] / 255;
            const b = imageData[idx + 2] / 255;
            targetR = r;
            targetG = g;
            targetB = b;
            isImageColor = true;
          }
        }

        if (finished) {
           if (isImageColor) {
             c.setRGB(targetR, targetG, targetB);
             c.multiplyScalar(3.0); // Boost true color
           } else {
             c.setRGB(1.2, 1.2, 1.2); // White for finished state so everything looks the same color
           }
        } else {
          if (freshness > 0.995) {
             // Always hot orange tip
             c.setRGB(10.0, 2.5, 0.2);
          } else if (freshness > 0.98) {
             if (isImageColor) {
               // Fade from orange to image color very quickly
               const factor = (freshness - 0.98) / 0.015; // 0 at 0.98, 1 at 0.995
               c.setRGB(
                 THREE.MathUtils.lerp(targetR * 4.0, 10.0, factor),
                 THREE.MathUtils.lerp(targetG * 4.0, 2.5, factor),
                 THREE.MathUtils.lerp(targetB * 4.0, 0.2, factor)
               );
             } else {
               c.setRGB(6.0, 1.5, 0.1);
             }
          } else {
             if (isImageColor) {
               c.setRGB(targetR, targetG, targetB);
               c.multiplyScalar(4.0); // Strong boost for true color
             } else {
               // Deep orange trail that stays orange even with bloom
               const intensity = 0.5 + 0.5 * freshness;
               c.setRGB(4.0 * intensity, 0.8 * intensity, 0.0);
             }
          }
        }
        
        instancedMeshRef.current.setColorAt(i, c);
      }
      instancedMeshRef.current.instanceColor.needsUpdate = true;
    }

    // 3. Update Head Color
    if (headMaterialRef.current && headLightRef.current) {
      if (finished) {
        headMaterialRef.current.color.setRGB(2, 2, 2);
        headLightRef.current.color.setRGB(1, 1, 1);
      } else {
        headMaterialRef.current.color.setRGB(10.0, 2.5, 0.2);
        headLightRef.current.color.setHex(0xff5500);
        headLightRef.current.intensity = 50;
      }
    }
  });

  return (
    <>
      {/* 3D History Path */}
      <instancedMesh ref={instancedMeshRef} args={[null as any, null as any, MAX_INSTANCES]}>
        <primitive object={cylinderGeo} attach="geometry" />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      
      {/* Active Segment */}
      {!finished && (
        <mesh ref={activeSegmentRef}>
          <primitive object={cylinderGeo} attach="geometry" />
          <meshBasicMaterial ref={activeSegmentMaterialRef} color={[10.0, 2.5, 0.2]} toneMapped={false} />
        </mesh>
      )}
      
      {/* Glowing Head */}
      <mesh position={headPos.current}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial ref={headMaterialRef} color={finished ? [2, 2, 2] : [10.0, 2.5, 0.2]} toneMapped={false} />
        <pointLight ref={headLightRef} intensity={50} distance={40} color={finished ? "white" : "#ff5500"} decay={1.5} />
      </mesh>
    </>
  );
}
