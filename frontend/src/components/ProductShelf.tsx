import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { Product } from '../api';
import { SnackMesh } from './SnackMesh';

type Props = {
  products: Product[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
};

const PALETTE = ['#ff8a5c', '#ffcc4d', '#7ee08a', '#7bb4ff', '#d68fff', '#ffffff'];

/**
 * The "creative" part. One row of colored blocks, one per product, in stock
 * order. Clicking a block toggles it in the cart. If you delete this file,
 * delete the <ProductShelf /> usage in App.tsx and everything else still works.
 */
export function ProductShelf({ products, selectedIds, onSelect }: Props) {
  const spacing = 1.4;
  const width = Math.max(products.length, 1) * spacing;

  return (
    <div className="h-56 w-full rounded-xl border border-snack-edge bg-snack-panel">
      <Canvas camera={{ position: [0, 2.2, width * 0.9], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 6, 4]} intensity={1.1} />
        {products.map((p, i) => {
          const x = (i - (products.length - 1) / 2) * spacing;
          const soldOut = p.availableUnits === 0;
          return (
            <SnackMesh
              key={p.id}
              position={[x, 0.5, 0]}
              color={soldOut ? '#3a3f45' : PALETTE[i % PALETTE.length]}
              selected={selectedIds.has(p.id)}
              onClick={() => {
                if (!soldOut) onSelect(p.id);
              }}
            />
          );
        })}
        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[width + 6, 6]} />
          <meshStandardMaterial color="#0e1216" />
        </mesh>
        <OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>
    </div>
  );
}