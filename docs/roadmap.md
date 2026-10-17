# Incremental development roadmap

## Stage workflow

Each stage delivers one small, complete behavior change or a focused infrastructure task. Before starting, agree on the behavior, affected files, and approach. Afterward, summarize the result, checks, and limitations, then wait for permission to continue.

The roadmap can change based on earlier results. It is not permission to start the next stage automatically. Commits and pushes require explicit permission from the owner.

## Completed foundation: documentation and GitHub

English documentation and collaboration rules are available in the public repository `deysan/mirror-cube`, with `main` as the default branch. Free Netlify hosting is the deployment target but has not been connected.

## Completed stage: solved puzzle model

The TypeScript model and its geometry tests are committed and published. The default parameters use the owner's confirmed Cayro cube dimensions: a 50 mm edge and splits at 22, 20, and 17 mm along X, Y, and Z respectively.

## Completed stage: static view

The React + Vite page and fixed isometric SVG view are committed and published. Rendering uses the model's dimensions and solved positions, with a separate pure projection module. The view excludes internal and rear surfaces and works at desktop and mobile widths.

## Current stage: multilingual interface

English and Ukrainian dictionaries and a language switcher are implemented locally for review. The language affects text, accessibility labels, and document metadata, not the puzzle model or geometry. No turns, animation, or deployment have been added.

Completion criteria:

- all existing user-facing text and SVG descriptions have both translations;
- the switcher works in both directions and indicates the active language;
- document language, title, and description follow the selected language;
- switching preserves the puzzle model and SVG geometry;
- keyboard operation and layout work in both languages at desktop and mobile widths;
- dictionary tests, UI integration tests, type checking, and the production build pass.

Limitations: English is the initial language; selection is not persisted across reloads. Solution-progress preservation cannot be tested until solutions and playback exist.

The next proposed stage is deployment on Netlify's free plan. Do not begin it until the owner approves.

## Stage sequence

| Stage | Result | Main check |
| --- | --- | --- |
| 1. Solved puzzle model | Eight pieces with exact local dimensions | Pieces fill the cube without gaps or overlapping interiors |
| 2. Static view | First React + Vite page with 3D-to-SVG projection | The solved cube is visible and the view uses the model |
| 3. Multilingual interface | English/Ukrainian language switcher and localized initial UI | Switching languages updates text without resetting puzzle state |
| 4. Deployment | First working deployment on Netlify's free plan | Production build succeeds and the site is accessible over HTTPS |
| 5. Move rules | Pure logic for piece positions and orientations | An inverse move and four quarter-turns restore state; dimensions remain unchanged |
| 6. Manual controls | Move buttons update the view | UI matches puzzle state after each move |
| 7. Turn animation | Visible movement and highlighted moving pieces | The final frame matches the new state; conflicting concurrent actions are blocked |
| 8. History and undo | Undo the latest move | The exact previous state is restored |
| 9. Scrambling | A sequence of legal moves from the solved state | Replaying the recorded sequence reproduces the state |
| 10. Solution search | An algorithm independent of UI | Applying the returned sequence solves the input state |
| 11. Step-by-step solution | Localized instructions and animated playback | Orientation cues, highlights, and state agree at every step in both languages |

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

Limitations: solved state only; no turns, solved-state detection for arbitrary states, gaps, bevels, or internal mechanism.
