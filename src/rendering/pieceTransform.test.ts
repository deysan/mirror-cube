import { Box3, BoxGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, type Move } from "../puzzle/moves";
import { createSolvedState } from "../puzzle/state";
import { createPieceMatrix } from "./pieceTransform";

const cube = createSolvedCube();
const solved = createSolvedState(cube);
const sequence: readonly Move[] = [
  { face: "R", turns: 1 }, { face: "U", turns: -1 },
  { face: "F", turns: 2 }, { face: "L", turns: -1 },
  { face: "D", turns: 1 }, { face: "B", turns: 2 },
];

it("places all eight solved boxes at their exact model bounds", () => {
  const total = new Box3();
  for (const corner of solved.corners) {
    const piece = cube.pieces.find(({ id }) => id === corner.pieceId)!;
    const { x, y, z } = piece.dimensions;
    const geometry = new BoxGeometry(x, y, z);
    geometry.applyMatrix4(createPieceMatrix(piece, corner.orientation));
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;

    expect(bounds.min.toArray()).toEqual(Object.values(piece.solvedMin));
    expect(bounds.max.toArray()).toEqual([
      piece.solvedMin.x + x, piece.solvedMin.y + y, piece.solvedMin.z + z,
    ]);
    total.union(bounds);
    geometry.dispose();
  }

  expect(total.min.toArray()).toEqual([-22, -20, -17]);
  expect(total.max.toArray()).toEqual([28, 30, 33]);
});

it("rotates an asymmetric piece and its center about the split intersection", () => {
  const state = applyMove(solved, { face: "F", turns: 1 });
  const corner = state.corners.find(({ pieceId }) => pieceId === "+++")!;
  const piece = cube.pieces.find(({ id }) => id === "+++")!;
  const matrix = createPieceMatrix(piece, corner.orientation);
  const geometry = new BoxGeometry(28, 30, 33);
  geometry.applyMatrix4(matrix);
  geometry.computeBoundingBox();

  expect(new Vector3().applyMatrix4(matrix).toArray()).toEqual([15, -14, 16.5]);
  expect(geometry.boundingBox!.min.toArray()).toEqual([0, -28, 0]);
  expect(geometry.boundingBox!.max.toArray()).toEqual([30, 0, 33]);
  expect(matrix.determinant()).toBe(1);
  geometry.dispose();
});

describe.each([
  { name: "solved", state: solved },
  { name: "after mixed turns", state: sequence.reduce(applyMove, solved) },
])("mesh transforms: $name", ({ state }) => {
  it("maps every box vertex to its discrete pose without scaling or reflecting", () => {
    const before = JSON.stringify({ cube, state });
    for (const corner of state.corners) {
      const piece = cube.pieces.find(({ id }) => id === corner.pieceId)!;
      const { x: width, y: height, z: depth } = piece.dimensions;
      const geometry = new BoxGeometry(width, height, depth);
      const vertices = geometry.getAttribute("position");
      const matrix = createPieceMatrix(piece, corner.orientation);
      const scale = new Vector3().setFromMatrixScale(matrix);
      expect(scale.toArray()).toEqual([1, 1, 1]);
      expect(matrix.determinant()).toBe(1);

      for (let index = 0; index < vertices.count; index += 1) {
        const local = new Vector3().fromBufferAttribute(vertices, index);
        const home = {
          x: local.x + piece.solvedMin.x + width / 2,
          y: local.y + piece.solvedMin.y + height / 2,
          z: local.z + piece.solvedMin.z + depth / 2,
        };
        const { x, y, z } = corner.orientation;
        const expected = [
          x.x * home.x + y.x * home.y + z.x * home.z,
          x.y * home.x + y.y * home.y + z.y * home.z,
          x.z * home.x + y.z * home.y + z.z * home.z,
        ];
        // Arithmetic on negative coordinates can produce -0; it is the same point.
        expect(local.applyMatrix4(matrix).toArray()).toEqual(expected.map((value) => value === 0 ? 0 : value));
      }
      geometry.dispose();
    }
    expect(JSON.stringify({ cube, state })).toBe(before);
  });
});

it("preserves a one-millimeter difference in the geometry sent to Three.js", () => {
  const definition = createSolvedCube({ edgeLength: 59, splits: { x: 20, y: 24, z: 29 } });
  const state = applyMove(createSolvedState(definition), { face: "L", turns: 1 });
  const extents: number[] = [];

  for (const id of ["---", "--+"]) {
    const piece = definition.pieces.find((piece) => piece.id === id)!;
    const corner = state.corners.find(({ pieceId }) => pieceId === id)!;
    const geometry = new BoxGeometry(piece.dimensions.x, piece.dimensions.y, piece.dimensions.z);
    geometry.applyMatrix4(createPieceMatrix(piece, corner.orientation));
    geometry.computeBoundingBox();
    extents.push(geometry.boundingBox!.getSize(new Vector3()).y);
    geometry.dispose();
  }
  expect(extents).toEqual([29, 30]);
});
