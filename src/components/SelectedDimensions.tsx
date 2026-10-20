import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera } from "three";
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
/** Runs after the fixed camera layout effect; emits only display data to the DOM overlay. */
export function SelectedDimensions({ cube, state, slot, view, onDrawing }: {
  cube: SolvedCube; state: PuzzleState; slot: PieceId | undefined; view: PieceId | undefined;
  onDrawing: ((drawing: SelectedDrawing | null) => void) | undefined;
}) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!onDrawing) return;
    const corner = slot ? state.corners.find(c => equalVector(c.slot, homeSlot(slot))) : null;
    const piece = cube.pieces.find(p => p.id === corner?.pieceId);
    if (!slot || !view || !corner || !piece || !(camera instanceof OrthographicCamera) || size.width < 100 || size.height < 90) { onDrawing(null); return; }
    onDrawing({ state, slot, view, drawing: projectDimensions(camera, size.width, size.height,
      placementDimensions(piece, slot, cornerTwist(corner)), slot,
      { reserved: faceLabelReservations(camera, size.width, size.height, getPuzzleRadius(cube)), avoidPiece: true }) });
  }, [camera, size.width, size.height, cube, state, slot, view, onDrawing]);
  return null;
}
