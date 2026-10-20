import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CubeView } from "./components/CubeView";
import { MoveControls } from "./components/MoveControls";
import { MoveHistory } from "./components/MoveHistory";
import { SolutionPanel } from "./components/SolutionPanel";
import { StateBuilder, slotCode } from "./components/StateBuilder";
import { draftCorners } from "./puzzle/draft";
import type { PieceId } from "./puzzle/model";
import { useSolverWorker } from "./interaction/useSolverWorker";
import type { SolverResponse } from "./solver/workerProtocol";
import { createTurnSession, turnSessionReducer } from "./interaction/turnSession";
import type { Move } from "./puzzle/moves";
import { LANGUAGES, messages, type Language } from "./i18n/messages";
import { createSolvedCube, MIRRORED_CUBE_PARAMETERS } from "./puzzle/model";
import { createSolvedState } from "./puzzle/state";
import { createScramble } from "./puzzle/scramble";
import "./editor.css";

const axes = ["x", "y", "z"] as const;

export function App() {
  const [cube] = useState(() => createSolvedCube(MIRRORED_CUBE_PARAMETERS));
  const [session, dispatch] = useReducer(turnSessionReducer, cube, (definition) =>
    createTurnSession(createSolvedState(definition)),
  );
  const [language, setLanguage] = useState<Language>("en");
  const text = messages[language];
  const viewRef = useRef<HTMLElement>(null);
  const builderButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const [selectedSlot, setSelectedSlot] = useState<PieceId>("+++");
  const [viewCorner, setViewCorner] = useState<PieceId>("+++");
  const draftPreview = useMemo(() => session.editor ? { corners: draftCorners(session.editor) } : null, [session.editor]);
  const onReady = useCallback(() => dispatch({ type: "scene-ready" }), []);
  const onFailure = useCallback(() => dispatch({ type: "scene-failed" }), []);
  const onTurnComplete = useCallback((id: number) => dispatch({ type: "complete", id }), []);
  const showCanvas = useCallback(() => {
    // On small screens the controls can be below the cube; keep the movement visible.
    const canvas = viewRef.current?.querySelector("canvas");
    if (canvas) {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        canvas.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
  }, []);
  const onMove = useCallback((move: Move) => {
    dispatch({ type: "start", move });
    showCanvas();
  }, [showCanvas]);
  const onUndo = useCallback(() => {
    dispatch({ type: "undo" });
    showCanvas();
  }, [showCanvas]);
  const onScramble = useCallback(() => {
    // Sample once in the event handler, not in a reducer or an effect.
    dispatch({ type: "scramble", moves: createScramble() });
    showCanvas();
  }, [showCanvas]);
  const onNextSolutionStep = useCallback(() => {
    dispatch({ type: "solution-next" });
    showCanvas();
  }, [showCanvas]);
  const onGoSolutionStep = useCallback((completed: number) => {
    dispatch({ type: "solution-go", completed });
    showCanvas();
  }, [showCanvas]);
  const onReplaySolutionStep = useCallback(() => {
    dispatch({ type: "solution-replay" });
    showCanvas();
  }, [showCanvas]);
  const onFind = useCallback(() => dispatch({ type: "find-solution" }), []);
  const onCancelSearch = useCallback(() => dispatch({ type: "cancel-search" }), []);
  const onSearchResult = useCallback((response: SolverResponse) => dispatch({ type: "search-result", response }), []);
  useSolverWorker(session.search.status === "running" ? session.search.request : null, onSearchResult);
  const controlsDisabled = session.editor !== null || session.sceneStatus !== "ready" || session.activeTurn !== null || session.search.status === "running";
  useEffect(() => {
    if (!wasEditing.current && session.editor) showCanvas();
    if (wasEditing.current && !session.editor) {
      builderButton.current?.focus({ preventScroll: true });
      showCanvas();
    }
    wasEditing.current = session.editor !== null;
  }, [session.editor, showCanvas]);
  const move = session.activeTurn?.move;
  const turnLabel = session.scramble
    ? `${text.scrambling} ${session.scramble.completed + 1}/${session.scramble.moves.length}`
    : session.activeTurn?.kind === "replay" && session.playback
      ? `${text.replayingStep} ${session.playback.completed}/${session.playback.moves.length}`
    : session.activeTurn?.kind === "solution-back" && session.playback
      ? `${text.rewindingStep} ${session.playback.completed}/${session.playback.moves.length}`
    : session.activeTurn?.kind === "solution" && session.playback
      ? `${text.solutionStep} ${session.playback.completed + 1}/${session.playback.moves.length}`
      : session.activeTurn?.kind === "undo" ? text.undoing : text.turning;
  const status = session.sceneStatus === "failed" ? text.sceneFailed
    : session.sceneStatus === "loading" ? text.sceneLoading
    : session.editor ? text.editor.draft
    : move ? `${turnLabel}: ${move.face} · ${text.faceNames[move.face]} · ${text.turnOptions[move.turns]}`
    : session.search.status === "running" ? text.searching
    : text.readyToTurn;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = text.documentTitle;
    document.querySelector('meta[name="description"]')
      ?.setAttribute("content", text.documentDescription);
  }, [language, text]);

  return (
    <main className="app">
      <header className="page-header">
        <div className="header-toolbar">
          <p className="wordmark">MirrorCube <span>2×2</span></p>
          <div className="language-switcher" role="group" aria-label={text.languageLabel}>
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={language === code}
                onClick={() => setLanguage(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <h1>{text.heroTitle}</h1>
        <p className="intro">{text.intro}</p>
      </header>

      <section className={`puzzle-layout${session.editor ? " builder-layout" : ""}`} aria-label={text.overviewLabel}>
        <figure className="puzzle-card" ref={viewRef}>
          <div className="view-heading">
            <span className="status" aria-live="polite" aria-atomic="true">{status}</span>
            <span>{session.editor ? `${text.editor.view}: ${slotCode(viewCorner)}` : text.viewLabel}</span>
          </div>
          <CubeView
            cube={cube}
            state={draftPreview ?? (session.activeTurn?.kind === "replay" ? session.activeTurn.previewState : session.puzzle)}
            editor={session.editor ? { selectedSlot, viewCorner, onSelect: setSelectedSlot } : undefined}
            activeTurn={session.activeTurn}
            onTurnComplete={onTurnComplete}
            onReady={onReady}
            onFailure={onFailure}
            failed={session.sceneStatus === "failed"}
            unit={text.millimeters}
            title={text.cubeTitle}
            description={session.editor ? text.editor.description : text.cubeDescription}
            unavailableMessage={text.sceneUnavailable}
          />
          <figcaption>{session.editor ? `${text.editor.selected}: ${slotCode(selectedSlot)}` : text.caption}</figcaption>
        </figure>

        <aside className="details">
          {session.editor ? <StateBuilder cube={cube} draft={session.editor} selected={selectedSlot}
            onSelect={setSelectedSlot} dispatch={dispatch} text={text} disabled={session.sceneStatus !== "ready"}
            view={viewCorner} onView={setViewCorner} /> : <>
          <div className="search-actions builder-entry">
            <button type="button" ref={builderButton} disabled={controlsDisabled} onClick={() => {
              setSelectedSlot("+++"); setViewCorner("+++");
              dispatch({ type: "editor-open" });
            }}>{text.editor.open}</button>
          </div>
          <MoveControls
            text={text}
            disabled={controlsDisabled}
            onMove={onMove}
            onScramble={onScramble}
          />
          <div className="search-actions reset-controls">
            <button type="button" disabled={controlsDisabled} onClick={() => {
              if (window.confirm(text.resetWarning)) {
                dispatch({ type: "reset", state: createSolvedState(cube) });
                showCanvas();
              }
            }}>{text.resetCube}</button>
          </div>
          <SolutionPanel
            text={text}
            search={session.search}
            playback={session.playback}
            activeTurn={session.activeTurn}
            onNext={onNextSolutionStep}
            onGo={onGoSolutionStep}
            onReplay={onReplaySolutionStep}
            disabled={controlsDisabled}
            onFind={onFind}
            onCancel={onCancelSearch}
          />
          <MoveHistory
            text={text}
            history={session.history}
            disabled={controlsDisabled}
            onUndo={onUndo}
          />
          </>}
          <p className="eyebrow">{text.geometryEyebrow}</p>
          <h2 id="geometry-title">{text.geometryTitle}</h2>
          <p>{text.geometryDescription}</p>
          <h3>{text.measurementsTitle}</h3>
          <dl className="measurements">
            <div>
              <dt>{text.cubeEdge}</dt>
              <dd>{cube.edgeLength} {text.millimeters}</dd>
            </div>
            {axes.map((axis) => (
              <div key={axis}>
                <dt>{text.axisLayers[axis]}</dt>
                <dd>{cube.splits[axis]} / {cube.edgeLength - cube.splits[axis]} {text.millimeters}</dd>
              </div>
            ))}
          </dl>
          <p className="stage-note">{text.stageNote}</p>
        </aside>
      </section>
    </main>
  );
}
