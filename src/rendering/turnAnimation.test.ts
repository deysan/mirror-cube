import { Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, FACE_LAYERS } from "../puzzle/moves";
import { createSolvedState } from "../puzzle/state";
import { createPieceMatrix, getPuzzleRadius } from "./pieceTransform";
import { getTurnAngle, getTurnDuration } from "./turnAnimation";

const cube = createSolvedCube();
const solved = createSolvedState(cube);
const mixed = applyMove(applyMove(solved, { face: "R", turns: 1 }), { face: "U", turns: -1 });
const moves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);

it("uses bounded smooth progress and longer timing for a half-turn", () => {
  const move = { face: "F", turns: 1 } as const;
  expect(getTurnAngle(move, -1)).toBeCloseTo(0);
  expect(getTurnAngle(move, 0)).toBeCloseTo(0);
  expect(getTurnAngle(move, 0.5)).toBeCloseTo(-Math.PI / 4);
  expect(getTurnAngle(move, 1)).toBeCloseTo(-Math.PI / 2);
  expect(getTurnAngle(move, 2)).toBeCloseTo(-Math.PI / 2);
  expect(getTurnDuration(move)).toBe(0.6);
  expect(getTurnDuration({ face: "F", turns: 2 })).toBe(0.9);
});

describe.each([
  { name: "solved", state: solved },
  { name: "mixed", state: mixed },
])("animation from $name", ({ state }) => {
  it.each(moves)("$face ($turns) ends at the exact move's geometry and stays in camera bounds", (move) => {
    const { axis, side } = FACE_LAYERS[move.face];
    const rotationAxis = new Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
    const end = applyMove(state, move);
    const radius = getPuzzleRadius(cube);
    let movingCount = 0;

    for (const [index, corner] of state.corners.entries()) {
      const piece = cube.pieces.find(({ id }) => id === corner.pieceId)!;
      const startMatrix = createPieceMatrix(piece, corner.orientation);
      const endMatrix = createPieceMatrix(piece, end.corners[index]!.orientation);
      const moving = corner.slot[axis] === side;
      if (moving) movingCount += 1;

      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const visual = moving
          ? new Matrix4().makeRotationAxis(rotationAxis, getTurnAngle(move, progress)).multiply(startMatrix)
          : startMatrix;
        if (progress === 1) {
          visual.elements.forEach((value, i) => expect(value).toBeCloseTo(endMatrix.elements[i]!, 10));
        }
        // Every corner is inside a pivot-centered sphere throughout rotation.
        // Orthographic projection cannot enlarge its distance from the view center.
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          const vertex = new Vector3(
            sx * piece.dimensions.x / 2,
            sy * piece.dimensions.y / 2,
            sz * piece.dimensions.z / 2,
          ).applyMatrix4(visual);
          expect(vertex.length()).toBeLessThanOrEqual(radius + 1e-10);
        }
      }
    }
    expect(movingCount).toBe(4);
  });
});
