# Product and MVP scope

## Purpose

MirrorCube provides interactive, step-by-step instructions for solving a 2×2 Mirror Cube. Users should understand each movement rather than rely only on move notation.

The puzzle consists of eight differently sized pieces. Turns change its outer shape; in the solved state, the pieces form a cube with flush outer surfaces.

## Core user journey

1. View a 3D representation of the solved puzzle.
2. Make turns or scramble the puzzle.
3. Request a solution for the current known state.
4. Follow the solution step by step with animations and highlighted moving pieces.

Each step should clearly explain:

- how to hold the puzzle;
- which half to rotate;
- the direction and angle of rotation;
- what the puzzle will look like after the move.

## Languages

The current interface supports English and Ukrainian. Future step-by-step solution instructions, including guidance on holding and turning the puzzle, must also be available in both languages.

Users should be able to switch languages without resetting the puzzle or their progress through a solution. Puzzle state, move identifiers, and solution search must be independent of the selected language.

Repository documentation is maintained in English. Ukrainian user-facing translations will be part of the application, not a separate Ukrainian documentation set.

## Planned MVP

- A geometrically correct 2×2 Mirror Cube model.
- A 3D view and animated turns.
- Face-turn controls.
- Scrambling from the solved state.
- Move history and undo for the latest turn.
- Solution search from the current state.
- Step-by-step solution playback with highlighted moving pieces.
- An English/Ukrainian language switcher with localized UI and instructions.

This is a guide for incremental development, not a request to implement everything in one stage.

## Model accuracy

Each piece has a stable identity and its own local dimensions along all three axes. A turn changes the piece's position and orientation, not its local dimensions.

Similar dimensions must not be treated as equal: differences of a few millimeters must remain represented in the model. An approximately cubic silhouette is not sufficient to determine whether the puzzle is solved.

Puzzle state is the source of truth. Projection and intermediate animation frames do not determine move legality or solved status.

The implemented solved-state geometry uses rectangular pieces without bevels, gaps, or an internal mechanism. Its default parameters match the owner's confirmed dimensions for their [Cayro 2×2 Mirror Cube](https://bi.ua/ukr/product/zerkalnyy-kubik-rubika-cayro-2h2-8380.html): a 50 mm edge, with X layers of 22/28 mm, Y layers of 20/30 mm, and Z layers of 17/33 mm. These dimensions were confirmed by the owner, not independently verified against a manufacturer specification.

All current model lengths use whole millimeters, with no rounding or approximate equality. Fractional inputs are rejected; support for finer measurements will require an explicitly finer unit. See the [model documentation](../README.md#solved-puzzle-model) for coordinates, piece dimensions, and validation rules.

## First-version boundaries

The application works with a known virtual puzzle state and tracks performed turns. Recognizing a physical puzzle from photographs is a possible separate future stage.

Other puzzles, user accounts, payments, and backend infrastructure are outside the current MVP.

## Hosting

The repository is public. The application will be deployed as a static site on Netlify's free plan, initially using a `netlify.app` subdomain. Paid services, options, and a custom domain require separate approval.

Check the current free-plan limits before the first deployment. Free hosting does not mean unlimited traffic or builds.
