import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CubeView } from "./components/CubeView";
import { MoveControls } from "./components/MoveControls";
import { MoveHistory } from "./components/MoveHistory";
import { createTurnSession, turnSessionReducer } from "./interaction/turnSession";
import type { Move } from "./puzzle/moves";
import { LANGUAGES, messages, type Language } from "./i18n/messages";
import { createSolvedCube } from "./puzzle/model";
import { createSolvedState } from "./puzzle/state";
import { createScramble } from "./puzzle/scramble";

const axes = ["x", "y", "z"] as const;

export function App() {
  const [cube] = useState(createSolvedCube);
  const [session, dispatch] = useReducer(turnSessionReducer, cube, (definition) =>
    createTurnSession(createSolvedState(definition)),
  );
  const [language, setLanguage] = useState<Language>("en");
  const text = messages[language];
  const viewRef = useRef<HTMLElement>(null);
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
  const controlsDisabled = session.sceneStatus !== "ready" || session.activeTurn !== null;
  const move = session.activeTurn?.move;
  const turnLabel = session.scramble
    ? `${text.scrambling} ${session.scramble.completed + 1}/${session.scramble.moves.length}`
    : session.activeTurn?.kind === "undo" ? text.undoing : text.turning;
  const status = session.sceneStatus === "failed" ? text.sceneFailed
    : session.sceneStatus === "loading" ? text.sceneLoading
    : move ? `${turnLabel}: ${move.face} · ${text.faceNames[move.face]} · ${text.turnOptions[move.turns]}`
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

      <section className="puzzle-layout" aria-label={text.overviewLabel}>
        <figure className="puzzle-card" ref={viewRef}>
          <div className="view-heading">
            <span className="status" aria-live="polite" aria-atomic="true">{status}</span>
            <span>{text.viewLabel}</span>
          </div>
          <CubeView
            cube={cube}
            state={session.puzzle}
            activeTurn={session.activeTurn}
            onTurnComplete={onTurnComplete}
            onReady={onReady}
            onFailure={onFailure}
            failed={session.sceneStatus === "failed"}
            title={text.cubeTitle}
            description={text.cubeDescription}
            unavailableMessage={text.sceneUnavailable}
          />
          <figcaption>{text.caption}</figcaption>
        </figure>

        <aside className="details">
          <MoveControls
            text={text}
            disabled={controlsDisabled}
            onMove={onMove}
            onScramble={onScramble}
          />
          <MoveHistory
            text={text}
            history={session.history}
            disabled={controlsDisabled}
            onUndo={onUndo}
          />
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
