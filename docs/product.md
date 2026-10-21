# Product and MVP scope

## Purpose

MirrorCube will let users prepare a 2×2 Mirror Cube state by manually turning/scrambling the virtual cube, directly placing/orienting its eight pieces, or reconstructing a physical state from photographs, then find a solution and follow animated instructions. Manual and photo input are full product workflows sharing one solver and playback system. Users should understand each movement rather than rely only on move notation. Photo input is a required final functional stage, not an optional extension; it is not implemented yet.

The puzzle consists of eight differently sized pieces. Turns change its outer shape; in the solved state, the pieces form a cube with flush outer surfaces.

## Core user journey

1. Choose an input method:
   - manually turn or scramble the virtual cube;
   - reconstruct the physical state by choosing each corner's piece and orientation; or
   - photograph the physical puzzle using guided views, whose number and angles will be established during the photo-input stage.
2. Review the 3D state. The manual builder keeps an isolated draft, prevents duplicate identities, and requires exact validation and explicit confirmation before replacing the current state. For photo input, resolve ambiguities with additional views or corrections and confirm the reconstructed state.
3. Request a solution from that validated state, without needing its move history.
4. Follow the solution step by step in the virtual view or on the physical puzzle, using orientation guidance, animations, and highlighted moving pieces.

Complete “manual turns/scramble → find solution → animated steps” first. Manual controls remain a supported input route after photo recognition is added; they are not just test tooling and do not replace the required photo workflow.

Each step should clearly explain:

- how to hold the puzzle;
- which half to rotate;
- the direction and angle of rotation;
- what the puzzle will look like after the move.

## Languages

The current interface and step-by-step solution instructions support English and Ukrainian, including guidance on holding and turning the puzzle.

Users should be able to switch languages without resetting the puzzle or their progress through a solution. Puzzle state, move identifiers, and solution search must be independent of the selected language.

Repository documentation is maintained in English. Ukrainian user-facing translations will be part of the application, not a separate Ukrainian documentation set.

## Planned MVP

- A geometrically correct 2×2 Mirror Cube model.
- A 3D view and animated turns.
- Face-turn controls.
- Animated scrambling from the current state, which is initially solved. Repeated scrambling preserves existing history rather than resetting the puzzle.
- Move history and undo for the latest turn.
- A direct physical-state builder with exact piece choices, three orientations per position, selected-edge dimensions, eight preset viewpoints and editor-only free camera orbit, validation, and confirmation without requiring generating moves.
- Solution search from a valid state, independent of how it was obtained and without requiring move history.
- Step-by-step solution playback with highlighted pieces, navigation through intermediate forward/backward moves, and non-committing replay for physical-puzzle review.
- Reset to the default solved pose after confirming deletion of history and solution.
- An English/Ukrainian language switcher with localized UI and instructions.
- Photo-based reconstruction and confirmation of the physical puzzle state, implemented after solution search and playback.

This is a guide for incremental development, not a request to implement everything in one stage.

## Model accuracy

Each piece has a stable identity and its own local dimensions along all three axes. A turn changes the piece's position and orientation, not its local dimensions.

Similar dimensions must not be treated as equal: differences of a few millimeters must remain represented in the model. An approximately cubic silhouette is not sufficient to determine whether the puzzle is solved. The implemented goal predicate requires every identified piece to have its exact home pose up to one common rigid rotation of the whole cube. All 24 proper face-aligned orientations are accepted; reflections are not. It does not require move history. See the [goal contract and solver design](solver.md).

Puzzle state is the source of truth. Projection and intermediate animation frames do not determine move legality or solved status. Free inspection changes only the builder camera, not placements or reference faces; solving always restores the standard U/F/R view. Short clicks select, while mouse/one-finger drags rotate the camera without selecting. Presets remain keyboard-accessible; free zoom and pan are not offered.

The implemented solved-state geometry uses rectangular pieces without bevels, gaps, or an internal mechanism. The application's single mirrored configuration uses the owner's size pairs for their [Cayro 2×2 Mirror Cube](https://bi.ua/ukr/product/zerkalnyy-kubik-rubika-cayro-2h2-8380.html): a 50 mm edge, with X layers of 22/28 mm, Y layers of 20/30 mm, and Z layers of 33/17 mm (B/F). The size pairs were confirmed by the owner, not independently verified against a manufacturer specification. The owner requested the mirrored convention after reporting the smallest piece at UFR with R=22/U=20/F=17; this pose is now supported. The general factory's historical no-argument parameters remain unchanged for offline photo reproducibility and are not an application option.

All current model lengths use whole millimeters, with no rounding or approximate equality. Fractional model parameters are rejected; support for finer geometry will require an explicitly finer unit. See the [model documentation](../README.md#solved-puzzle-model) for coordinates, piece dimensions, and validation rules.

## First-version boundaries

The application currently works with a known virtual puzzle state and tracks performed turns. History-independent search is connected to a worker and a bilingual solve/result panel, with cancellation and stale-result protection. The returned solution can be executed individually or navigated to a selected step through intermediate forward/inverse moves, with exact progress/history commits and verified solved completion. A completed step can be demonstrated again without changing progress; confirmed reset returns to the default solved position. The [manual state builder](manual-state-builder.md) is now implemented for owner testing: it creates a validated history-free input and uses that same solving workflow. The initial owner trial could not reliably match similar pieces and orientations. Main-view dimension rulers remain. At the owner's request, the subsequent enlarged detail view and length search have been removed, and only the mirrored geometry is used by default. The owner subsequently reported successfully solving their physical cube through the manual workflow. This confirms the tested case, not arbitrary puzzle compatibility. A mismatch may concern the reference frame or model, not just user entry. Photo functionality is not included in this change. Photo input remains part of the planned complete product.

A single photograph may hide pieces or fail to distinguish their shapes and orientations. Do not promise reconstruction from one arbitrary image. The capture protocol, recognition approach, and any calibration requirements remain to be validated on the owner's physical cube. Start with its confirmed dimensions rather than assuming arbitrary Mirror Cube models are interchangeable.

Recognition must remain separate from puzzle rules and search. It should produce a candidate discrete state using the known piece definitions; uncertain observations must not silently become exact assignments. The workflow must allow additional views or corrections and validate the confirmed state before solving. No image model, external service, image storage, or backend has been selected.

Other puzzles, user accounts, payments, and backend infrastructure are outside the current MVP.

## Hosting

The repository is public and manual solve/playback works locally. Deployment remains deferred and requires separate owner approval; the complete planned release includes photo input as well. The hosting target is a static site on Netlify's free plan, initially using a `netlify.app` subdomain. Paid services, options, and a custom domain require separate approval.

Check the current free-plan limits before the first deployment. Free hosting does not mean unlimited traffic or builds.
