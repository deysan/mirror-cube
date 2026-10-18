import { applyMove, type Move } from "../puzzle/moves";
import { decodeState, encodeState, PERMUTATION_COUNT, TWIST_COUNT, type SolverCoordinates } from "./coordinates";

/** Stable column order; all moves leave the normalized --- reference corner fixed. */
export const SOLVER_MOVES = [
  { face: "R", turns: 1 }, { face: "R", turns: -1 }, { face: "R", turns: 2 },
  { face: "U", turns: 1 }, { face: "U", turns: -1 }, { face: "U", turns: 2 },
  { face: "F", turns: 1 }, { face: "F", turns: -1 }, { face: "F", turns: 2 },
] as const satisfies readonly Move[];

export interface SolverTables {
  /** Row-major: coordinate rank * SOLVER_MOVES.length + move index. Treat buffers as read-only. */
  readonly permutationTransitions: Uint16Array;
  readonly twistTransitions: Uint16Array;
  readonly permutationDistances: Uint8Array;
  readonly twistDistances: Uint8Array;
}

function buildTransitions(coordinate: keyof SolverCoordinates, count: number): Uint16Array {
  const transitions = new Uint16Array(count * SOLVER_MOVES.length);
  for (let rank = 0; rank < count; rank++) {
    // Each projection evolves independently of the other coordinate.
    const state = decodeState({ permutation: 0, twist: 0, [coordinate]: rank });
    for (const [index, move] of SOLVER_MOVES.entries()) {
      const result = encodeState(applyMove(state, move));
      if (!result.valid) throw new Error(`Invalid state while building ${coordinate} transitions: ${result.error.code}`);
      transitions[rank * SOLVER_MOVES.length + index] = result.coordinates[coordinate];
    }
  }
  return transitions;
}

function buildDistances(transitions: Uint16Array, count: number): Uint8Array {
  const unseen = 255;
  const distances = new Uint8Array(count).fill(unseen);
  const queue = new Uint16Array(count);
  distances[0] = 0;
  queue[0] = 0;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const rank = queue[head++]!;
    const nextDistance = distances[rank]! + 1;
    for (let index = 0; index < SOLVER_MOVES.length; index++) {
      const next = transitions[rank * SOLVER_MOVES.length + index]!;
      if (distances[next] !== unseen) continue;
      if (nextDistance >= unseen) throw new Error("Distance table exceeds its byte capacity.");
      distances[next] = nextDistance;
      queue[tail++] = next;
    }
  }
  if (tail !== count) throw new Error("Coordinate graph is not connected to the solved rank.");
  return distances;
}

/** Explicit, synchronous construction; no import-time work, shared cache, or network assets. */
export function createSolverTables(): SolverTables {
  const permutationTransitions = buildTransitions("permutation", PERMUTATION_COUNT);
  const twistTransitions = buildTransitions("twist", TWIST_COUNT);
  return {
    permutationTransitions,
    twistTransitions,
    permutationDistances: buildDistances(permutationTransitions, PERMUTATION_COUNT),
    twistDistances: buildDistances(twistTransitions, TWIST_COUNT),
  };
}

function assertCoordinates({ permutation, twist }: SolverCoordinates): void {
  if (!Number.isInteger(permutation) || permutation < 0 || permutation >= PERMUTATION_COUNT
    || !Number.isInteger(twist) || twist < 0 || twist >= TWIST_COUNT) {
    throw new RangeError("Solver coordinates are outside their integer ranges.");
  }
}

/** Lookup only: no piece reconstruction, validation, or normalization in the transition itself. */
export function applyTableMove(tables: SolverTables, coordinates: SolverCoordinates, moveIndex: number): SolverCoordinates {
  assertCoordinates(coordinates);
  if (!Number.isInteger(moveIndex) || moveIndex < 0 || moveIndex >= SOLVER_MOVES.length) {
    throw new RangeError("Solver move index is outside its integer range.");
  }
  return {
    permutation: tables.permutationTransitions[coordinates.permutation * SOLVER_MOVES.length + moveIndex]!,
    twist: tables.twistTransitions[coordinates.twist * SOLVER_MOVES.length + moveIndex]!,
  };
}

/** Admissible and consistent in the face-turn metric. Adding the two distances would overestimate. */
export function estimateRemainingMoves(tables: SolverTables, coordinates: SolverCoordinates): number {
  assertCoordinates(coordinates);
  return Math.max(tables.permutationDistances[coordinates.permutation]!, tables.twistDistances[coordinates.twist]!);
}
