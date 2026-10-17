import type { PieceId, SolvedCube, Vector3 } from "../puzzle/model";

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface SolvedFace {
  readonly pieceId: PieceId;
  readonly side: "right" | "top" | "front";
  readonly vertices: readonly [Vector3, Vector3, Vector3, Vector3];
}

/** Orthographic view from (+X, +Y, +Z), with SVG's Y axis pointing down. */
export function projectIsometric({ x, y, z }: Vector3): Point2 {
  return {
    x: (x - z) / Math.sqrt(2),
    y: (x + z - 2 * y) / Math.sqrt(6),
  };
}

/** Only valid for the solved state and this fixed camera; not a general renderer. */
export function getVisibleSolvedFaces(cube: SolvedCube): SolvedFace[] {
  const outerMax = {
    x: cube.edgeLength - cube.splits.x,
    y: cube.edgeLength - cube.splits.y,
    z: cube.edgeLength - cube.splits.z,
  };
  const faces: SolvedFace[] = [];

  for (const piece of cube.pieces) {
    const min = piece.solvedMin;
    const max = {
      x: min.x + piece.dimensions.x,
      y: min.y + piece.dimensions.y,
      z: min.z + piece.dimensions.z,
    };

    // Exclude internal faces and the three outer surfaces facing away from us.
    if (max.x === outerMax.x) {
      faces.push({
        pieceId: piece.id,
        side: "right",
        vertices: [
          { x: max.x, y: min.y, z: min.z },
          { x: max.x, y: max.y, z: min.z },
          { x: max.x, y: max.y, z: max.z },
          { x: max.x, y: min.y, z: max.z },
        ],
      });
    }

    if (max.y === outerMax.y) {
      faces.push({
        pieceId: piece.id,
        side: "top",
        vertices: [
          { x: min.x, y: max.y, z: min.z },
          { x: min.x, y: max.y, z: max.z },
          { x: max.x, y: max.y, z: max.z },
          { x: max.x, y: max.y, z: min.z },
        ],
      });
    }

    if (max.z === outerMax.z) {
      faces.push({
        pieceId: piece.id,
        side: "front",
        vertices: [
          { x: min.x, y: min.y, z: max.z },
          { x: max.x, y: min.y, z: max.z },
          { x: max.x, y: max.y, z: max.z },
          { x: min.x, y: max.y, z: max.z },
        ],
      });
    }
  }

  // These exterior polygons tile three visible surfaces without overlapping
  // interiors in projection, so the solved view needs no depth sorting.
  return faces;
}
