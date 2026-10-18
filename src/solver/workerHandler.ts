import { solvePuzzle } from "./search";
import { createSolverTables, type SolverTables } from "./tables";
import type { SolverRequest, SolverResponse } from "./workerProtocol";

/** One handler per worker lifetime. Factories are injectable for boundary tests. */
export function createSolverHandler(buildTables = createSolverTables, search = solvePuzzle) {
  let tables: SolverTables | undefined;
  return ({ id, state }: SolverRequest): SolverResponse => {
    try {
      tables ??= buildTables();
      return { id, result: search(state, tables) };
    } catch {
      tables = undefined;
      // Do not expose stack traces or internal exception messages in user-facing results.
      return { id, result: { status: "error", reason: "worker" } };
    }
  };
}
