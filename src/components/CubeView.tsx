import { Component, useId, type ReactNode } from "react";
import type { PendingTurn } from "../interaction/turnSession";
import type { SolvedCube } from "../puzzle/model";
import type { PuzzleState } from "../puzzle/state";
import { CubeScene } from "./CubeScene";

interface CubeViewProps {
  readonly cube: SolvedCube;
  readonly state: PuzzleState;
  readonly activeTurn: PendingTurn | null;
  readonly onTurnComplete: (id: number) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
  readonly failed: boolean;
  readonly title: string;
  readonly description: string;
  readonly unavailableMessage: string;
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CubeView({
  cube, state, activeTurn, onTurnComplete, onReady, onFailure, failed,
  title, description, unavailableMessage,
}: CubeViewProps) {
  const descriptionId = useId();
  const fallback = <p className="cube-fallback" role="status">{unavailableMessage}</p>;

  return (
    <div className="cube-view">
      <span id={descriptionId} hidden>{description}</span>
      {failed ? fallback : (
        <SceneBoundary fallback={fallback} onFailure={onFailure}>
          <div className="cube-scene" role="img" aria-label={title} aria-describedby={descriptionId}>
            <CubeScene
              cube={cube} state={state} activeTurn={activeTurn}
              onTurnComplete={onTurnComplete} onReady={onReady} onFailure={onFailure}
            />
          </div>
        </SceneBoundary>
      )}
    </div>
  );
}
