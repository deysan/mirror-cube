# MirrorCube

MirrorCube is an interactive, step-by-step guide to solving a 2×2 Mirror Cube. It will show how to hold the puzzle, which half to turn, and what each move does using a 3D view and animations.

The interface supports **English and Ukrainian**. Solution instructions will support both languages when implemented. Repository documentation is written in English.

## Current status

The solved-state puzzle model, discrete move rules, a static Three.js/React Three Fiber scene, and an English/Ukrainian language switcher are implemented. The scene reads piece definitions and their discrete poses. Move controls are not connected to the UI yet: the page shows the solved cube from a fixed isometric camera.

There are no animated turns, solution search, or public deployment yet. The original SVG renderer has been removed. Netlify deployment is deferred until solving and animated step-by-step playback are ready.

## Local setup and checks

Use Node.js 24.15 or later within the 24.x release line (recommended) and npm. All supported Node.js versions are listed in `package.json`; the minimum versions account for the jsdom test environment.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` checks types and writes the production site to `dist`. `npm run preview` serves that build locally; it is not a production hosting service. Use `npm run test:watch` to rerun tests while editing.

## Solved puzzle model

`src/puzzle/model.ts` exports `createSolvedCube(parameters?)`, which constructs eight pieces without React or rendering dependencies. Calling it without arguments uses the owner's confirmed dimensions for their [Cayro 2×2 Mirror Cube](https://bi.ua/ukr/product/zerkalnyy-kubik-rubika-cayro-2h2-8380.html):

| Parameter | Value |
| --- | --- |
| Cube edge length | 50 mm |
| X layers | 22 / 28 mm |
| Y layers | 20 / 30 mm |
| Z layers | 17 / 33 mm |

The owner confirmed these dimensions; the product link identifies the puzzle and is not cited as a manufacturer specification for the layer sizes.

### Coordinates and pieces

All lengths and coordinates use millimeters. The three split planes intersect at `(0, 0, 0)`, so the solved cube occupies `[-22, 28] × [-20, 30] × [-17, 33]`. Its outer geometric center is not the coordinate origin.

Each piece has:

- `id`: its original negative/positive sides along X, Y, Z, such as `-++`. This identifies the piece, not its future position after moves.
- `dimensions`: separate local X, Y, Z lengths, aligned with world axes in the solved state.
- `solvedMin`: the minimum corner of its solved-state box, not its center or a mutable current position.

The maximum corner is `solvedMin + dimensions`, component by component. The resulting dimensions are:

| Piece ID | X (mm) | Y (mm) | Z (mm) |
| --- | --- | --- | --- |
| `---` | 22 | 20 | 17 |
| `--+` | 22 | 20 | 33 |
| `-+-` | 22 | 30 | 17 |
| `-++` | 22 | 30 | 33 |
| `+--` | 28 | 20 | 17 |
| `+-+` | 28 | 20 | 33 |
| `++-` | 28 | 30 | 17 |
| `+++` | 28 | 30 | 33 |

### Validation and current limitations

Parameters must be safe integers in whole millimeters. Edge length must be positive, and each split must be strictly inside the cube and off-center. Invalid numeric parameters throw `RangeError`; fractional values are rejected rather than rounded. If finer measurements are needed, introduce a finer explicit unit instead of rounding them to whole millimeters.

The default dimensions yield eight distinct shapes. Custom parameters are checked for valid off-center splits, but are not required to produce eight shapes distinguishable under rotation.

The model uses ideal rectangular pieces without bevels, gaps, or an internal mechanism. This definition describes the solved geometry; current poses and move rules live in separate modules. Arbitrary-state solved checks are not implemented yet. Data is exposed through TypeScript `readonly` types, not runtime freezing.

`src/puzzle/model.test.ts` checks piece identities, exact dimensions, containment, pairwise non-overlap, total volume, one-millimeter differences, input independence, and parameter validation. Containment, non-overlap, and equal total volume together verify that the pieces fill the cube without gaps.

## Discrete state and turns

- `src/puzzle/state.ts` creates a separate state with each piece's ID, current octant, and orientation.
- `src/puzzle/moves.ts` applies complete 90-degree clockwise/counterclockwise or 180-degree turns on any of the six faces, without mutating input state or piece dimensions.
- `src/puzzle/moves.test.ts` verifies directions, inverses, repeated turns, current-layer membership, and exact geometric invariants.

Completed turns use only coordinate swaps and sign changes, not floating-point angles. The logical octant is not the piece's geometric center. See [the move-model guide](docs/moves.md) for conventions, examples, and the geometry needed for future animation.

## Static 3D view

- `src/rendering/pieceTransform.ts` converts a piece's definition and orientation into a Three.js matrix. It rotates the actual solved center around the split intersection, never using slot signs as distances.
- `src/components/CubeScene.tsx` renders eight boxes with exact local dimensions and edge outlines, using React Three Fiber. Three.js handles depth testing and hidden surfaces.
- `src/components/CubeView.tsx` provides the scene's accessible name/description and a localized fallback if the 3D scene cannot initialize.
- `src/App.tsx` owns the piece definitions and discrete puzzle state, independently of language. These are passed into the view, not reconstructed from meshes.

The fixed orthographic camera looks from positive X, Y, and Z toward the outer cube's geometric center. Positive Y projects upward, positive X down-right, and positive Z down-left. The camera adjusts its zoom when the viewport changes; the puzzle's origin remains at the split intersection. Current framing is designed for the solved cube and must be revisited for animated, shape-changing turns.

Box geometry is centered on each mesh's local origin, then positioned and oriented using its pose matrix. All faces are present; a depth buffer hides the surfaces behind other pieces. Edge outlines visualize divisions without shrinking the pieces or introducing artificial gaps. Ambient and directional lighting provide neutral shading, not photorealistic mirror reflections.

The scene uses on-demand rendering rather than a continuous animation loop. Geometry resources are memoized and disposed when replaced or unmounted. The view is fixed: no drag-to-rotate, move controls, or animation.

WebGL 2 is required. If initialization fails, the scene is replaced by an English/Ukrainian message while measurements and language controls remain available. Reload after resolving the browser/GPU issue; automatic context-loss recovery is not implemented.

Three.js and React Three Fiber increase the production JavaScript bundle size. Vite currently warns about a chunk over 500 kB before compression (approximately 314 kB gzip). The warning is not suppressed; code splitting or lazy loading can be considered when needed.

### Visual verification

1. Run `npm run dev` and open the page.
2. Confirm that the top and two sides form a single cube with four unequal regions per visible surface.
3. Check that the dimensions panel reads 50 mm and 22/28, 20/30, 17/33 mm.
4. Resize to desktop and mobile widths; the 3D scene should remain fully visible, with the details below it on narrow screens.
5. Run `npm run build` followed by `npm run preview` to check the production build locally.

`src/rendering/pieceTransform.test.ts` checks actual Three.js box vertices and bounds against the puzzle model, including mixed poses, rotations around the split intersection, absence of scaling/reflection, and a one-millimeter dimension difference. Browser/WebGL checks are currently manual, not a committed end-to-end test suite.

## Interface languages

`src/i18n/messages.ts` contains typed English (`en`) and Ukrainian (`uk`) dictionaries. A shared message shape requires both languages to provide every key, including full axis labels rather than language-dependent sentence fragments. Native language names are always shown on the switcher.

`src/App.tsx` selects a dictionary using local language state and passes the localized scene title, description, and failure message to `CubeView`. No localization context or runtime library is needed for this single-page interface. Puzzle logic and mesh transforms do not depend on the language.

Switching updates:

- all page copy, measurement labels, and unit abbreviations;
- the language switcher's accessible label and pressed state;
- scene accessible title, description, and initialization-failure message;
- the document's `lang`, title, and description meta tag.

The default is English. Language selection is not persisted or inferred from browser settings yet; a full page reload returns to English. The static HTML also starts in English, and React updates metadata on language changes. This is not server-rendered multilingual SEO.

### Language verification

1. Switch from English to Ukrainian and back. Text and units should change, while the cube and its divisions remain unchanged.
2. Use Tab to focus a language button and Enter or Space to activate it. The active language has a visible state and `aria-pressed="true"`.
3. Inspect the document's language and title, and the scene's accessible name/description, in both languages.
4. Check both languages at narrow widths; longer Ukrainian text should wrap without horizontal overflow.

`src/App.test.tsx` uses React Testing Library with jsdom to verify button clicks, localized text and metadata, stable model/state references, and error fallback behavior. Only `CubeScene` is mocked because jsdom cannot render WebGL; these tests do not claim to test GPU output. Geometry tests use real Three.js objects in Node. Dictionary tests check matching keys and nonempty translations. Solution-progress preservation will need its own tests once playback exists.

## Documentation

- [Product and MVP scope](docs/product.md)
- [Incremental development roadmap](docs/roadmap.md)
- [Discrete state and move rules](docs/moves.md)
- [Coding agent instructions](AGENTS.md)

## Technical direction

- React and TypeScript for the interface and typed application logic.
- Vite for local development and production builds.
- Three.js and React Three Fiber for 3D rendering with correct depth and occlusion. No Drei, external model/texture assets, or animation library is needed at this stage.
- Vitest for automated checks of the puzzle model.

Puzzle state and move rules, solution search, geometry/projection/animation, and UI should remain separate responsibilities. Add modules and dependencies only when needed for the current stage.

Localization uses typed dictionaries without changing puzzle logic or state. Add translations alongside each new UI feature; introduce a localization library only if concrete needs outgrow this approach.

## Deployment on Netlify

The target is Netlify's free plan, connected to the GitHub repository, using a `*.netlify.app` address without purchasing a domain. The free plan has usage limits; verify the current terms when setting up deployment. Paid options require the owner's explicit approval.

Deployment is deferred until the solving workflow and animated step-by-step playback are ready. The uncommitted deployment preparation has been removed; Netlify is not connected and there is no verified public URL.

The application already produces a static build in `dist`. When deployment resumes, verify the current free-plan limits and configure the build for the Node.js version supported by `package.json`. Do not enable paid options or auto recharge.

## Development workflow

Work in small, reviewable stages. Agree on the scope before implementation, verify the result afterward, and stop until the owner approves continuing. Do not commit or push changes without explicit permission.

## License

No license has been selected yet. A public repository does not by itself grant an open-source license to use the code.
