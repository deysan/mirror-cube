import { describe, expect, it } from "vitest";
import {
  createSolvedCube,
  DEFAULT_CUBE_PARAMETERS,
  MIRRORED_CUBE_PARAMETERS,
  type CubeParameters,
} from "./model";

const AXES = ["x", "y", "z"] as const;

const fixtures = [
  { name: "historical reference dimensions", parameters: DEFAULT_CUBE_PARAMETERS },
  { name: "mirrored application dimensions", parameters: MIRRORED_CUBE_PARAMETERS },
  {
    name: "split planes past the midpoint",
    parameters: { edgeLength: 50, splits: { x: 28, y: 30, z: 33 } },
  },
  {
    name: "small cube",
    parameters: { edgeLength: 7, splits: { x: 1, y: 2, z: 3 } },
  },
  {
    name: "one-millimeter difference",
    parameters: { edgeLength: 59, splits: { x: 20, y: 24, z: 29 } },
  },
] satisfies { name: string; parameters: CubeParameters }[];

describe.each(fixtures)("solved geometry: $name", ({ parameters }) => {
  it("creates exactly eight pieces with stable, unique octant identifiers", () => {
    const { pieces } = createSolvedCube(parameters);

    expect(pieces).toHaveLength(8);
    expect(new Set(pieces.map((piece) => piece.id))).toEqual(
      new Set(["---", "--+", "-+-", "-++", "+--", "+-+", "++-", "+++"]),
    );
  });

  it("uses the exact split lengths on each axis and stays within the outer cube", () => {
    const { pieces, edgeLength, splits } = createSolvedCube(parameters);

    for (const axis of AXES) {
      const outerMin = -splits[axis];
      const outerMax = edgeLength - splits[axis];

      expect(pieces.filter((piece) => piece.solvedMin[axis] === outerMin)).toHaveLength(4);
      expect(pieces.filter((piece) => piece.solvedMin[axis] === 0)).toHaveLength(4);

      for (const piece of pieces) {
        const min = piece.solvedMin[axis];
        const size = piece.dimensions[axis];
        const max = min + size;

        expect(size).toBeGreaterThan(0);
        expect(Number.isSafeInteger(size)).toBe(true);
        expect(min).toBeGreaterThanOrEqual(outerMin);
        expect(max).toBeLessThanOrEqual(outerMax);

        if (min === outerMin) {
          expect(size).toBe(splits[axis]);
          expect(max).toBe(0);
        } else {
          expect(size).toBe(edgeLength - splits[axis]);
          expect(max).toBe(outerMax);
        }
      }
    }
  });

  it("has no pair of pieces with overlapping interiors", () => {
    const { pieces } = createSolvedCube(parameters);
    let pairCount = 0;

    for (const [index, first] of pieces.entries()) {
      for (const second of pieces.slice(index + 1)) {
        pairCount += 1;
        const interiorsOverlap = AXES.every((axis) => {
          const overlapStart = Math.max(first.solvedMin[axis], second.solvedMin[axis]);
          const overlapEnd = Math.min(
            first.solvedMin[axis] + first.dimensions[axis],
            second.solvedMin[axis] + second.dimensions[axis],
          );

          // Shared faces, edges, and corners are allowed; positive volume is not.
          return overlapStart < overlapEnd;
        });

        expect(interiorsOverlap, `${first.id} and ${second.id}`).toBe(false);
      }
    }

    expect(pairCount).toBe(28);
  });

  it("fills the cube's entire volume", () => {
    const { pieces, edgeLength } = createSolvedCube(parameters);
    const totalVolume = pieces.reduce(
      (sum, { dimensions }) => sum + dimensions.x * dimensions.y * dimensions.z,
      0,
    );

    // Combined with containment and non-overlap, equal volume rules out gaps.
    expect(totalVolume).toBe(edgeLength ** 3);
  });
});

describe("piece dimensions and identity", () => {
  it("reflects the application's front/back geometry without changing sizes or the historical photo convention", () => {
    const reference = createSolvedCube(), mirrored = createSolvedCube(MIRRORED_CUBE_PARAMETERS);
    expect(reference.splits).toEqual({ x: 22, y: 20, z: 17 });
    expect(mirrored.splits).toEqual({ x: 22, y: 20, z: 33 });
    for (const piece of reference.pieces) {
      const reflectedId = piece.id.slice(0, 2) + (piece.id[2] === "+" ? "-" : "+");
      const reflected = mirrored.pieces.find(p => p.id === reflectedId)!;
      expect(reflected.dimensions).toEqual(piece.dimensions);
      expect(reflected.solvedMin).toEqual({ ...piece.solvedMin, z: -piece.solvedMin.z - piece.dimensions.z });
    }
  });

  it("retains the historical factory default around the split intersection", () => {
    const cube = createSolvedCube();

    expect(cube.edgeLength).toBe(50);
    expect(cube.splits).toEqual({ x: 22, y: 20, z: 17 });
    expect(cube.pieces.find(({ id }) => id === "---")).toEqual({
      id: "---",
      dimensions: { x: 22, y: 20, z: 17 },
      solvedMin: { x: -22, y: -20, z: -17 },
    });
    expect(cube.pieces.find(({ id }) => id === "+-+")).toEqual({
      id: "+-+",
      dimensions: { x: 28, y: 20, z: 33 },
      solvedMin: { x: 0, y: -20, z: 0 },
    });
    expect(cube.pieces.find(({ id }) => id === "+++")).toEqual({
      id: "+++",
      dimensions: { x: 28, y: 30, z: 33 },
      solvedMin: { x: 0, y: 0, z: 0 },
    });
  });

  it("gives the default cube eight distinct shapes, even if their axes are reordered", () => {
    const { pieces } = createSolvedCube();
    const shapes = pieces.map(({ dimensions: { x, y, z } }) =>
      [x, y, z].sort((a, b) => a - b).join(","),
    );

    expect(new Set(shapes).size).toBe(8);
  });

  it("preserves a one-millimeter difference without rounding or merging pieces", () => {
    const { pieces } = createSolvedCube({
      edgeLength: 59,
      splits: { x: 20, y: 24, z: 29 },
    });

    expect(pieces.find(({ id }) => id === "---")?.dimensions).toEqual({
      x: 20, y: 24, z: 29,
    });
    expect(pieces.find(({ id }) => id === "--+")?.dimensions).toEqual({
      x: 20, y: 24, z: 30,
    });
  });

  it("keeps identifiers independent of the selected dimensions", () => {
    const first = createSolvedCube();
    const second = createSolvedCube({ edgeLength: 7, splits: { x: 1, y: 2, z: 3 } });

    expect(first.pieces.map(({ id }) => id)).toEqual(second.pieces.map(({ id }) => id));
  });

  it("does not mutate or retain the caller's parameter object", () => {
    const parameters = { edgeLength: 50, splits: { x: 22, y: 20, z: 17 } };
    const cube = createSolvedCube(parameters);

    expect(parameters).toEqual(DEFAULT_CUBE_PARAMETERS);
    expect(cube.splits).not.toBe(parameters.splits);

    parameters.edgeLength = 80;
    parameters.splits.x = 24;

    expect(cube.edgeLength).toBe(50);
    expect(cube.splits.x).toBe(22);
    expect(cube.pieces.find(({ id }) => id === "---")?.dimensions.x).toBe(22);
  });
});

describe("parameter validation", () => {
  it.each([0, -1, 50.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid edge length %s",
    (edgeLength) => {
      expect(() => createSolvedCube({ ...DEFAULT_CUBE_PARAMETERS, edgeLength }))
        .toThrow(/edgeLength/);
    },
  );

  describe.each(AXES)("split on the %s axis", (axis) => {
    it.each([0, -1, 50, 51, 22.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
      "rejects invalid split %s",
      (split) => {
        expect(() => createSolvedCube({
          edgeLength: 50,
          splits: { ...DEFAULT_CUBE_PARAMETERS.splits, [axis]: split },
        })).toThrow(`splits.${axis}`);
      },
    );

    it("rejects a centered split", () => {
      expect(() => createSolvedCube({
        edgeLength: 50,
        splits: { ...DEFAULT_CUBE_PARAMETERS.splits, [axis]: 25 },
      })).toThrow(`splits.${axis} must be off-center`);
    });
  });
});
