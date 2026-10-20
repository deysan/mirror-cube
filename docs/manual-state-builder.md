# Manual physical-state builder

## Scope and current status

The application provides a complete **piece placement → orientation → confirmation → existing solver/playback** route without generating move history. Photo work remains preserved and paused.

The initial owner trial could not reliably distinguish similar pieces or match their orientations. Selected-edge rulers were added. An enlarged isolated view and directional-length search were also tried, but have now been **removed at the owner's request**, including their implementation, translations, and dedicated tests. The palette, three proper orientations, eight main inspection viewpoints, and main-view dimension rulers remain.

The owner supplied a specific mismatch: the smallest piece at UFR needs **U=20, R=22, F=17 mm**. The previous model could not express that pose. The owner chose **only the mirrored geometry, as the application's default**, rather than a geometry selector. No switching UI or extra arbitrary rotations are offered.

The owner subsequently reported successfully solving their physical cube using this configuration and the manual-input-to-solution workflow. This confirms a successful physical trial for the entered state, not universal matching accuracy or compatibility with other cube models. No dependencies or deployment changes are included. The owner authorized committing the manual workflow, explicitly excluding photo functionality; no push was requested.

## The application's single geometry

`App.tsx` explicitly constructs `createSolvedCube(MIRRORED_CUBE_PARAMETERS)` once:

- edge: 50 mm;
- X: 22 mm toward L, 28 toward R;
- Y: 20 mm toward D, 30 toward U;
- Z: **33 mm toward B, 17 toward F**;
- solved bounds: `[-22,28] × [-20,30] × [-33,17]`.

This reflects the base geometry along Z relative to the historical convention; it does not reflect rendered meshes or allow improper piece poses. The size pairs are unchanged. Piece IDs still name home octants, so the smallest shape is now `--+` (palette **Piece 2**), not `---`. Assigned to UFR, its initial orientation has R=22, U=20, F=17. This also occurs in the reachable full state obtained by F2 from solved.

The general factory's no-argument default deliberately retains the historical Z=17 split for unchanged offline photo tooling and report reproducibility. It is **not** a selectable application geometry. Historical photo shape IDs must not be treated as current application identities without an explicit geometry-aware mapping. Photo recognition has not produced an accepted state.

The app has no persisted draft or state import. Reloading starts a new session with the mirrored geometry; old in-memory placements/history are not migrated. Language changes, reset, builder apply/cancel, and solver playback retain the same application geometry.

## User workflow

1. Choose **Build a physical cube state** / **Відтворити фізичний кубик** once the scene is ready and no turn or search is running. The draft starts empty, not as an assumed solved physical state.
2. Establish a physical reference: U top, F front, R right. These names remain attached to the same reference sides while inspecting other viewpoints. Do not turn layers during entry.
3. Choose one of eight named corner positions using buttons or a visible 3D piece/empty-slot target. UFR is the intersection of the top, front, and right sides. Position is an octant, not a millimeter coordinate.
4. Choose a piece from the common-scale volumetric thumbnails and its exact reference dimensions. Numbers 1–8 are application identifiers, not manufacturer markings. Similar lengths are not merged; compare full body edges rather than sticker borders.
5. Cycle its **three** proper corner orientations. Compare the colored edge rulers and the text lengths toward the named faces with the physical piece. This changes only the draft, not a physical corner or layer.
6. Inspect the assembled model from eight corner viewpoints. Camera changes do not alter placements or the fixed-world face labels. **Look at selected position** and **Solution view (U/F/R)** provide direct references; selection does not silently change the camera.
7. When all eight pieces are present and the validator accepts their combined twists, choose **Use this state**. Native confirmation asks the user to check the physical match and explains clearing prior history/solution and restoring the solution viewpoint.
8. Use **Find solution** and animated playback. Imported placements are not pretend turns; history starts empty and subsequently records actual virtual moves.

An identity cannot occupy two positions. Used palette entries show their position and are disabled elsewhere. Remove an identity before moving it. Replacing a selected piece with an available one frees the former identity and starts the new one at orientation 1; no other piece is silently swapped or reoriented.

**Copy current virtual state** is a convenience, not recognition. It copies the committed cube into an independent draft. Replacing a populated draft, clearing it, or cancelling it requires confirmation. Cancel preserves the prior cube, history, and plan. Applying a new state clears them atomically. An empty draft can be cancelled/copied over without a destructive-data prompt.

## Domain and session boundaries

`src/puzzle/draft.ts` has no React, Three.js, localization, solver, or image-processing dependencies:

- `PuzzleDraft`: eight slot-ordered `{ pieceId, twist } | null` placements;
- `emptyDraft`, `editDraft`, `draftFromState`: independent drafts, immutable assign/twist/remove operations, and duplicate/no-op guards;
- `draftCorners`: display-only poses, including incomplete or mechanically invalid combinations;
- `placementDimensions`: exact fixed-world extents, preserving distinct lengths;
- `validateDraft`: existing `validatePuzzleState` validation and an independent canonical snapshot.

For a fixed identity and octant, `cornerOrientation` gives exactly three proper rotations keeping the mechanism-facing corner inward. No arbitrary Euler angles, reflections, scaling, or relocation away from the mechanism origin is allowed. Individual edits can temporarily violate the total-twist constraint; the draft remains editable.

Validation requires eight distinct identities/positions, proper consistent poses, and twist sum zero modulo three. Odd permutations are legal. The final corner is not automatically repaired. A valid draft proves model reachability, not accurate physical observations. See [state validation](state-encoding.md).

`src/interaction/turnSession.ts` separates the draft from committed puzzle/history/playback. Open requires a ready idle scene. Edit/copy/clear change only the draft. Move, undo, scramble, reset, search, playback, and stale completion/result commands are blocked while editing. Cancel discards only the draft; apply revalidates before committing, clears old history/search/playback, and preserves monotonic IDs/resources. It never starts a search automatically.

The worker sees committed snapshots only. Its logical corner coordinates and transition tables do not depend on cuboid lengths, so the same solver works with the mirrored definitions without negating moves or reflecting results. Search/table construction stays off the main thread.

Scene failure retains the draft and committed cube, disables editing/apply, and permits cancellation. Reload is required to recover the renderer and loses in-memory state.

## Rendering and interface

- `StateBuilder.tsx`: accessible slot/palette/orientation controls, common-scale SVG thumbnails, face-length text, diagnostics, and confirmations.
- `EditorMarkers.tsx`: wireframe empty-position targets and six fixed-world face-letter sprites, with resource cleanup.
- `src/rendering/dimensions.ts`: exact posed box bounds and display-only projected rulers. Labels use model lengths, not measurements from pixels. Placement avoids other labels and face sprites and prefers not to cover the selected box.
- `SelectedDimensions.tsx` / `DimensionDrawing.tsx`: main-camera projection after camera layout, with state/slot/view gating against stale overlays. SVG rulers are pointer-transparent and hidden from assistive technology; equivalent dimensions appear in labeled text.
- `CubeScene.tsx` / `CubeView.tsx`: reuse one Three.js canvas and exact transforms; highlights and camera positions never become state.
- `App.tsx`: memoized display-only draft, separate camera/selection, fixed mirrored definitions, and restored solution camera/focus on exit.
- `src/i18n/editor.ts` and `src/editor.css`: bilingual controls, focus styles, responsive layout, and compact sticky mobile preview.

Main rulers are overlays, not depth-tested meshes: an annotated edge may be behind a neighboring piece. Use **Look at selected position** to inspect it. Colors accompany face letters and numeric labels. There is no enlarged isolated view, length-search form, free dragging, zoom control, or arbitrary camera roll. The main renderer remains Three.js; palette SVGs are illustrations only.

## Verification and limitations

Automated checks cover:

- solved containment/non-overlap/volume for the mirrored parameters and preserved historical factory behavior;
- the exact owner-reported UFR lengths in a reachable F2 state, with proper rotations rather than reflected poses;
- all 192 piece/slot/twist combinations, exact transformed mesh bounds, and label separation/viewport fit across eight main viewpoints;
- empty/invalid drafts, duplicates, no-ops, balanced/unbalanced twists, odd permutations, global frames, and history-free states;
- session locks, stale responses, apply/cancel confirmations, language/view preservation, worker isolation, and scene failure;
- full manual construction, exact worker input, history-independent solving, animated playback, and retained mirrored geometry on reset;
- absence of the removed length-search and isolated-detail UI.

Manual-workflow checks, excluding the separately maintained photo tools: **627 tests in 24 files**, type checking, production build, and `git diff --check` pass. Real Chrome/WebGL production checks at 1280/320 px verify actual rulers for R=22/U=20/F=17, all three orientations, removed controls, pointer picking, eight inspection views, native confirmations, worker requests, animated solution, reset, and context loss. Navigation/replay/reset regression also passes at 1280/390/320 px, including depth-eleven traversal with reduced motion. These constructed-input checks are not physical ground truth or a committed cross-browser E2E suite. The existing large-client-chunk warning remains; the worker asset is unchanged.

No automatic identification, draft persistence/export, edit undo stack, arbitrary dimension entry, free-drag camera, or photo import is added. The ideal cuboids omit bevels, stickers, gaps, and the internal mechanism. A mistaken but reachable input yields a solution for that input, not necessarily the physical cube.

Photo tools and photo-specific documentation remain intact under `tools/photo-geometry/` and the [photo guides](photo-input.md). No new calibration photograph is needed to try manual reconstruction. Future photo integration must preserve ambiguity and pass the same explicit confirmation/validation boundary.
