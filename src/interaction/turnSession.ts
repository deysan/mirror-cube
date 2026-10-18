import { applyMove, inverseMove, type Move } from "../puzzle/moves";
import type { PuzzleState } from "../puzzle/state";
import type { SolverOutcome, SolverRequest, SolverResponse } from "../solver/workerProtocol";

export type SolutionSearch =
  | { readonly status: "idle" | "cancelled" }
  | { readonly status: "running"; readonly request: SolverRequest }
  | { readonly status: "done"; readonly result: SolverOutcome };

export interface PendingTurn {
  readonly id: number;
  readonly move: Move;
  readonly kind: "manual" | "undo" | "scramble";
}

export interface ScrambleProgress {
  readonly moves: readonly Move[];
  readonly completed: number;
}

export interface TurnSession {
  readonly puzzle: PuzzleState;
  readonly history: readonly Move[];
  readonly activeTurn: PendingTurn | null;
  readonly scramble: ScrambleProgress | null;
  readonly sceneStatus: "loading" | "ready" | "failed";
  readonly nextTurnId: number;
  readonly search: SolutionSearch;
  readonly nextSearchId: number;
}

export type TurnAction =
  | { readonly type: "scene-ready" }
  | { readonly type: "scene-failed" }
  | { readonly type: "start"; readonly move: Move }
  | { readonly type: "undo" }
  | { readonly type: "scramble"; readonly moves: readonly Move[] }
  | { readonly type: "complete"; readonly id: number }
  | { readonly type: "find-solution" }
  | { readonly type: "cancel-search" }
  | { readonly type: "search-result"; readonly response: SolverResponse };

export function createTurnSession(puzzle: PuzzleState): TurnSession {
  return {
    puzzle, history: [], activeTurn: null, scramble: null, sceneStatus: "loading", nextTurnId: 1,
    search: { status: "idle" }, nextSearchId: 1,
  };
}

/** UI transaction state, separate from both puzzle rules and animation frames. */
export function turnSessionReducer(session: TurnSession, action: TurnAction): TurnSession {
  switch (action.type) {
    case "scene-ready":
      return session.sceneStatus === "loading" ? { ...session, sceneStatus: "ready" } : session;
    case "scene-failed":
      // Cancel visual/search work; the committed puzzle and history are unchanged.
      return { ...session, sceneStatus: "failed", activeTurn: null, scramble: null, search: { status: "idle" } };
    case "find-solution":
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "running", request: { id: session.nextSearchId, state: session.puzzle } },
        nextSearchId: session.nextSearchId + 1,
      };
    case "cancel-search":
      return session.search.status === "running" ? { ...session, search: { status: "cancelled" } } : session;
    case "search-result":
      if (session.search.status !== "running" || session.sceneStatus !== "ready" || session.activeTurn
        || session.search.request.id !== action.response.id || session.search.request.state !== session.puzzle) return session;
      return { ...session, search: { status: "done", result: action.response.result } };
    case "start":
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "idle" },
        activeTurn: { id: session.nextTurnId, move: action.move, kind: "manual" },
        nextTurnId: session.nextTurnId + 1,
      };
    case "undo": {
      const lastMove = session.history.at(-1);
      if (session.sceneStatus !== "ready" || session.activeTurn || !lastMove || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "idle" },
        activeTurn: { id: session.nextTurnId, move: inverseMove(lastMove), kind: "undo" },
        nextTurnId: session.nextTurnId + 1,
      };
    }
    case "scramble": {
      const first = action.moves[0];
      if (session.sceneStatus !== "ready" || session.activeTurn || !first || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "idle" },
        scramble: { moves: [...action.moves], completed: 0 },
        activeTurn: { id: session.nextTurnId, move: first, kind: "scramble" },
        nextTurnId: session.nextTurnId + 1,
      };
    }
    case "complete": {
      // Commit one move and schedule the next atomically, with no unlocked gap.
      // Duplicate/stale callbacks cannot commit or advance the sequence again.
      if (!session.activeTurn || session.activeTurn.id !== action.id) return session;
      const completed = session.scramble ? session.scramble.completed + 1 : 0;
      const next = session.scramble?.moves[completed];
      return {
        ...session,
        puzzle: applyMove(session.puzzle, session.activeTurn.move),
        history: session.activeTurn.kind === "undo"
          ? session.history.slice(0, -1)
          : [...session.history, session.activeTurn.move],
        activeTurn: next ? { id: session.nextTurnId, move: next, kind: "scramble" } : null,
        scramble: next && session.scramble ? { ...session.scramble, completed } : null,
        nextTurnId: next ? session.nextTurnId + 1 : session.nextTurnId,
      };
    }
  }
}
