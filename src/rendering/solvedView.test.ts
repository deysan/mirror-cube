import { describe, expect, it } from "vitest";
import { createSolvedCube, DEFAULT_CUBE_PARAMETERS } from "../puzzle/model";
import { getVisibleSolvedFaces, projectIsometric, type Point2 } from "./solvedView";

const AXES = ["x", "y", "z"] as const;
const FACE_AXES = { right: "x", top: "y", front: "z" } as const;

function polygonArea(points: readonly Point2[]): number {
  let twiceArea = 0;
  for (const [index, current] of points.entries()) {
    const next = points[(index + 1) % points.length]!;
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

describe("isometric projection", () => {
  it("projects the origin to the origin", () => {
    expect(projectIsometric({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("shows +X to the right, +Y upward, and +Z to the left", () => {
    const x = projectIsometric({ x: 1, y: 0, z: 0 });
    const y = projectIsometric({ x: 0, y: 1, z: 0 });
    const z = projectIsometric({ x: 0, y: 0, z: 1 });

    expect(x.x).toBeGreaterThan(0);
    expect(x.y).toBeGreaterThan(0);
    expect(y.x).toBe(0);
    expect(y.y).toBeLessThan(0);
    expect(z.x).toBeLessThan(0);
    expect(z.y).toBeGreaterThan(0);
  });

  it("foreshortens all axes equally and separates them by 120 degrees", () => {
    const projected = [
      projectIsometric({ x: 1, y: 0, z: 0 }),
      projectIsometric({ x: 0, y: 1, z: 0 }),
      projectIsometric({ x: 0, y: 0, z: 1 }),
    ];

    for (const [index, first] of projected.entries()) {
      expect(Math.hypot(first.x, first.y)).toBeCloseTo(Math.sqrt(2 / 3));
      for (const second of projected.slice(index + 1)) {
        const cosine = (first.x * second.x + first.y * second.y)
          / (Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y));
        expect(cosine).toBeCloseTo(-0.5);
      }
    }
  });

  it("collapses only depth along the camera direction", () => {
    const first = projectIsometric({ x: 22, y: 20, z: 17 });
    const further = projectIsometric({ x: 32, y: 30, z: 27 });

    expect(further.x).toBeCloseTo(first.x);
    expect(further.y).toBeCloseTo(first.y);
  });
});

describe.each([
  { name: "owner's cube", parameters: DEFAULT_CUBE_PARAMETERS },
  { name: "different dimensions", parameters: { edgeLength: 59, splits: { x: 31, y: 24, z: 29 } } },
])("visible solved faces: $name", ({ parameters }) => {
  it("returns exactly four polygons on each of three visible surfaces", () => {
    const faces = getVisibleSolvedFaces(createSolvedCube(parameters));

    expect(faces).toHaveLength(12);
    expect(new Set(faces.map((face) => `${face.pieceId}:${face.side}`)).size).toBe(12);
    for (const side of ["right", "top", "front"] as const) {
      expect(faces.filter((face) => face.side === side)).toHaveLength(4);
    }
    expect(faces.some((face) => face.pieceId === "---")).toBe(false);
  });

  it("uses actual piece corners on outer positive planes, never internal faces", () => {
    const cube = createSolvedCube(parameters);
    const faces = getVisibleSolvedFaces(cube);

    for (const face of faces) {
      const piece = cube.pieces.find(({ id }) => id === face.pieceId)!;
      const normalAxis = FACE_AXES[face.side];
      expect(new Set(face.vertices.map((vertex) => JSON.stringify(vertex))).size).toBe(4);

      for (const vertex of face.vertices) {
        expect(vertex[normalAxis]).toBe(cube.edgeLength - cube.splits[normalAxis]);
        for (const axis of AXES) {
          expect([piece.solvedMin[axis], piece.solvedMin[axis] + piece.dimensions[axis]])
            .toContain(vertex[axis]);
        }
      }
    }
  });

  it("preserves the projected area of every face and covers each outer surface", () => {
    const cube = createSolvedCube(parameters);
    const totals = { right: 0, top: 0, front: 0 };

    for (const face of getVisibleSolvedFaces(cube)) {
      const piece = cube.pieces.find(({ id }) => id === face.pieceId)!;
      const normalAxis = FACE_AXES[face.side];
      const area3D = AXES.filter((axis) => axis !== normalAxis)
        .reduce((area, axis) => area * piece.dimensions[axis], 1);
      const area2D = polygonArea(face.vertices.map(projectIsometric));

      expect(area2D).toBeCloseTo(area3D / Math.sqrt(3));
      totals[face.side] += area2D;
    }

    for (const total of Object.values(totals)) {
      expect(total).toBeCloseTo(cube.edgeLength ** 2 / Math.sqrt(3));
    }
  });

  it("does not change the puzzle model while deriving its view", () => {
    const cube = createSolvedCube(parameters);
    const before = JSON.stringify(cube);

    getVisibleSolvedFaces(cube);

    expect(JSON.stringify(cube)).toBe(before);
  });
});
