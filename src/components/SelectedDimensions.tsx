import { useCallback, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, OrthographicCamera } from "three";
import { getPuzzleRadius } from "../rendering/pieceTransform";
import { cornerTwist, homeSlot } from "../puzzle/corners";
import { placementDimensions } from "../puzzle/draft";
import type { PieceId, SolvedCube } from "../puzzle/model";
import { equalVector } from "../puzzle/orientation";
import type { PuzzleState } from "../puzzle/state";
import { faceLabelReservations, projectDimensions, type DimensionDrawing } from "../rendering/dimensions";

export interface SelectedDrawing {
  readonly state: PuzzleState; readonly slot: PieceId; readonly view: PieceId; readonly drawing: DimensionDrawing;
}
/** Reproject after layout or a changed camera frame, never on idle/unchanged frames. */
export function SelectedDimensions({ cube, state, slot, view, onDrawing }: {
  cube: SolvedCube; state: PuzzleState; slot: PieceId | undefined; view: PieceId | undefined;
  onDrawing: ((drawing: SelectedDrawing | null) => void) | undefined;
}) {
  const { camera, size } = useThree();
  const last = useRef<{ world: Matrix4; projection: Matrix4 } | null>(null);
  const update = useCallback(() => {
    if (!onDrawing) return;
    camera.updateMatrixWorld();
    last.current = { world: camera.matrixWorld.clone(), projection: camera.projectionMatrix.clone() };
    const corner = slot ? state.corners.find(c => equalVector(c.slot, homeSlot(slot))) : null;
    const piece = cube.pieces.find(p => p.id === corner?.pieceId);
    if (!slot || !view || !corner || !piece || !(camera instanceof OrthographicCamera) || size.width < 100 || size.height < 90) { onDrawing(null); return; }
    onDrawing({ state, slot, view, drawing: projectDimensions(camera, size.width, size.height,
      placementDimensions(piece, slot, cornerTwist(corner)), slot,
      { reserved: faceLabelReservations(camera, size.width, size.height, getPuzzleRadius(cube)), avoidPiece: true }) });
  }, [camera, size.width, size.height, cube, state, slot, view, onDrawing]);
  useLayoutEffect(update, [update]);
  useFrame(() => {
    if (!slot || !view || !onDrawing) return;
    camera.updateMatrixWorld();
    if (!last.current?.world.equals(camera.matrixWorld) || !last.current.projection.equals(camera.projectionMatrix)) update();
  });
  return null;
}
