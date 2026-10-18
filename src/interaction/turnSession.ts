import { applyMove, inverseMove, type Move } from "../puzzle/moves";
import type { PuzzleState } from "../puzzle/state";

export interface PendingTurn {
  readonly id: number;
  readonly move: Move;
  readonly kind: "manual" | "undo";
}

export interface TurnSession {
  readonly puzzle: PuzzleState;
  readonly history: readonly Move[];
  readonly activeTurn: PendingTurn | null;
  readonly sceneStatus: "loading" | "ready" | "failed";
  readonly nextTurnId: number;
}

export type TurnAction =
  | { readonly type: "scene-ready" }
  | { readonly type: "scene-failed" }
  | { readonly type: "start"; readonly move: Move }
  | { readonly type: "undo" }
  | { readonly type: "complete"; readonly id: number };

export function createTurnSession(puzzle: PuzzleState): TurnSession {
  return { puzzle, history: [], activeTurn: null, sceneStatus: "loading", nextTurnId: 1 };
}

/** UI transaction state, separate from both puzzle rules and animation frames. */
export function turnSessionReducer(session: TurnSession, action: TurnAction): TurnSession {
  switch (action.type) {
    case "scene-ready":
      return session.sceneStatus === "loading" ? { ...session, sceneStatus: "ready" } : session;
    case "scene-failed":
      // Cancel an unfinished visual turn; the committed puzzle is still unchanged.
      return { ...session, sceneStatus: "failed", activeTurn: null };
    case "start":
      if (session.sceneStatus !== "ready" || session.activeTurn) return session;
      return {
        ...session,
        activeTurn: { id: session.nextTurnId, move: action.move, kind: "manual" },
        nextTurnId: session.nextTurnId + 1,
      };
    case "undo": {
      const lastMove = session.history.at(-1);
      if (session.sceneStatus !== "ready" || session.activeTurn || !lastMove) return session;
      return {
        ...session,
        activeTurn: { id: session.nextTurnId, move: inverseMove(lastMove), kind: "undo" },
        nextTurnId: session.nextTurnId + 1,
      };
    }
    case "complete":
      // Ignore duplicate/stale callbacks, including one arriving during a later turn.
      if (!session.activeTurn || session.activeTurn.id !== action.id) return session;
      return {
        ...session,
        puzzle: applyMove(session.puzzle, session.activeTurn.move),
        history: session.activeTurn.kind === "undo"
          ? session.history.slice(0, -1)
          : [...session.history, session.activeTurn.move],
        activeTurn: null,
      };
  }
}
