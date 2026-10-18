import type { Vector3 } from "./model";
import type { Orientation, PuzzleState } from "./state";

export function equalVector(a: Vector3, b: Vector3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Exactly the 24 signed-axis rotations, excluding reflections and scaling. */
export function isCubeRotation(orientation: Orientation): boolean {
  const { x, y, z } = orientation;
  const unitAxes = [x, y, z].every((vector) =>
    [vector.x, vector.y, vector.z].every((value) => value === -1 || value === 0 || value === 1)
    && Math.abs(vector.x) + Math.abs(vector.y) + Math.abs(vector.z) === 1,
  );
  return unitAxes && equalVector(z, {
    x: x.y * y.z - x.z * y.y,
    y: x.z * y.x - x.x * y.z,
    z: x.x * y.y - x.y * y.x,
  });
}

/** Matrix columns are local axes in world coordinates. Keep zero canonical. */
export function transformVector(vector: Vector3, rotation: Orientation): Vector3 {
  const coordinate = (axis: keyof Vector3) => {
    const value = rotation.x[axis] * vector.x + rotation.y[axis] * vector.y + rotation.z[axis] * vector.z;
    return value === 0 ? 0 : value;
  };
  return { x: coordinate("x"), y: coordinate("y"), z: coordinate("z") };
}

/** For a proper rotation, the inverse is its transpose. */
export function inverseRotation({ x, y, z }: Orientation): Orientation {
  return {
    x: { x: x.x, y: y.x, z: z.x },
    y: { x: x.y, y: y.y, z: z.y },
    z: { x: x.z, y: y.z, z: z.z },
  };
}

/** Change the global frame of a valid state using a proper rotation, without mutation. */
export function rotateState(state: PuzzleState, rotation: Orientation): PuzzleState {
  return {
    corners: state.corners.map((corner) => ({
      pieceId: corner.pieceId,
      slot: transformVector(corner.slot, rotation),
      orientation: {
        x: transformVector(corner.orientation.x, rotation),
        y: transformVector(corner.orientation.y, rotation),
        z: transformVector(corner.orientation.z, rotation),
      },
    })),
  };
}
