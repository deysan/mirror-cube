import { useState } from "react";
import type { Messages } from "../i18n/messages";
import type { Move } from "../puzzle/moves";

interface MoveControlsProps {
  readonly text: Messages;
  readonly disabled: boolean;
  readonly onMove: (move: Move) => void;
}

export function MoveControls({ text, disabled, onMove }: MoveControlsProps) {
  const [turns, setTurns] = useState<Move["turns"]>(1);

  return (
    <section className="move-controls" aria-labelledby="controls-title">
      <h2 id="controls-title">{text.controlsTitle}</h2>
      <fieldset disabled={disabled}>
        <legend>{text.angleLabel}</legend>
        <div className="turn-options">
          {([1, -1, 2] as const).map((value) => (
            <label key={value}>
              <input type="radio" name="turn-angle" checked={turns === value} onChange={() => setTurns(value)} />
              {text.turnOptions[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>{text.faceLabel}</legend>
        <div className="face-buttons">
          {(["U", "D", "L", "R", "F", "B"] as const).map((face) => (
            <button key={face} type="button" onClick={() => onMove({ face, turns })}>
              <strong>{face}</strong> {text.faceNames[face]}
            </button>
          ))}
        </div>
      </fieldset>
      <p>{text.directionHint}</p>
      <p>{text.orientationHint}</p>
    </section>
  );
}
