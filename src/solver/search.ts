import { applyMove, type Move } from "../puzzle/moves";
import { isSolved } from "../puzzle/solved";
import { validatePuzzleState, type StateValidationError } from "../puzzle/validation";
import { encodeState, mapMoveFromFrame } from "./coordinates";
import { estimateRemainingMoves, SOLVER_MOVES, type SolverTables } from "./tables";

export interface SearchOptions {
  /** Face-turn metric; the normalized 2×2 graph has diameter 11. Allowed range: 0..11. */
  readonly maxDepth?: number;
  /** Counts node entries, including heuristic cutoffs and repeated roots. */
  readonly maxNodes?: number;
  /** Cooperative traversal budget; excludes validation/encoding, table construction, and final replay. */
  readonly maxTimeMs?: number;
  /** Polled synchronously; ordinary event-loop callbacks cannot interrupt this call. */
  readonly shouldCancel?: () => boolean;
  /** Monotonic clock, injectable for deterministic budget tests. */
  readonly now?: () => number;
}

export type SearchResult =
  | { readonly status: "solution"; readonly moves: readonly Move[]; readonly visitedNodes: number }
  | { readonly status: "invalid"; readonly error: StateValidationError }
  | { readonly status: "cancelled"; readonly visitedNodes: number }
  | { readonly status: "limit"; readonly reason: "depth" | "nodes" | "time"; readonly visitedNodes: number };

const FOUND = -1;
const INTERRUPTED = -2;

/** Synchronous, history-independent IDA*. Requires intact, caller-owned tables; never builds them. */
export function solvePuzzle(input: unknown, tables: SolverTables, options: SearchOptions = {}): SearchResult {
  const maxDepth = options.maxDepth ?? 11;
  const maxNodes = options.maxNodes ?? 5_000_000;
  const maxTimeMs = options.maxTimeMs ?? 5_000;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 11
    || !Number.isSafeInteger(maxNodes) || maxNodes < 0
    || !Number.isFinite(maxTimeMs) || maxTimeMs < 0) {
    throw new RangeError("Invalid search limits.");
  }

  // Keep a private full-pose snapshot for verification, independent of compact decoding.
  const validation = validatePuzzleState(input);
  if (!validation.valid) return { status: "invalid", error: validation.error };
  const snapshot = validation.state;
  const encoded = encodeState(snapshot);
  if (!encoded.valid) throw new Error("Validated state could not be encoded.");
  const { coordinates, frame } = encoded;
  let visitedNodes = 0;
  const path: number[] = [];

  function solution(): SearchResult {
    const moves = path.map((index) => mapMoveFromFrame(SOLVER_MOVES[index]!, frame));
    if (!isSolved(moves.reduce(applyMove, snapshot))) {
      throw new Error("Solver result failed exact-state verification.");
    }
    return { status: "solution", moves, visitedNodes };
  }

  if (options.shouldCancel?.()) return { status: "cancelled", visitedNodes };
  const { permutation, twist } = coordinates;
  if (permutation === 0 && twist === 0) return solution();

  const now = options.now ?? (() => performance.now());
  const start = now();
  if (!Number.isFinite(start)) throw new RangeError("Search clock must be finite and monotonic.");
  let lastTime = start;
  let interruption: "cancelled" | "nodes" | "time" | null = null;
  let bound = estimateRemainingMoves(tables, coordinates);
  const width = SOLVER_MOVES.length;

  function timedOut(): boolean {
    const time = now();
    if (!Number.isFinite(time) || time < lastTime) throw new RangeError("Search clock must be finite and monotonic.");
    lastTime = time;
    return time - start >= maxTimeMs;
  }

  function interrupted(forceClock = false): boolean {
    if (options.shouldCancel?.()) interruption = "cancelled";
    else if (visitedNodes >= maxNodes) interruption = "nodes";
    else if ((forceClock || visitedNodes % 256 === 0) && timedOut()) interruption = "time";
    return interruption !== null;
  }

  function interruptionResult(): SearchResult {
    if (interruption === null) throw new Error("Missing search interruption reason.");
    return interruption === "cancelled"
      ? { status: "cancelled", visitedNodes }
      : { status: "limit", reason: interruption, visitedNodes };
  }

  function visit(p: number, t: number, depth: number, previousFace: number): number {
    if (interrupted()) return INTERRUPTED;
    visitedNodes++;
    const score = depth + Math.max(tables.permutationDistances[p]!, tables.twistDistances[t]!);
    if (score > bound) return score;
    if (p === 0 && t === 0) {
      // Check the deadline at a found goal too, without charging another node.
      if (timedOut()) {
        interruption = "time";
        return INTERRUPTED;
      }
      return FOUND;
    }

    let nextBound = Infinity;
    for (let index = 0; index < width; index++) {
      const face = Math.floor(index / 3);
      // Same-face neighbors can always be combined into one turn or canceled.
      if (face === previousFace) continue;
      path.push(index);
      const outcome = visit(
        tables.permutationTransitions[p * width + index]!,
        tables.twistTransitions[t * width + index]!,
        depth + 1, face,
      );
      if (outcome === FOUND) return FOUND;
      path.pop();
      if (outcome === INTERRUPTED) return INTERRUPTED;
      nextBound = Math.min(nextBound, outcome);
    }
    return nextBound;
  }

  if (interrupted(true)) return interruptionResult();
  while (bound <= maxDepth) {
    const outcome = visit(permutation, twist, 0, -1);
    if (outcome === FOUND) return solution();
    if (outcome === INTERRUPTED) return interruptionResult();
    bound = outcome;
  }
  return { status: "limit", reason: "depth", visitedNodes };
}
