import type { Messages } from "../i18n/messages";
import type { SolutionSearch } from "../interaction/turnSession";

interface SolutionPanelProps {
  readonly search: SolutionSearch;
  readonly disabled: boolean;
  readonly onFind: () => void;
  readonly onCancel: () => void;
  readonly text: Messages;
}

function description(search: SolutionSearch, text: Messages): string {
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

export function SolutionPanel({ search, disabled, onFind, onCancel, text }: SolutionPanelProps) {
  const moves = search.status === "done" && search.result.status === "solution" ? search.result.moves : [];
  return (
    <section className="solution-panel" aria-labelledby="solution-title">
      <h2 id="solution-title">{text.solutionTitle}</h2>
      <p>{text.searchHint}</p>
      <div className="search-actions">
        <button type="button" onClick={onFind} disabled={disabled}>{text.findSolution}</button>
        {search.status === "running" && <button type="button" onClick={onCancel}>{text.cancelSearch}</button>}
      </div>
      <p aria-live="polite" aria-atomic="true">{description(search, text)}</p>
      {moves.length > 0 && (
        <>
          <p>{text.solutionHint}</p>
          <ol tabIndex={0} aria-label={text.solutionMoves}>
            {moves.map((move, index) => (
              <li key={index}>
                <code>{move.face}{move.turns === -1 ? "′" : move.turns === 2 ? "2" : ""}</code>
                <span>{text.faceNames[move.face]} · {text.turnOptions[move.turns]}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
