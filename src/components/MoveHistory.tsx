import type { Messages } from "../i18n/messages";
import type { Move } from "../puzzle/moves";

interface MoveHistoryProps {
  readonly history: readonly Move[];
  readonly disabled: boolean;
  readonly onUndo: () => void;
  readonly text: Messages;
}

export function MoveHistory({ history, disabled, onUndo, text }: MoveHistoryProps) {
  return (
    <section className="move-history" aria-labelledby="history-title">
      <h2 id="history-title">{text.historyTitle}</h2>
      <p>{text.historyCount}: {history.length}</p>
      <button type="button" disabled={disabled || history.length === 0} onClick={onUndo}>
        {text.undoLastMove}
      </button>
      {history.length === 0 ? <p>{text.historyEmpty}</p> : (
        <>
          <p>{text.historyHint}</p>
          <ol reversed start={history.length} tabIndex={0} aria-label={text.historyTitle}>
            {[...history].reverse().map((move, index) => (
              <li key={history.length - index}>
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
