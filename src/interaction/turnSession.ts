import { applyMove, inverseMove, type Move } from "../puzzle/moves";
import type { PuzzleState } from "../puzzle/state";
import { isSolved } from "../puzzle/solved";
import type { SolverOutcome, SolverRequest, SolverResponse } from "../solver/workerProtocol";

export type SolutionSearch =
  | { readonly status: "idle" | "cancelled" }
  | { readonly status: "running"; readonly request: SolverRequest }
  | { readonly status: "done"; readonly result: SolverOutcome };

export interface SolutionPlayback {
  readonly moves: readonly Move[];
  readonly completed: number;
  /** The exact committed snapshot for which the next move is valid. */
  readonly expectedState: PuzzleState;
  readonly status: "ready" | "complete" | "failed";
  /** Number of completed steps requested by a navigation action, or no queued target. */
  readonly target: number | null;
}

export type PendingTurn = {
  readonly id: number;
  readonly move: Move;
} & (
  | { readonly kind: "manual" | "undo" | "scramble" | "solution" | "solution-back" }
  | { readonly kind: "replay"; readonly previewState: PuzzleState }
);

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
  readonly playback: SolutionPlayback | null;
}

export type TurnAction =
  | { readonly type: "scene-ready" }
  | { readonly type: "scene-failed" }
  | { readonly type: "start"; readonly move: Move }
  | { readonly type: "undo" }
  | { readonly type: "scramble"; readonly moves: readonly Move[] }
  | { readonly type: "complete"; readonly id: number }
  | { readonly type: "solution-next" }
  | { readonly type: "solution-go"; readonly completed: number }
  | { readonly type: "solution-replay" }
  | { readonly type: "reset"; readonly state: PuzzleState }
  | { readonly type: "find-solution" }
  | { readonly type: "cancel-search" }
  | { readonly type: "search-result"; readonly response: SolverResponse };

export function createTurnSession(puzzle: PuzzleState): TurnSession {
  return {
    puzzle, history: [], activeTurn: null, scramble: null, sceneStatus: "loading", nextTurnId: 1,
    search: { status: "idle" }, nextSearchId: 1, playback: null,
  };
}

function navigateSolution(session: TurnSession, target: number): TurnSession {
  const playback = session.playback;
  if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running"
    || !playback || playback.status === "failed" || !Number.isInteger(target)
    || target < 0 || target > playback.moves.length || target === playback.completed) return session;
  if (playback.expectedState !== session.puzzle) {
    return { ...session, playback: { ...playback, status: "failed", target: null } };
  }
  const backwards = target < playback.completed;
  const move = playback.moves[backwards ? playback.completed - 1 : playback.completed]!;
  return {
    ...session,
    playback: { ...playback, target },
    activeTurn: { id: session.nextTurnId, move: backwards ? inverseMove(move) : move,
      kind: backwards ? "solution-back" : "solution" },
    nextTurnId: session.nextTurnId + 1,
  };
}

/** UI transaction state, separate from both puzzle rules and animation frames. */
export function turnSessionReducer(session: TurnSession, action: TurnAction): TurnSession {
  switch (action.type) {
    case "scene-ready":
      return session.sceneStatus === "loading" ? { ...session, sceneStatus: "ready" } : session;
    case "scene-failed":
      // Cancel visual/search work; the committed puzzle and history are unchanged.
      return { ...session, sceneStatus: "failed", activeTurn: null, scramble: null, search: { status: "idle" }, playback: null };
    case "reset":
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running") return session;
      // Keep monotonically increasing IDs: callbacks from before reset must stay obsolete.
      return { ...session, puzzle: action.state, history: [], playback: null, scramble: null,
        search: { status: "idle" } };
    case "find-solution":
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "running", request: { id: session.nextSearchId, state: session.puzzle } },
        nextSearchId: session.nextSearchId + 1,
        playback: null,
      };
    case "cancel-search":
      return session.search.status === "running" ? { ...session, search: { status: "cancelled" } } : session;
    case "search-result": {
      if (session.search.status !== "running" || session.sceneStatus !== "ready" || session.activeTurn
        || session.search.request.id !== action.response.id || session.search.request.state !== session.puzzle) return session;
      const result = action.response.result;
      return {
        ...session, search: { status: "done", result },
        playback: result.status === "solution" && result.moves.length > 0 ? {
          moves: result.moves.map((move) => ({ ...move })), completed: 0,
          expectedState: session.puzzle, status: "ready", target: null,
        } : null,
      };
    }
    case "solution-go":
      return navigateSolution(session, action.completed);
    case "solution-replay": {
      const playback = session.playback;
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running"
        || !playback || playback.status === "failed" || playback.completed === 0) return session;
      if (playback.expectedState !== session.puzzle) {
        return { ...session, playback: { ...playback, status: "failed", target: null } };
      }
      const move = playback.moves[playback.completed - 1]!;
      return { ...session, nextTurnId: session.nextTurnId + 1,
        activeTurn: { id: session.nextTurnId, kind: "replay", move,
          previewState: applyMove(session.puzzle, inverseMove(move)) } };
    }
    case "solution-next": {
      const playback = session.playback;
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running"
        || !playback || playback.status !== "ready") return session;
      if (playback.expectedState !== session.puzzle) {
        return { ...session, playback: { ...playback, status: "failed" } };
      }
      const move = playback.moves[playback.completed];
      if (!move) return session;
      return {
        ...session,
        activeTurn: { id: session.nextTurnId, move, kind: "solution" },
        nextTurnId: session.nextTurnId + 1,
      };
    }
    case "start":
      if (session.sceneStatus !== "ready" || session.activeTurn || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "idle" }, playback: null,
        activeTurn: { id: session.nextTurnId, move: action.move, kind: "manual" },
        nextTurnId: session.nextTurnId + 1,
      };
    case "undo": {
      const lastMove = session.history.at(-1);
      if (session.sceneStatus !== "ready" || session.activeTurn || !lastMove || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "idle" }, playback: null,
        activeTurn: { id: session.nextTurnId, move: inverseMove(lastMove), kind: "undo" },
        nextTurnId: session.nextTurnId + 1,
      };
    }
    case "scramble": {
      const first = action.moves[0];
      if (session.sceneStatus !== "ready" || session.activeTurn || !first || session.search.status === "running") return session;
      return {
        ...session,
        search: { status: "idle" }, playback: null,
        scramble: { moves: [...action.moves], completed: 0 },
        activeTurn: { id: session.nextTurnId, move: first, kind: "scramble" },
        nextTurnId: session.nextTurnId + 1,
      };
    }
    case "complete": {
      // Commit exactly once; navigation/scramble schedule the next turn atomically.
      // A demonstration never commits its visual starting snapshot or move.
      if (!session.activeTurn || session.activeTurn.id !== action.id) return session;
      if (session.activeTurn.kind === "replay") {
        const playback = session.playback;
        return { ...session, activeTurn: null, playback: playback && playback.expectedState !== session.puzzle
          ? { ...playback, status: "failed", target: null } : playback };
      }
      if (session.activeTurn.kind === "solution" || session.activeTurn.kind === "solution-back") {
        const playback = session.playback;
        if (!playback || playback.status === "failed" || playback.expectedState !== session.puzzle) {
          return { ...session, activeTurn: null, playback: playback ? { ...playback, status: "failed", target: null } : null };
        }
        const backwards = session.activeTurn.kind === "solution-back";
        const puzzle = applyMove(session.puzzle, session.activeTurn.move);
        const completed = playback.completed + (backwards ? -1 : 1);
        const committed: TurnSession = {
          ...session, puzzle, activeTurn: null,
          history: backwards ? session.history.slice(0, -1) : [...session.history, session.activeTurn.move],
          playback: {
            ...playback, completed, expectedState: puzzle, target: null,
            status: completed === playback.moves.length ? (isSolved(puzzle) ? "complete" : "failed") : "ready",
          },
        };
        return playback.target !== null && completed !== playback.target
          ? navigateSolution(committed, playback.target) : committed;
      }
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
