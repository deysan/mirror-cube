import { CubeView } from "./components/CubeView";
import { createSolvedCube } from "./puzzle/model";

const cube = createSolvedCube();
const axes = ["x", "y", "z"] as const;

export function App() {
  return (
    <main className="app">
      <header className="page-header">
        <p className="wordmark">MirrorCube <span>2×2</span></p>
        <h1>A different shape of puzzle.</h1>
        <p className="intro">
          The same finish. Eight different shapes. Get to know your Mirror Cube,
          starting with its solved form.
        </p>
      </header>

      <section className="puzzle-layout" aria-label="Solved puzzle overview">
        <figure className="puzzle-card">
          <div className="view-heading">
            <span className="status">Solved state</span>
            <span>Fixed isometric view</span>
          </div>
          <CubeView cube={cube} />
          <figcaption>
            The lines are not centered — each piece has its own dimensions.
          </figcaption>
        </figure>

        <aside className="details" aria-labelledby="geometry-title">
          <p className="eyebrow">Meet the geometry</p>
          <h2 id="geometry-title">One cube.<br />Eight distinct pieces.</h2>
          <p>
            Unlike a color-based cube, a Mirror Cube is solved by shape. All outer
            surfaces line up when the pieces are in place.
          </p>
          <dl className="measurements">
            <div>
              <dt>Cube edge</dt>
              <dd>{cube.edgeLength} mm</dd>
            </div>
            {axes.map((axis) => (
              <div key={axis}>
                <dt>{axis.toUpperCase()} layers</dt>
                <dd>{cube.splits[axis]} / {cube.edgeLength - cube.splits[axis]} mm</dd>
              </div>
            ))}
          </dl>
          <p className="stage-note">
            This first view shows the solved geometry. Turns and step-by-step
            instructions are not available yet.
          </p>
        </aside>
      </section>
    </main>
  );
}
