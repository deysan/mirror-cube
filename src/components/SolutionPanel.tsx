import { useEffect, useRef } from "react";
import type { Messages } from "../i18n/messages";
import type { SolutionPlayback, SolutionSearch } from "../interaction/turnSession";

interface SolutionPanelProps {
  readonly search: SolutionSearch;
  readonly disabled: boolean;
  readonly playback: SolutionPlayback | null;
  readonly animating: boolean;
  readonly onNext: () => void;
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

export function SolutionPanel({ search, playback, animating, disabled, onNext, onFind, onCancel, text }: SolutionPanelProps) {
  const moves = playback?.moves ?? (search.status === "done" && search.result.status === "solution" ? search.result.moves : []);
  const next = playback?.status === "ready" ? moves[playback.completed] : undefined;
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Reveal the current row only inside the list; never pull the page away from the canvas.
    const list = listRef.current, row = currentRef.current;
    if (!list || !row) return;
    const bounds = list.getBoundingClientRect(), current = row.getBoundingClientRect();
    if (current.top < bounds.top) list.scrollTop += current.top - bounds.top;
    else if (current.bottom > bounds.bottom) list.scrollTop += current.bottom - bounds.bottom;
  }, [playback?.completed, playback?.status, text]);
  return (
    <section className="solution-panel" aria-labelledby="solution-title">
      <h2 id="solution-title">{text.solutionTitle}</h2>
      <p>{text.searchHint}</p>
      <div className="search-actions">
        <button type="button" onClick={onFind} disabled={disabled}>{text.findSolution}</button>
        {search.status === "running" && <button type="button" onClick={onCancel}>{text.cancelSearch}</button>}
      </div>
      <p aria-live="polite" aria-atomic="true">{description(search, playback, text)}</p>
      {moves.length > 0 && (
        <>
          <p>{text.solutionHint}</p>
          {playback && (
            <>
              <p className="solution-progress" aria-live="polite" aria-atomic="true">
                {text.solutionProgress}: {playback.completed}/{moves.length}
              </p>
              {next && (
                <div className="solution-instruction" aria-live="polite" aria-atomic="true">
                  <strong>{text.solutionStep} {playback.completed + 1}/{moves.length}</strong>
                  <p>{next.face} · {text.faceNames[next.face]} · {text.turnOptions[next.turns]}</p>
                  <p>{text.playbackOrientation}</p>
                  {animating && <p>{text.stepInProgress}</p>}
                </div>
              )}
              <div className="search-actions playback-actions">
                <button type="button" onClick={onNext} disabled={disabled || !next}>{text.nextSolutionStep}</button>
              </div>
            </>
          )}
          <ol ref={listRef} tabIndex={0} aria-label={text.solutionMoves}>
            {moves.map((move, index) => {
              const current = playback?.status === "ready" && index === playback.completed;
              const completed = playback !== null && index < playback.completed;
              return (
                <li key={index} ref={current ? currentRef : undefined} aria-current={current ? "step" : undefined}>
                  <code>{move.face}{move.turns === -1 ? "′" : move.turns === 2 ? "2" : ""}</code>
                  <span>{text.faceNames[move.face]} · {text.turnOptions[move.turns]}</span>
                  {(current || completed) && <small className="solution-step-state">{completed ? text.stepCompleted : text.stepCurrent}</small>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
