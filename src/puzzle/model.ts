export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CubeParameters {
  /** Positive whole millimeters. */
  readonly edgeLength: number;
  /** Distance from the cube's minimum outer face to each split plane, in mm. */
  readonly splits: Vector3;
}

type Side = "-" | "+";

/** Signs along x, y, z in the solved state; identity does not depend on size. */
export type PieceId = `${Side}${Side}${Side}`;

export interface Piece {
  readonly id: PieceId;
  /** Intrinsic dimensions in mm; local axes align with world axes when solved. */
  readonly dimensions: Vector3;
  /** Minimum corner in the solved state, relative to the split intersection. */
  readonly solvedMin: Vector3;
}

export interface SolvedCube extends CubeParameters {
  readonly pieces: readonly Piece[];
}

/** Owner-confirmed dimensions of their Cayro 2×2 Mirror Cube, in mm. */
export const DEFAULT_CUBE_PARAMETERS = {
  edgeLength: 50,
  splits: { x: 22, y: 20, z: 17 },
} as const satisfies CubeParameters;

const AXES = ["x", "y", "z"] as const;
const SIDES = ["-", "+"] as const;

function validateParameters({ edgeLength, splits }: CubeParameters): void {
  if (!Number.isSafeInteger(edgeLength) || edgeLength <= 0) {
    throw new RangeError("edgeLength must be a positive safe integer in millimeters.");
  }

  for (const axis of AXES) {
    const split = splits[axis];

    if (!Number.isSafeInteger(split) || split <= 0 || split >= edgeLength) {
      throw new RangeError(
        `splits.${axis} must be a safe integer strictly between 0 and edgeLength.`,
      );
    }

    if (split === edgeLength / 2) {
      throw new RangeError(`splits.${axis} must be off-center.`);
    }
  }
}

export function createSolvedCube(
  parameters: CubeParameters = DEFAULT_CUBE_PARAMETERS,
): SolvedCube {
  validateParameters(parameters);

  const { edgeLength } = parameters;
  const splits = { ...parameters.splits };
  const pieces: Piece[] = [];

  // The three split planes meet at (0, 0, 0). Each piece occupies one octant.
  for (const x of SIDES) {
    for (const y of SIDES) {
      for (const z of SIDES) {
        pieces.push({
          id: `${x}${y}${z}`,
          dimensions: {
            x: x === "-" ? splits.x : edgeLength - splits.x,
            y: y === "-" ? splits.y : edgeLength - splits.y,
            z: z === "-" ? splits.z : edgeLength - splits.z,
          },
          solvedMin: {
            x: x === "-" ? -splits.x : 0,
            y: y === "-" ? -splits.y : 0,
            z: z === "-" ? -splits.z : 0,
          },
        });
      }
    }
  }

  return { edgeLength, splits, pieces };
}
