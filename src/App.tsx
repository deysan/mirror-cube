import { useEffect, useState } from "react";
import { CubeView } from "./components/CubeView";
import { LANGUAGES, messages, type Language } from "./i18n/messages";
import { createSolvedCube } from "./puzzle/model";

const axes = ["x", "y", "z"] as const;

export function App() {
  const [cube] = useState(createSolvedCube);
  const [language, setLanguage] = useState<Language>("en");
  const text = messages[language];

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
        <figure className="puzzle-card">
          <div className="view-heading">
            <span className="status">{text.solvedState}</span>
            <span>{text.viewLabel}</span>
          </div>
          <CubeView cube={cube} title={text.cubeTitle} description={text.cubeDescription} />
          <figcaption>{text.caption}</figcaption>
        </figure>

        <aside className="details" aria-labelledby="geometry-title">
          <p className="eyebrow">{text.geometryEyebrow}</p>
          <h2 id="geometry-title">{text.geometryTitle}</h2>
          <p>{text.geometryDescription}</p>
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
