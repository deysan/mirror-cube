import { Matrix4, Vector3 } from "three";
import type { Piece } from "../puzzle/model";
import type { Orientation } from "../puzzle/state";

/** Place a center-origin box using the piece's exact pose about the puzzle origin. */
export function createPieceMatrix(piece: Piece, orientation: Orientation): Matrix4 {
  const { x, y, z } = orientation;
  // Matrix4.set takes rows; the orientation vectors are its columns.
  const matrix = new Matrix4().set(
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    0, 0, 0, 1,
  );
  const solvedCenter = new Vector3(
    piece.solvedMin.x + piece.dimensions.x / 2,
    piece.solvedMin.y + piece.dimensions.y / 2,
    piece.solvedMin.z + piece.dimensions.z / 2,
  );

  // Rotate the actual center, not slot signs or the outer cube's geometric center.
  return matrix.setPosition(solvedCenter.applyMatrix4(matrix));
}
