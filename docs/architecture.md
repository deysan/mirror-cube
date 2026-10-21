# Geometry and architecture

## Module boundaries

| Location | Responsibility |
| --- | --- |
| `src/puzzle/` | Exact geometry, corner poses, moves, validation, drafts, and solvedness |
| `src/solver/` | Normalized coordinates, tables, IDA* search, and worker entry/protocol |
| `src/interaction/` | Pure session transactions and browser worker lifecycle |
| `src/rendering/` | Display transforms, animation math, rulers, and orbit resources |
| `src/components/` | React controls and the Three.js/React Three Fiber scene |
| `src/i18n/` | Typed English/Ukrainian dictionaries |
| `src/App.tsx` | Definitions, session, language, selection, and display-only camera state |

Domain and solver modules do not import React, Three.js, or localization. Rendered meshes never become the source of puzzle state. See the [solver design](solver.md) for the search boundary and [user guide](usage.md) for controls.

## Geometry and reference frame

The application explicitly calls `createSolvedCube(MIRRORED_CUBE_PARAMETERS)`: edge 50 mm, splits X=22, Y=20, Z=33. The origin is the intersection of the split planes, not the outer geometric center. Positive X is right, positive Y up, and positive Z front.

| Axis | Negative side | Positive side |
| --- | --- | --- |
| X | L: 22 mm | R: 28 mm |
| Y | D: 20 mm | U: 30 mm |
| Z | B: 33 mm | F: 17 mm |

Solved bounds are `[-22,28] × [-20,30] × [-33,17]`. A definition stores an immutable identity, local `dimensions`, and `solvedMin`. IDs name home octants; they do not change after moves.

| Piece ID | X | Y | Z |
| --- | --- | --- | --- |
| `---` | 22 | 20 | 33 |
| `--+` | 22 | 20 | 17 |
| `-+-` | 22 | 30 | 33 |
| `-++` | 22 | 30 | 17 |
| `+--` | 28 | 20 | 33 |
| `+-+` | 28 | 20 | 17 |
| `++-` | 28 | 30 | 33 |
| `+++` | 28 | 30 | 17 |

Lengths use exact whole millimeters. Factory parameters must be safe integers with positive edge length and strictly interior, off-center splits. Fractional values are rejected, not rounded. Custom factory parameters need not yield visually distinguishable shapes; the app does not expose them.

**Compatibility:** the generic `DEFAULT_CUBE_PARAMETERS` and no-argument `createSolvedCube()` retain the historical Z=17 split for separate offline photo tools. This is not a second app configuration. Historical photo IDs cannot silently be reused with the mirrored definitions. Do not change this default or add a geometry selector without explicitly addressing compatibility.

## Exact poses and turns

A `PuzzleState` has eight corners, each with `pieceId`, `slot`, and `orientation`:

- `slot` contains three signs (±1), not millimeter coordinates or a box center.
- The orientation vectors are rotation-matrix **columns**. They form a proper signed-axis rotation with determinant +1.
- Pose consistency requires `slot = orientation × homeSlot(pieceId)`.
- Completed moves use coordinate swaps/sign changes, not floating-point angles or tolerances. Negative zero is canonicalized.

`Move` contains a face U/D/L/R/F/B and `turns: 1 | -1 | 2` for outside-view clockwise, counterclockwise, or half-turn. Current slots determine layer membership. The renderer's signed angle is `-side * turns * π / 2` around the positive world axis.

A piece's world geometry is its original solved geometry rotated about the mechanism origin. `createPieceMatrix` therefore rotates the actual solved center, never a uniform slot center. For example, the app's `+++` box `[0,28] × [0,30] × [0,17]` becomes `[0,30] × [-28,0] × [0,17]` after F. Its center is `(15,-14,8.5)`, not the slot `(1,-1,1)`.

Readonly types are compile-time contracts, not runtime freezing. Moves return new states without modifying definitions; unchanged poses may be shared.

## Validation and drafts

`validatePuzzleState(candidate: unknown)` accepts plain structured data, not executable getters/proxies. It checks structure, eight unique known identities, unique signed slots, proper orientations, consistent poses, and total corner twist zero modulo three. **Odd permutations are legal** for a 2×2; no 3×3 edge-parity constraint applies.

Success returns an independent canonical snapshot in identity order `--- --+ -+- -++ +-- +-+ ++- +++`, ignoring extra fields such as history. Failure returns no partial state and a diagnostic code: `structure`, `corner-count`, `piece-id`, `duplicate-piece`, `slot`, `duplicate-slot`, `orientation`, `pose`, or `twist-sum`. An optional `cornerIndex` refers to the supplied array.

Each identity at a fixed slot has exactly three proper corner orientations. `cornerOrientation` maps the piece's ordered outward normals cyclically to the destination normals; twist is the destination index of the original U/D normal. All slot-normal frames share the same handedness:

| Slot | Ordered normals | Slot | Ordered normals |
| --- | --- | --- | --- |
| `---` | D, B, L | `+--` | D, R, B |
| `--+` | D, L, F | `+-+` | D, F, R |
| `-+-` | U, L, B | `++-` | U, B, R |
| `-++` | U, F, L | `+++` | U, R, F |

`PuzzleDraft` is an eight-slot array of `{pieceId, twist} | null`. Assign/twist/remove edits are immutable and reject duplicate identities. `draftCorners` may render incomplete or temporarily invalid combinations; `placementDimensions` supplies exact posed lengths. Only `validateDraft` followed by explicit confirmation can replace committed state. No silent swaps, size substitutions, reflections, or final-corner twist repair are allowed.

## Session transactions

`turnSession.ts` owns the committed puzzle/history, editor draft, search snapshot, playback plan, and pending turn. It enforces locks independently of disabled UI controls.

- A pending turn has a monotonic ID. Until its matching completion, committed state/history do not change. Duplicate or obsolete callbacks are ignored.
- Manual, scramble, and forward solution turns append history; undo/backward navigation remove the appropriate suffix. Sequence scheduling is atomic, without unlocked gaps.
- Playback binds `moves`, `completed`, `expectedState`, `status`, and optional `target` to the searched snapshot. Final completion requires exact solvedness.
- Replay uses a temporary inverse-derived `previewState` and only clears that preview on completion. It never changes the committed cube, history, progress, or worker input.
- Builder cancel preserves prior state/history/plan. Apply revalidates and clears them atomically. Drafts block other operations except scene lifecycle handling and cancellation.
- Confirmed reset clears puzzle/history/plan but retains geometry, language, monotonic IDs, and a healthy idle worker.
- Scene failure discards unfinished work, not the completed state/history prefix.

## Rendering and camera resources

`CubeView` renders a module-scoped `LazyCubeScene` through React Suspense. Until WebGL readiness, it reserves the scene area, shows a localized loading message, and leaves puzzle actions locked while language/measurements remain available. Import rejection uses the existing scene-failure boundary; it does not trigger automatic retries or reloads. A loaded module alone is not scene readiness, and language changes do not recreate the lazy component or canvas.

Plain overlay types, axes, and colors live in `rendering/dimensionDrawing.ts`, separate from the Three.js-dependent projection code. DOM overlays must not pull graphics dependencies back into the initial import graph. Build boundaries and budgets are checked by `npm run check:bundle`; see [build notes](contributing.md#build-and-publication).

Three.js provides depth-tested cuboids and edge outlines. The orthographic camera fits a pivot-centered sphere containing every piece throughout turns; normal solving uses U/F/R. Animation lasts 0.6 seconds for quarter-turns and 0.9 for half-turns, uses smoothstep, and caps frame delta at 0.05 seconds. Reduced motion skips interpolation through the same completion transaction.

Free inspection exists only in the editor. OrbitControls from the installed Three.js package rotate around the origin with no zoom, pan, damping, autorotation, or two-finger action. A capture-phase 5-pixel threshold prevents drags (including out-and-back drags) from selecting. Presets disable free mode; exit restores the solution camera. Listeners, pointer capture, and styles are released on disposal.

Selected rulers reproject after layout or changed camera matrices, using exact model lengths and fixed-world face-label reservations. Degenerate end-on rulers may be omitted. SVG overlays are pointer-transparent and have equivalent accessible text. Mesh geometry, sprites, and controls are cleaned up on replacement/unmount. Demand rendering avoids a continuous idle frame loop.
