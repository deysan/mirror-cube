import { Component, useId, type ReactNode } from "react";
import type { SolvedCube } from "../puzzle/model";
import type { PuzzleState } from "../puzzle/state";
import { CubeScene } from "./CubeScene";

interface CubeViewProps {
  readonly cube: SolvedCube;
  readonly state: PuzzleState;
  readonly title: string;
  readonly description: string;
  readonly unavailableMessage: string;
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CubeView({ cube, state, title, description, unavailableMessage }: CubeViewProps) {
  const descriptionId = useId();

  return (
    <div className="cube-view">
      <span id={descriptionId} hidden>{description}</span>
      <SceneBoundary fallback={<p className="cube-fallback" role="status">{unavailableMessage}</p>}>
        <div className="cube-scene" role="img" aria-label={title} aria-describedby={descriptionId}>
          <CubeScene cube={cube} state={state} />
        </div>
      </SceneBoundary>
    </div>
  );
}
