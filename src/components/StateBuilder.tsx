import { useEffect, useRef } from "react";
import type { Messages } from "../i18n/messages";
import type { TurnAction } from "../interaction/turnSession";
import { PIECE_IDS } from "../puzzle/corners";
import { placementDimensions, validateDraft, type PuzzleDraft } from "../puzzle/draft";
import type { Piece, PieceId, SolvedCube } from "../puzzle/model";
import type { Face } from "../puzzle/moves";

export const EDITOR_SLOTS: readonly PieceId[] = ["-++", "+++", "-+-", "++-", "--+", "+-+", "---", "+--"];
export function slotFaces(slot: PieceId): readonly Face[] {
  return [slot[1] === "+" ? "U" : "D", slot[2] === "+" ? "F" : "B", slot[0] === "+" ? "R" : "L"];
}
export const slotCode = (slot: PieceId) => slotFaces(slot).join("");
const pieceNumber = (id: PieceId) => PIECE_IDS.indexOf(id) + 1;
const dimensions = (piece: Piece) => `${piece.dimensions.x} × ${piece.dimensions.y} × ${piece.dimensions.z}`;

/** Common-scale orthographic thumbnails, not state geometry or a second puzzle renderer. */
function PieceThumbnail({ piece }: { piece: Piece }) {
  const { x, y, z } = piece.dimensions;
  const points = (vertices: readonly number[][]) => vertices.map(([a = 0, b = 0, c = 0]) =>
    `${(a - c) * Math.SQRT1_2},${(a + c - 2 * b) / Math.sqrt(6)}`).join(" ");
  return <svg viewBox="-26 -28 52 57" aria-hidden="true" focusable="false">
    <g stroke="#263541" strokeWidth="0.5" strokeLinejoin="round">
      <polygon fill="#dbe6ec" points={points([[0,y,0],[x,y,0],[x,y,z],[0,y,z]])} />
      <polygon fill="#9fb0bd" points={points([[x,0,0],[x,0,z],[x,y,z],[x,y,0]])} />
      <polygon fill="#bdcbd6" points={points([[0,0,z],[x,0,z],[x,y,z],[0,y,z]])} />
    </g>
  </svg>;
}

function BuilderViewControls({ text, view, selected, onView, disabled }: {
  text: Messages; view: PieceId; selected: PieceId; onView: (slot: PieceId) => void; disabled: boolean;
}) {
  return <div className="builder-view-controls">
    <p>{text.editor.cameraHint}</p>
    <div className="builder-camera-grid" role="group" aria-label={text.editor.camera}>
      {EDITOR_SLOTS.map(slot => <button type="button" key={slot} disabled={disabled} aria-pressed={view === slot}
        aria-label={`${text.editor.view} ${slotCode(slot)}: ${slotFaces(slot).map(f => text.faceNames[f]).join(" / ")}`}
        onClick={() => onView(slot)}>{slotCode(slot)}</button>)}
    </div>
    <div className="builder-camera-grid">
      <button type="button" disabled={disabled} onClick={() => onView("+++")}>{text.editor.solutionView}</button>
      <button type="button" disabled={disabled} onClick={() => onView(selected)}>{text.editor.lookSelected}</button>
    </div>
  </div>;
}

export function StateBuilder({ cube, draft, selected, onSelect, dispatch, text, disabled, view, onView }: {
  cube: SolvedCube; draft: PuzzleDraft; selected: PieceId; onSelect: (slot: PieceId) => void;
  view: PieceId; onView: (slot: PieceId) => void;
  dispatch: (action: TurnAction) => void; text: Messages; disabled: boolean;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const t = text.editor;
  const placement = draft[PIECE_IDS.indexOf(selected)];
  const piece = cube.pieces.find(p => p.id === placement?.pieceId);
  const lengths = placement && piece ? placementDimensions(piece, selected, placement.twist) : null;
  const count = draft.filter(Boolean).length;
  const validation = validateDraft(draft);
  const status = validation.valid ? t.valid : validation.error.code === "corner-count" ? t.incomplete
    : validation.error.code === "twist-sum" ? t.twistError : text.stateErrors[validation.error.code];
  const confirmIfPopulated = (message: string, action: TurnAction) => {
    if (count === 0 || window.confirm(message)) dispatch(action);
  };
  return <section className="state-builder" aria-labelledby="builder-title">
    <h2 id="builder-title" tabIndex={-1} ref={title}>{t.title}</h2>
    <p>{t.intro}</p><p>{t.caption}</p><p className="stage-note">{t.frameHint}</p>
    <BuilderViewControls text={text} view={view} selected={selected} onView={onView} disabled={disabled} />
    <fieldset disabled={disabled}>
      <legend>{t.positions}</legend>
      <div className="builder-slot-grid">
        {EDITOR_SLOTS.map(slot => {
          const p = draft[PIECE_IDS.indexOf(slot)];
          return <button type="button" key={slot} aria-pressed={selected === slot} data-slot={slot}
            aria-label={`${slotCode(slot)}: ${slotFaces(slot).map(f => text.faceNames[f]).join(" / ")} · ${p ? `${t.piece} ${pieceNumber(p.pieceId)}` : t.empty}`}
            onClick={() => onSelect(slot)}><strong>{slotCode(slot)}</strong><span>{p ? `${t.piece} ${pieceNumber(p.pieceId)}` : t.empty}</span></button>;
        })}
      </div>
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>{t.palette}</legend>
      <p>{t.selected}: <strong>{slotCode(selected)}</strong> — {slotFaces(selected).map(f => text.faceNames[f]).join(" / ")}</p>
      <div className="builder-palette">
        {cube.pieces.map(candidate => {
          const usedIndex = draft.findIndex(p => p?.pieceId === candidate.id);
          const elsewhere = usedIndex >= 0 && usedIndex !== PIECE_IDS.indexOf(selected);
          return <button type="button" key={candidate.id} data-piece={candidate.id} disabled={elsewhere}
            aria-pressed={placement?.pieceId === candidate.id}
            onClick={() => dispatch({ type: "editor-edit", edit: { type: "assign", slot: selected, pieceId: candidate.id } })}>
            <PieceThumbnail piece={candidate} /><strong>{t.piece} {pieceNumber(candidate.id)}</strong>
            <span>{dimensions(candidate)} {text.millimeters}</span>
            {usedIndex >= 0 && <small>{t.used} {slotCode(PIECE_IDS[usedIndex]!)}</small>}
          </button>;
        })}
      </div>
      <p>{t.reuseHint}</p><p>{t.dimensionHint}</p>
    </fieldset>
    <fieldset disabled={disabled || !placement}>
      <legend>{t.orientation}</legend>
      <p>{t.orientationHint}</p>
      <p>{t.threeOrientations}</p>
      {placement && piece && lengths && <>
        <p><strong>{t.piece} {pieceNumber(piece.id)}</strong> · {t.variant} {placement.twist + 1}/3</p>
        <p>{t.dimensions}:</p>
        <dl className="builder-dimensions">{(["x", "y", "z"] as const).map((axis, i) => {
          const face: Face = axis === "x" ? (selected[0] === "+" ? "R" : "L")
            : axis === "y" ? (selected[1] === "+" ? "U" : "D") : (selected[2] === "+" ? "F" : "B");
          return <div key={axis} className={`dimension-${axis}`}><dt>{face} · {text.faceNames[face]}</dt><dd data-axis={i}>{lengths[axis]} {text.millimeters}</dd></div>;
        })}</dl>
      </>}
      <div className="search-actions">
        <button type="button" onClick={() => dispatch({ type: "editor-edit", edit: { type: "twist", slot: selected } })}>{t.rotate}</button>
        <button type="button" onClick={() => dispatch({ type: "editor-edit", edit: { type: "remove", slot: selected } })}>{t.remove}</button>
      </div>
    </fieldset>
    <div className="builder-validation" role="status" aria-live="polite" aria-atomic="true">
      <strong>{t.count}: {count}/8</strong><p>{status}</p>
    </div>
    <div className="search-actions">
      <button type="button" disabled={disabled || !validation.valid} onClick={() => {
        if (validation.valid && window.confirm(t.confirmWarning)) dispatch({ type: "editor-apply" });
      }}>{t.confirm}</button>
      <button type="button" onClick={() => confirmIfPopulated(t.cancelWarning, { type: "editor-cancel" })}>{t.cancel}</button>
      <button type="button" disabled={disabled} onClick={() => confirmIfPopulated(t.copyWarning, { type: "editor-copy" })}>{t.copy}</button>
      <button type="button" disabled={disabled || count === 0} onClick={() => confirmIfPopulated(t.clearWarning, { type: "editor-clear" })}>{t.clear}</button>
    </div>
  </section>;
}
