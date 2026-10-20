import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { BoxGeometry, EdgesGeometry, Group, OrthographicCamera } from "three";
import type { PendingTurn } from "../interaction/turnSession";
import { FACE_LAYERS } from "../puzzle/moves";
import type { Piece, PieceId, SolvedCube } from "../puzzle/model";
import { homeSlot, PIECE_IDS } from "../puzzle/corners";
import { equalVector } from "../puzzle/orientation";
import { EditorMarkers } from "./EditorMarkers";
import { SelectedDimensions, type SelectedDrawing } from "./SelectedDimensions";
import type { Orientation, PuzzleState } from "../puzzle/state";
import { createPieceMatrix, getPuzzleRadius } from "../rendering/pieceTransform";
import { getTurnAngle, getTurnDuration } from "../rendering/turnAnimation";

export interface EditorSceneOptions {
  readonly selectedSlot: PieceId;
  readonly viewCorner: PieceId;
  readonly onSelect: (slot: PieceId) => void;
}

interface CubeSceneProps {
  readonly onDrawing?: ((drawing: SelectedDrawing | null) => void) | undefined;
  readonly editor?: EditorSceneOptions | undefined;
  readonly cube: SolvedCube;
  readonly state: PuzzleState;
  readonly activeTurn: PendingTurn | null;
  readonly onTurnComplete: (id: number) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

function PieceMesh({ piece, orientation, highlighted, onSelect }: {
  piece: Piece;
  orientation: Orientation;
  highlighted: boolean;
  onSelect?: (() => void) | undefined;
}) {
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
    <group name={`piece:${piece.id}`} matrix={matrix} matrixAutoUpdate={false}
      {...(onSelect ? { onClick: (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(); } } : {})}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={highlighted ? "#f5cb79" : "#ced9e1"}
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

function MovingLayer({ turn, onComplete, children }: {
  turn: PendingTurn;
  onComplete: (id: number) => void;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useFrame((_, delta) => {
    if (!group.current || completed.current) return;
    // Resume smoothly after a background tab rather than jumping over the turn.
    elapsed.current += Math.min(delta, 0.05);
    const progress = reducedMotion ? 1 : Math.min(1, elapsed.current / getTurnDuration(turn.move));
    group.current.rotation[FACE_LAYERS[turn.move.face].axis] = getTurnAngle(turn.move, progress);
    if (progress === 1) {
      completed.current = true;
      onComplete(turn.id);
    } else {
      invalidate();
    }
  });

  return <group ref={group} name="moving-layer">{children}</group>;
}

/** A fixed pivot-centered sphere fits every pose without camera jumps between turns. */
function FixedCamera({ cube, corner = "+++", editing = false }: { cube: SolvedCube; corner?: PieceId; editing?: boolean }) {
  const { camera, size, invalidate } = useThree();
  const radius = getPuzzleRadius(cube);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;

    const distance = radius * 3;
    const signs = homeSlot(corner);
    camera.position.set(distance * signs.x, distance * signs.y, distance * signs.z);
    camera.lookAt(0, 0, 0);
    camera.zoom = Math.min(size.width, size.height) / (radius * 2 * (editing ? 1.3 : 1.08));
    camera.near = radius * 0.01;
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, radius, invalidate, corner, editing]);

  return null;
}

function SceneLifecycle({ onReady, onFailure }: { onReady: () => void; onFailure: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    canvas.addEventListener("webglcontextlost", onFailure);
    onReady();
    return () => canvas.removeEventListener("webglcontextlost", onFailure);
  }, [canvas, onReady, onFailure]);
  return null;
}

export function CubeScene({ cube, state, activeTurn, onTurnComplete, onReady, onFailure, editor, onDrawing }: CubeSceneProps) {
  const moving: ReactNode[] = [];
  const stationary: ReactNode[] = [];
  const layer = activeTurn ? FACE_LAYERS[activeTurn.move.face] : null;
  for (const corner of state.corners) {
    const piece = cube.pieces.find(({ id }) => id === corner.pieceId);
    if (!piece) throw new Error(`Missing piece definition: ${corner.pieceId}`);
    const highlighted = layer !== null && corner.slot[layer.axis] === layer.side;
    const slot = PIECE_IDS.find(id => equalVector(homeSlot(id), corner.slot))!;
    const mesh = <PieceMesh key={piece.id} piece={piece} orientation={corner.orientation}
      highlighted={highlighted || editor?.selectedSlot === slot}
      onSelect={editor ? () => editor.onSelect(slot) : undefined} />;
    (highlighted ? moving : stationary).push(mesh);
  }

  return (
    <Canvas orthographic frameloop="demand" dpr={[1, 2]}>
      <SceneLifecycle onReady={onReady} onFailure={onFailure} />
      <FixedCamera cube={cube} corner={editor?.viewCorner ?? "+++"} editing={!!editor} />
      <SelectedDimensions cube={cube} state={state} slot={editor?.selectedSlot} view={editor?.viewCorner} onDrawing={onDrawing} />
      {editor && <EditorMarkers cube={cube} state={state} selected={editor.selectedSlot} onSelect={editor.onSelect} />}
      <ambientLight intensity={1.1} />
      <directionalLight position={[cube.edgeLength, cube.edgeLength * 3, cube.edgeLength * 2]} intensity={2} />
      {stationary}
      {activeTurn && (
        <MovingLayer key={activeTurn.id} turn={activeTurn} onComplete={onTurnComplete}>
          {moving}
        </MovingLayer>
      )}
    </Canvas>
  );
}
