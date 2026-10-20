import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, EdgesGeometry, SRGBColorSpace } from "three";
import { PIECE_IDS, homeSlot } from "../puzzle/corners";
import type { PieceId, SolvedCube } from "../puzzle/model";
import { equalVector } from "../puzzle/orientation";
import type { PuzzleState } from "../puzzle/state";
import { FACE_LAYERS, type Face } from "../puzzle/moves";
import { getPuzzleRadius } from "../rendering/pieceTransform";

/** Display-only empty-slot targets and fixed-world face labels. Never read back as state. */
export function EditorMarkers({ cube, state, selected, onSelect }: {
  cube: SolvedCube; state: PuzzleState; selected: PieceId; onSelect: (slot: PieceId) => void;
}) {
  const size = Math.min(...cube.pieces.flatMap(p => Object.values(p.dimensions)));
  const geometry = useMemo(() => new BoxGeometry(size, size, size), [size]);
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  const labels = useMemo(() => (Object.keys(FACE_LAYERS) as Face[]).map(face => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot create face labels.");
    context.fillStyle = "#263541";
    context.beginPath(); context.arc(64, 64, 58, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#bdcbd6"; context.lineWidth = 3; context.stroke();
    context.fillStyle = "#fff"; context.font = "700 80px sans-serif";
    context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(face, 64, 68);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return { face, texture };
  }), []);
  useEffect(() => () => { geometry.dispose(); edges.dispose(); }, [geometry, edges]);
  useEffect(() => () => labels.forEach(l => l.texture.dispose()), [labels]);
  const viewport = useThree(state => state.size);
  const radius = getPuzzleRadius(cube);
  const zoom = Math.max(1, Math.min(viewport.width, viewport.height)) / (radius * 2 * 1.3);
  const labelSize = Math.max(8, 20 / zoom);
  const distance = radius * 1.3;
  return <group>
    {PIECE_IDS.filter(id => !state.corners.some(c => equalVector(c.slot, homeSlot(id)))).map(id => {
      const slot = homeSlot(id), active = selected === id;
      return <group key={id} name={`empty:${id}`} position={[slot.x * size / 2, slot.y * size / 2, slot.z * size / 2]}
        onClick={event => { event.stopPropagation(); onSelect(id); }}>
        <mesh geometry={geometry}><meshBasicMaterial color={active ? "#f5cb79" : "#697e90"} transparent opacity={active ? 0.16 : 0.04} depthWrite={false} /></mesh>
        <lineSegments geometry={edges}><lineBasicMaterial color={active ? "#f5cb79" : "#697e90"} transparent opacity={active ? 1 : 0.45} /></lineSegments>
      </group>;
    })}
    {labels.map(({ face, texture }) => {
      const layer = FACE_LAYERS[face];
      const position: [number, number, number] = [0, 0, 0];
      position[{ x: 0, y: 1, z: 2 }[layer.axis]] = layer.side * distance;
      return <sprite key={face} name={`face-label:${face}`} position={position} scale={[labelSize, labelSize, 1]} renderOrder={10}>
        <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>;
    })}
  </group>;
}
