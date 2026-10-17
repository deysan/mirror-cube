# MirrorCube

MirrorCube is an interactive, step-by-step guide to solving a 2×2 Mirror Cube. It will show how to hold the puzzle, which half to turn, and what each move does using a 3D view and animations.

The interface supports **English and Ukrainian**. Solution instructions will support both languages when implemented. Repository documentation is written in English.

## Current status

The solved-state puzzle model, a static React/SVG view, and an English/Ukrainian language switcher are implemented. The page shows the owner's cube dimensions and its unequal divisions from a fixed isometric camera. Tests cover geometry, projection, and language switching. There is no move logic, solution search, or deployment yet.

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

The model uses ideal rectangular pieces without bevels, gaps, or an internal mechanism. It only describes the solved state; there are no turn rules or arbitrary-state solved checks yet. Data is exposed through TypeScript `readonly` types, not runtime freezing.

`src/puzzle/model.test.ts` checks piece identities, exact dimensions, containment, pairwise non-overlap, total volume, one-millimeter differences, input independence, and parameter validation. Containment, non-overlap, and equal total volume together verify that the pieces fill the cube without gaps.

## Static SVG view

- `src/rendering/solvedView.ts` selects the visible exterior polygons from the model and projects their 3D vertices into 2D. It has no React or DOM dependencies.
- `src/components/CubeView.tsx` draws those polygons in an accessible SVG and fits the `viewBox` to their projected bounds.
- `src/App.tsx` owns the solved model as state initialized on mount and uses it for both the SVG and displayed measurements. Language is separate state.
- `src/styles.css` provides a responsive layout and three neutral shades to distinguish face directions.

The camera looks from positive X, Y, and Z. Positive Y projects upward, positive X down-right, and positive Z down-left. The three axes are equally foreshortened and separated by 120 degrees. These are viewing conventions, not move notation or instructions for holding a physical cube yet.

Only the positive outer surfaces are visible: four polygons per surface, twelve in total. Their projected interiors do not overlap, so this solved-only view requires neither a depth buffer nor depth sorting. Internal faces and the three rear outer surfaces are excluded. This is deliberately not a renderer for arbitrary turns; visibility and occlusion must be revisited when implementing moves and animations.

Polygon borders visualize divisions without changing piece dimensions. Shading is illustrative, not a simulation of reflective materials. The view is fixed: no drag-to-rotate, turns, or animation.

### Visual verification

1. Run `npm run dev` and open the page.
2. Confirm that the top and two sides form a single cube with four unequal regions per visible surface.
3. Check that the dimensions panel reads 50 mm and 22/28, 20/30, 17/33 mm.
4. Resize to desktop and mobile widths; the SVG should remain fully visible, with the details below it on narrow screens.
5. Run `npm run build` followed by `npm run preview` to check the production build locally.

Projection tests verify axis directions, equal foreshortening, visible outer faces, their corner coordinates, projected areas, and that deriving the view does not modify the puzzle model. Browser layout checks are currently manual, not a committed end-to-end test suite.

## Interface languages

`src/i18n/messages.ts` contains typed English (`en`) and Ukrainian (`uk`) dictionaries. A shared message shape requires both languages to provide every key, including full axis labels rather than language-dependent sentence fragments. Native language names are always shown on the switcher.

`src/App.tsx` selects a dictionary using local language state and passes the localized SVG title and description to `CubeView`. No localization context or runtime library is needed for this single-page interface. Puzzle logic and projection do not depend on the language.

Switching updates:

- all page copy, measurement labels, and unit abbreviations;
- the language switcher's accessible label and pressed state;
- SVG accessible title and description;
- the document's `lang`, title, and description meta tag.

The default is English. Language selection is not persisted or inferred from browser settings yet; a full page reload returns to English. The static HTML also starts in English, and React updates metadata on language changes. This is not server-rendered multilingual SEO.

### Language verification

1. Switch from English to Ukrainian and back. Text and units should change, while the cube and its divisions remain unchanged.
2. Use Tab to focus a language button and Enter or Space to activate it. The active language has a visible state and `aria-pressed="true"`.
3. Inspect the document's language and title, and the SVG title/description, in both languages.
4. Check both languages at narrow widths; longer Ukrainian text should wrap without horizontal overflow.

`src/App.test.tsx` uses React Testing Library with jsdom to verify actual button clicks, localized text and metadata, model preservation, and unchanged SVG nodes and coordinates. Other tests retain Vitest's default Node environment. Dictionary tests also check matching keys and nonempty translations. Solution-progress preservation will need its own tests once playback exists.

## Documentation

- [Product and MVP scope](docs/product.md)
- [Incremental development roadmap](docs/roadmap.md)
- [Coding agent instructions](AGENTS.md)

## Technical direction

- React and TypeScript for the interface and typed application logic.
- Vite for local development and production builds.
- SVG for the initial 3D view, projecting 3D coordinates onto a 2D surface.
- Vitest for automated checks of the puzzle model.

Puzzle state and move rules, solution search, geometry/projection/animation, and UI should remain separate responsibilities. Add modules and dependencies only when needed for the current stage.

Localization uses typed dictionaries without changing puzzle logic or state. Add translations alongside each new UI feature; introduce a localization library only if concrete needs outgrow this approach.

## Deployment on Netlify

The target is Netlify's free plan, connected to the GitHub repository, using a `*.netlify.app` address without purchasing a domain. The free plan has usage limits; verify the current terms when setting up deployment. Paid options require the owner's explicit approval.

The Vite application now builds as a static site. The planned Netlify settings are:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Base directory | Repository root |
| Build command | `npm run build` |
| Publish directory | `dist` |

Netlify is not connected yet. Set up and verify deployment in its own approved stage. Add redirects if and when client-side routing is introduced.

## Development workflow

Work in small, reviewable stages. Agree on the scope before implementation, verify the result afterward, and stop until the owner approves continuing. Do not commit or push changes without explicit permission.

## License

No license has been selected yet. A public repository does not by itself grant an open-source license to use the code.
