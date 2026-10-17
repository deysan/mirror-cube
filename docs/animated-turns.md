# Animated manual turns

## Scope

The interface supports all six faces with clockwise/counterclockwise quarter-turns and half-turns. Four moving pieces are highlighted in amber while the others stay still. There is no history, undo, automatic scrambling, solved-state detection, or solution search yet.

Face names refer to the fixed puzzle frame described in [the move-model guide](moves.md). Clockwise is always viewed directly from the chosen face, not from the current camera. The controls explain that F is the left visible side, R the right, and U the top in the isometric view. Rear faces remain partially hidden; the camera cannot be rotated yet.

## State ownership

Three responsibilities are kept separate:

1. `src/puzzle/moves.ts` computes exact completed moves using integer coordinate swaps and sign changes.
2. `src/interaction/turnSession.ts` owns the interaction transaction: scene availability, the committed puzzle, and at most one pending move.
3. `src/components/CubeScene.tsx` animates a temporary group. It never derives puzzle state from mesh coordinates.

`src/App.tsx` uses the session reducer and passes state/callbacks to the view. Language is separate state. `MoveControls.tsx` owns only the selected turn angle/direction and emits a typed `Move` when a face button is pressed.

## Turn lifecycle

1. Controls remain disabled until the scene reports readiness.
2. A start action is accepted only when the scene is ready and no turn is active. The reducer enforces this even if events arrive before the UI updates.
3. The pending move gets a monotonically increasing ID. The committed puzzle does not change yet.
4. The renderer selects four pieces by their current slots and places them in a temporary group at the mechanism origin.
5. `useFrame` rotates that group. At the endpoint it reports the pending ID once.
6. The reducer accepts completion only for the current pending ID, applies the exact move, and clears the pending turn. Duplicate and stale callbacks are ignored.
7. The temporary group is removed and the scene renders the newly committed poses. Controls become available again.

There is no queue: clicks during a turn are ignored, not replayed later. Changing the language keeps the pending ID, puzzle state, and animation component intact, so it does not restart the movement.

The status says “Ready to turn” or describes the active move; it does not claim the puzzle is solved based on appearance. The measurements panel explicitly describes the solved dimensions, not the current bounding box.

## Timing and geometry

`src/rendering/turnAnimation.ts` provides a clamped smoothstep interpolation and the signed angle. Nominal durations are 0.6 seconds for a quarter-turn and 0.9 seconds for a half-turn. Half-turns follow the clockwise direction, although their final pose is the same in either direction.

A frame delta is capped at 0.05 seconds, so returning from a suspended/background tab resumes the movement rather than jumping past it. The scene uses on-demand rendering: the active animation requests subsequent frames, and rendering becomes idle again after completion.

If `prefers-reduced-motion: reduce` is active when a turn starts, the scene moves to the final pose on the next rendered frame without interpolation. The same completion/locking rules still apply. Preference changes are picked up on the next turn.

The visual rotation is applied around the intersection of the split planes, outside each piece's existing pose matrix. It is not a rotation around a moving piece's center. Endpoint tests compare every visual matrix with the matrices produced by the discrete move rules.

## Stable framing

The camera targets the mechanism origin. `getPuzzleRadius` computes the farthest possible vertex distance using the maximum extent on each original axis. Rotations preserve that distance, so a fixed sphere contains every piece in every completed or intermediate pose.

Orthographic zoom fits that sphere with padding. This leaves more space around the solved cube than the earlier tight framing, but prevents clipping and camera jumps during turns. The zoom changes only when the viewport size changes.

On narrow screens the controls may be below the scene. If the canvas is outside the viewport when a move is requested, the page brings it into view immediately so the animation can be seen. It does not animate the scroll.

## Scene failure

Initialization errors and WebGL context loss disable move controls and show a localized fallback. If a turn was unfinished, the session cancels it without changing the last committed puzzle. A later completion callback cannot apply that canceled move.

There is no automatic context recovery or persistent state. Reloading retries the scene, resets the puzzle to the solved state, and restores English as the initial language.

## Verification

```sh
npm test
npm run build
npm run dev
```

Automated checks cover:

- start/readiness guards, one active move, and exactly-once completion;
- duplicate/stale completion IDs and cancellation on failure;
- real UI selections for all three turn angles;
- language switching while a turn is pending;
- all 18 face/angle endpoints from solved and mixed states;
- intermediate geometry within the camera's bounding sphere;
- existing exact-model, move, and geometry invariants.

UI integration tests mock the WebGL scene and explicitly signal completion; they do not run the frame loop. Browser checks exercise actual WebGL animation, keyboard interaction, disabled controls, all face/angle combinations, mobile layout, reduced motion, and context loss.

For manual review, perform R followed by its counterclockwise inverse, try a half-turn, and change languages during a turn. Inspect the amber layer and final shape. Verify that no second move starts until the first finishes. Browser checks remain a manual review step rather than a committed end-to-end suite.
