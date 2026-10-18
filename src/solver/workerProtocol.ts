import type { PuzzleState } from "../puzzle/state";
import type { SearchResult } from "./search";

/** Private structured-clone protocol; no history, language, renderer, or callbacks. */
export interface SolverRequest {
  readonly id: number;
  readonly state: PuzzleState;
}

export type SolverOutcome = SearchResult | {
  readonly status: "error";
  readonly reason: "worker" | "timeout";
};

export interface SolverResponse {
  readonly id: number;
  readonly result: SolverOutcome;
}
