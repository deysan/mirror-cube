import { useEffect, useRef } from "react";
import type { Messages } from "../i18n/messages";
import type { PendingTurn, SolutionPlayback, SolutionSearch } from "../interaction/turnSession";

interface SolutionPanelProps {
  readonly search: SolutionSearch;
  readonly disabled: boolean;
  readonly playback: SolutionPlayback | null;
  readonly activeTurn: PendingTurn | null;
  readonly onNext: () => void;
  readonly onGo: (completed: number) => void;
  readonly onReplay: () => void;
  readonly onFind: () => void;
  readonly onCancel: () => void;
  readonly text: Messages;
}

function description(search: SolutionSearch, playback: SolutionPlayback | null, text: Messages): string {
  if (playback?.status === "complete") return text.solutionComplete;
  if (playback?.status === "failed") return text.playbackFailed;
  switch (search.status) {
    case "idle": return text.searchIdle;
    case "running": return text.searchRunning;
    case "cancelled": return text.searchCancelled;
    case "done": {
      const result = search.result;
      switch (result.status) {
        case "solution": return result.moves.length === 0 ? text.searchSolved : `${text.solutionCount}: ${result.moves.length}`;
        case "cancelled": return text.searchCancelled;
        case "limit": return `${text.searchLimit} ${text.searchLimits[result.reason]}`;
        case "error": return result.reason === "timeout" ? text.searchTimeout : text.searchError;
        case "invalid": return `${text.searchInvalid} ${text.stateErrors[result.error.code]}${result.error.cornerIndex === undefined
          ? "" : ` ${text.invalidCorner}: ${result.error.cornerIndex + 1}.`}`;
      }
    }
  }
}

export function SolutionPanel({ search, playback, activeTurn, disabled, onNext, onGo, onReplay, onFind, onCancel, text }: SolutionPanelProps) {
  const moves = playback?.moves ?? (search.status === "done" && search.result.status === "solution" ? search.result.moves : []);
  const next = playback?.status === "ready" ? moves[playback.completed] : undefined;
  const replaying = activeTurn?.kind === "replay";
  const backwards = activeTurn?.kind === "solution-back";
  const animating = activeTurn?.kind === "solution" || backwards;
  const currentIndex = playback && (replaying || backwards) ? playback.completed - 1
    : next && playback ? playback.completed : -1;
  const instructionMove = replaying || backwards ? activeTurn.move : next;
  const canNavigate = playback !== null && playback.status !== "failed";
  const activity = replaying ? text.replayingStep : backwards ? text.rewindingStep : text.solutionStep;
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Reveal the current row only inside the list; never pull the page away from the canvas.
    const list = listRef.current, row = currentRef.current;
    if (!list || !row) return;
    const bounds = list.getBoundingClientRect(), current = row.getBoundingClientRect();
    if (current.top < bounds.top) list.scrollTop += current.top - bounds.top;
    else if (current.bottom > bounds.bottom) list.scrollTop += current.bottom - bounds.bottom;
  }, [currentIndex, playback?.status, text]);
  return (
    <section className="solution-panel" aria-labelledby="solution-title">
      <h2 id="solution-title">{text.solutionTitle}</h2>
      <p>{text.searchHint}</p>
      <div className="search-actions">
        <button type="button" onClick={onFind} disabled={disabled}>{text.findSolution}</button>
        {search.status === "running" && <button type="button" onClick={onCancel}>{text.cancelSearch}</button>}
      </div>
      <p aria-live="polite" aria-atomic="true">{replaying ? `${text.replayingStep} ${playback?.completed}`
        : backwards ? text.rewindingStep : description(search, playback, text)}</p>
      {moves.length > 0 && (
        <>
          <p>{text.solutionHint}</p>
          {playback && (
            <>
              <p className="solution-progress" aria-live="polite" aria-atomic="true">
                {text.solutionProgress}: {playback.completed}/{moves.length}
              </p>
              {playback.target !== null && <p role="status">{text.goToStep}: {playback.target}/{moves.length}</p>}
              {instructionMove && (
                <div className="solution-instruction" aria-live="polite" aria-atomic="true">
                  <strong>{activity} {currentIndex + 1}/{moves.length}</strong>
                  <p>{instructionMove.face} · {text.faceNames[instructionMove.face]} · {text.turnOptions[instructionMove.turns]}</p>
                  <p>{text.playbackOrientation}</p>
                  {animating && <p>{text.stepInProgress}</p>}
                </div>
              )}
              <div className="search-actions playback-actions">
                <button type="button" onClick={onNext} disabled={disabled || !next}>{text.nextSolutionStep}</button>
                <button type="button" onClick={onReplay} disabled={disabled || !canNavigate || playback.completed === 0}>
                  {text.replayStep}{playback.completed > 0 ? ` ${playback.completed}` : ""}
                </button>
                <button type="button" onClick={() => onGo(0)} disabled={disabled || !canNavigate || playback.completed === 0}>
                  {text.solutionStart}
                </button>
              </div>
              <p>{text.replayHint}</p>
            </>
          )}
          <ol ref={listRef} tabIndex={0} aria-label={text.solutionMoves}>
            {moves.map((move, index) => {
              const current = index === currentIndex;
              const completed = playback !== null && index < playback.completed;
              return (
                <li key={index} ref={current ? currentRef : undefined} aria-current={current ? "step" : undefined}>
                  <button type="button" className="solution-step" onClick={() => onGo(index + 1)}
                    disabled={disabled || !canNavigate || playback?.completed === index + 1}
                    aria-label={`${text.goToStep} ${index + 1}: ${move.face} · ${text.faceNames[move.face]} · ${text.turnOptions[move.turns]}`}>
                    <span>{index + 1}.</span>
                    <span>
                      <code>{move.face}{move.turns === -1 ? "′" : move.turns === 2 ? "2" : ""}</code>
                      <span>{text.faceNames[move.face]} · {text.turnOptions[move.turns]}</span>
                      {(current || completed) && <small className="solution-step-state">{current ? text.stepCurrent : text.stepCompleted}</small>}
                      {playback?.completed === index + 1 && <small className="solution-step-state">{text.currentPosition}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
