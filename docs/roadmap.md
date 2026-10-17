# Incremental development roadmap

## Stage workflow

Each stage delivers one small, complete behavior change or a focused infrastructure task. Before starting, agree on the behavior, affected files, and approach. Afterward, summarize the result, checks, and limitations, then wait for permission to continue.

The roadmap can change based on earlier results. It is not permission to start the next stage automatically. Commits and pushes require explicit permission from the owner.

## Completed foundation: documentation and GitHub

English documentation and collaboration rules are available in the public repository `deysan/mirror-cube`, with `main` as the default branch. Free Netlify hosting is the deployment target but has not been connected.

## Completed stage: solved puzzle model

The TypeScript model and its geometry tests are committed and published. The default parameters use the owner's confirmed Cayro cube dimensions: a 50 mm edge and splits at 22, 20, and 17 mm along X, Y, and Z respectively.

## Completed stage: initial static view

The initial React + Vite page used a fixed isometric SVG view derived from the model's dimensions. That stage is committed and published. Its solved-only renderer is replaced by the current Three.js stage.

## Completed stage: multilingual interface

English and Ukrainian dictionaries and a language switcher are committed and published. The language affects text, accessibility labels, and document metadata, not the puzzle model or geometry. Tests verify switching in both directions and model preservation.

Limitations: English is the initial language; selection is not persisted across reloads. Solution-progress preservation cannot be tested until solutions and playback exist.

## Completed stage: exact move rules

Separate discrete state and complete face turns are implemented and committed locally. See the [move-model guide](moves.md) for coordinate conventions and API details. Tests verify known directions, inverses, repeated turns, layer selection, and exact geometric invariants from solved and mixed states.

## Current stage: static Three.js scene

The SVG renderer is replaced by Three.js with React Three Fiber. Eight boxes use the model's exact dimensions and pose matrices. The page still displays the solved state; controls and animation are not added yet.

Completion criteria:

- real box dimensions and transformed centers match the puzzle model;
- all eight piece poses are passed from application state, not inferred from the camera or slot centers;
- depth testing hides rear and internal surfaces;
- resizing keeps the solved cube in view;
- language switching preserves the model/state, canvas, and geometry;
- a localized fallback handles initialization failure without breaking the rest of the page;
- geometry tests, UI tests, type checking, and the production build pass;
- the scene is visually checked in a WebGL-capable browser.

Limitations: fixed camera framed for the solved cube, no animated controls, no photorealistic reflections, no automatic context-loss recovery. The larger graphics bundle triggers Vite's size warning; it is not suppressed.

## Agreed rendering direction and deployment order

The current renderer uses Three.js with React Three Fiber. Correct depth and occlusion during shape-changing turns justify replacing the solved-only SVG renderer. Animation timing does not need an additional library at this point.

Netlify deployment is deferred until the solving workflow and animated playback are ready. The uncommitted deployment configuration and setup guide have been removed; no Netlify site was created.

The next proposed stage is animated manual turns. Stop for owner review before starting it. Each completed stage may be committed under the owner's current authorization; pushing still requires explicit permission.

## Stage sequence

| Stage | Result | Main check |
| --- | --- | --- |
| 1. Solved puzzle model | Eight pieces with exact local dimensions | Pieces fill the cube without gaps or overlapping interiors |
| 2. Static view | First React + Vite page with 3D-to-SVG projection | The solved cube is visible and the view uses the model |
| 3. Multilingual interface | English/Ukrainian language switcher and localized initial UI | Switching languages updates text without resetting puzzle state |
| 4. Move rules | Pure logic for piece slots and orientations | An inverse move and four quarter-turns restore state; dimensions remain unchanged |
| 5. Static Three.js scene | Replace SVG with a React Three Fiber scene using the model | Correct piece dimensions, placement, and depth; bilingual UI still works |
| 6. Animated manual turns | Move controls, visible rotation, and highlighted moving pieces | The final frame matches the discrete state; conflicting concurrent actions are blocked |
| 7. History and undo | Undo the latest move | The exact previous state is restored |
| 8. Scrambling | A sequence of legal moves from the solved state | Replaying the recorded sequence reproduces the state |
| 9. Solution search | An algorithm independent of UI | Applying the returned sequence solves the input state |
| 10. Step-by-step solution | Localized instructions and animated playback | Orientation cues, highlights, and state agree at every step in both languages |
| 11. Deployment | Publish the solving workflow on Netlify's free plan | Production build succeeds and the complete workflow is accessible over HTTPS |

Once localization is introduced, each subsequent UI stage includes English and Ukrainian text. Verify that language switching preserves solution progress when playback is implemented.

Reversing move history must not be presented as a general solution-search algorithm. Choose the search algorithm separately once the move model is implemented and verified.

## Completed model stage: scope and checks

A pure TypeScript model of a solved 2×2 Mirror Cube without UI or turns. The parameters define the cube's edge length and three off-center split planes, one per axis, using integer millimeters.

Files: `src/puzzle/model.ts`, `src/puzzle/model.test.ts`, minimal TypeScript and Vitest configuration, the npm lockfile, and an updated README with verification commands.

Completion criteria:

- exactly eight pieces with unique identifiers;
- separate dimensions along each axis match the split parameters;
- pieces lie within the cube, have no overlapping interiors, and fill it without gaps;
- the sum of piece volumes equals the cube's volume;
- a test with dimensions differing by one unit confirms that the distinction is preserved;
- invalid parameters are rejected;
- tests and type checking pass.

Original stage boundaries: solved geometry only, without turns, solved-state detection for arbitrary states, gaps, bevels, or an internal mechanism. Turns were added in a separate stage.
