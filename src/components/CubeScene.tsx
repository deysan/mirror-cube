import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { BoxGeometry, EdgesGeometry, OrthographicCamera } from "three";
import type { Piece, SolvedCube } from "../puzzle/model";
import type { Orientation, PuzzleState } from "../puzzle/state";
import { createPieceMatrix } from "../rendering/pieceTransform";

interface CubeSceneProps {
  readonly cube: SolvedCube;
  readonly state: PuzzleState;
}

function PieceMesh({ piece, orientation }: { piece: Piece; orientation: Orientation }) {
  const { x, y, z } = piece.dimensions;
  const geometry = useMemo(() => new BoxGeometry(x, y, z), [x, y, z]);
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  const matrix = useMemo(() => createPieceMatrix(piece, orientation), [piece, orientation]);

  // These resources are created outside R3F's declarative geometry elements.
  useEffect(() => () => {
    geometry.dispose();
    edges.dispose();
  }, [geometry, edges]);

  return (
    <group name={`piece:${piece.id}`} matrix={matrix} matrixAutoUpdate={false}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#ced9e1"
          roughness={0.65}
          metalness={0.15}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#263541" />
      </lineSegments>
    </group>
  );
}

/** Fit the solved cube without moving the puzzle's origin away from its pivot. */
function FixedCamera({ cube }: { cube: SolvedCube }) {
  const { camera, size, invalidate } = useThree();
  const { edgeLength, splits } = cube;

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;

    const center = {
      x: edgeLength / 2 - splits.x,
      y: edgeLength / 2 - splits.y,
      z: edgeLength / 2 - splits.z,
    };
    const distance = edgeLength * 3;
    camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    camera.lookAt(center.x, center.y, center.z);
    // Isometric projected width and height, plus 20% breathing room.
    camera.zoom = Math.min(
      size.width / (edgeLength * Math.SQRT2 * 1.2),
      size.height / (edgeLength * Math.sqrt(8 / 3) * 1.2),
    );
    camera.near = edgeLength * 0.01;
    camera.far = edgeLength * 20;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, edgeLength, splits, invalidate]);

  return null;
}

export function CubeScene({ cube, state }: CubeSceneProps) {
  return (
    <Canvas orthographic frameloop="demand" dpr={[1, 2]}>
      <FixedCamera cube={cube} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[cube.edgeLength, cube.edgeLength * 3, cube.edgeLength * 2]} intensity={2} />
      {state.corners.map((corner) => {
        const piece = cube.pieces.find(({ id }) => id === corner.pieceId);
        if (!piece) throw new Error(`Missing piece definition: ${corner.pieceId}`);
        return <PieceMesh key={piece.id} piece={piece} orientation={corner.orientation} />;
      })}
    </Canvas>
  );
}
