import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

type Props = {
  color: string;
  position: [number, number, number];
  selected: boolean;
  onClick: () => void;
};

/** A little candy-colored cube that idles gently. Cheap, no texture loads. */
export function SnackMesh({ color, position, selected, onClick }: Props) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * 10); // desync idle phases

  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t.current * 2) * 0.05;
      ref.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <boxGeometry args={[0.9, 0.9, 0.9]} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? '#ffcc4d' : '#000000'}
        emissiveIntensity={selected ? 0.6 : 0}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
}