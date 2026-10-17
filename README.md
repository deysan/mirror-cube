# MirrorCube

MirrorCube is an interactive, step-by-step guide to solving a 2×2 Mirror Cube. It will show how to hold the puzzle, which half to turn, and what each move does using a 3D view and animations.

The application will support **English and Ukrainian**, including the interface and solution instructions. Repository documentation is written in English.

## Current status

The solved-state puzzle model is implemented in TypeScript with geometry tests. There is no browser interface, move logic, solution search, or deployment yet. English/Ukrainian support is planned, not implemented.

## Local setup and checks

Use Node.js 24 (recommended) and npm. The supported Node.js versions are listed in `package.json`.

```sh
npm ci
npm test
npm run typecheck
```

Use `npm run test:watch` to rerun tests while editing. There are no `dev` or `build` commands yet; those will be added with the first Vite page.

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

Localization will cover user-facing text without changing puzzle logic or state. Choose the localization implementation when building the multilingual interface; do not add a library or empty translation modules in advance.

## Deployment on Netlify

The target is Netlify's free plan, connected to the GitHub repository, using a `*.netlify.app` address without purchasing a domain. The free plan has usage limits; verify the current terms when setting up deployment. Paid options require the owner's explicit approval.

Once the Vite application exists, the expected settings are:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Base directory | Repository root |
| Build command | `npm run build` |
| Publish directory | `dist` |

These settings cannot produce a deployment yet: the application and build command do not exist. Connect Netlify and verify deployment in a separate stage after the first page is ready. Add redirects if and when client-side routing is introduced.

## Development workflow

Work in small, reviewable stages. Agree on the scope before implementation, verify the result afterward, and stop until the owner approves continuing. Do not commit or push changes without explicit permission.

## License

No license has been selected yet. A public repository does not by itself grant an open-source license to use the code.
