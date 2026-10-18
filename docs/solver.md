# Exact solvedness and solver design

## Status and scope

`src/puzzle/solved.ts` implements exact solved-state detection. Plain-data/reachability validation and normalized compact coordinates are also implemented; see [the state-encoding guide](state-encoding.md) for APIs and conventions. Solution search, transition/distance tables, and worker/UI integration are **not implemented yet**. This document selects the search direction and its required checks; it is not an implementation claim or permission to start all following stages.

The final input will come from photographs of a physical puzzle. Neither solvedness nor search may require the moves that produced that state. History remains a UI convenience for undo, not a solver input.

## Implemented goal predicate

```ts
import { isSolved } from "./puzzle/solved";

const solved = isSolved(state);
```

The argument is a structurally typed `PuzzleState` using the conventions in [the move-model guide](moves.md). The function has no React, Three.js, language, camera, history, or piece-dimension dependency. It does not mutate the input or require a particular corner-array order.

A state is solved exactly when:

1. It contains all eight distinct home-sign piece IDs, once each.
2. Every piece has the same orientation matrix `R`.
3. `R` is a proper signed-axis rotation: its columns are signed coordinate unit vectors and `R.x × R.y = R.z`.
4. Each piece's current slot is `R × homeSlot(pieceId)`.

These conditions recognize the solved arrangement up to any of the 24 proper rotations of the entire cube. Rotating the whole assembled puzzle does not make it unsolved. Reflections (determinant −1), scale, shear, and approximate rotations are not allowed.

The implementation takes the first corner's orientation as the candidate global rotation, verifies it, then checks all identities, orientations, and slots against it. It need not construct 24 full goal states on every call. Exactly eight distinct valid IDs and their rotated home slots also ensure complete, unique slot occupancy.

Examples:

- The initial state is solved.
- R alone is not solved; R followed by R′ is solved again.
- R followed by L′ is a rigid whole-cube rotation and is solved, although it differs from the initial state.
- Returning all pieces to their home slots without correcting their orientations is not sufficient.
- Giving all pieces the same orientation without rotating their slots consistently is not sufficient.

### Why dimensions are not compared

A piece ID identifies its immutable definition, including all three exact dimensions. The predicate restores those identified pieces to their defined arrangement, allowing only a common rigid rotation. It never merges pieces by similar sizes, compares bounding boxes, or estimates a cubic silhouette. A 29 mm edge and a 30 mm edge remain distinct in the model.

For custom parameter sets with indistinguishable or symmetric piece shapes, this deliberately remains an identity-and-orientation goal. It does not enumerate additional visually equivalent arrangements. The owner's confirmed geometry has distinct local sizes; supporting other visual equivalences would require a separate explicit decision.

### What this predicate does not validate

`isSolved` is not an arbitrary JSON parser or a complete physical-reachability validator. It rejects structurally typed states that fail the solved conditions, including missing/duplicate/unknown IDs or invalid rotations, but `false` does not distinguish a legal unsolved state from an impossible state. Untrusted or incomplete photo input must be parsed and validated separately before search. `validatePuzzleState` now provides that plain-data boundary for the discrete state shape, without recognizing images or repairing uncertain input.

The 24 rotations refer to **face-aligned puzzle coordinates**, not the continuous camera pose of a photograph. Photo reconstruction must separate camera/puzzle-frame estimation from discrete piece slots and orientations. Floating-point camera transforms do not belong in the goal predicate.

The UI is unchanged in this stage. Its “Ready to turn” message still reports interaction readiness, not solvedness.

## Selected search direction: IDA*

Use iterative-deepening A* (IDA*) over compact corner coordinates. It searches with an increasing bound on `movesSoFar + lowerBoundToGoal`, retaining a search path rather than a full visited graph of puzzle states. This is suitable for a browser-based 2×2 solver without a server dependency.

All quarter-turns and half-turns count as one move (face-turn metric). A completed search with admissible heuristics and sound pruning can return a shortest sequence in that metric; this does not imply minimum quarter-turn count or shortest animation time. Runtime and memory usage still need measurement before making responsiveness guarantees.

### Normalization and coordinates

1. Validate the input's identities, slots, proper orientations, pose consistency, and corner-twist constraint. Do not reject odd corner permutations: a legal quarter-turn is itself an odd permutation of four corners on a 2×2.
2. Use piece `---` as a reference corner. Mathematically rotate the input frame by the inverse of that corner's orientation, putting it at its home slot with identity orientation. This is a coordinate change, not a physical move or an animation.
3. Encode the remaining seven-corner permutation (`7! = 5,040` possibilities) and six independent corner twists (`3^6 = 729` possibilities); the remaining twist follows from the twist-sum constraint.
4. Future search will use R, U, and F with all three angles in this normalized frame. These faces do not move the reference corner. Opposite-face turns are equivalent to inverse turns of the other layer up to a whole-cube rotation, consistent with the goal's global-rotation equivalence.
5. Map the resulting face normals back to the original puzzle frame using the saved reference orientation. Preserve the outside-looking-in turn convention. The caller should receive ordinary `Move` values usable by `applyMove` and the existing renderer, not instructions tied to the normalization frame.

This gives `7! × 3^6 = 3,674,160` legal states modulo whole-cube rotation. The implemented corner-twist convention, validation, encoder/decoder, and frame-to-world move mapping are detailed in the [state-encoding guide](state-encoding.md). Twist uses a consistent cyclic ordering of outward normals, not a naive single-axis label.

### Planned lower bounds and pruning

Build small breadth-first distance tables separately for the permutation and twist coordinates using the same nine normalized moves. Use the **maximum**, not the sum, of their distances as the heuristic: one physical turn can improve both coordinates, so summing may overestimate.

Initially prune consecutive turns of the same face, since they can be combined into one supported turn or canceled. Add other pruning only with correctness tests. Table generation and the transition encoding must agree with the existing exact move model.

Do not use reversed history as a fallback solver or call a search limit “unsolvable.” Distinguish a found solution, a validated solved input (empty sequence), invalid input, and interrupted/budget-limited search.

### Integration and verification plan

Implement in small stages:

1. **Implemented:** input validation, reference-frame normalization, compact coordinates, and move mapping, with round-trip and move-equivalence tests.
2. **Next:** heuristic/transition tables and the pure search engine, with independently verified solutions and small-depth shortest-path checks.
3. **Later:** browser worker integration, cancellation/stale-result protection, and bilingual result handling before animated solution playback.

The worker should receive a puzzle-state snapshot, not React state or history. Applying a result must be tied to the snapshot that was searched. Do not block the main thread with an unbounded search or apply a late result to a changed puzzle.

Search verification must apply every returned sequence through the existing `applyMove` implementation and require `isSolved(result)`. Tests must include all global frames, mixed states provided without their generating moves, input rejection, and cancellation/limits. The expected state should not be reconstructed using only the same compact encoding being tested.

No empty solver/worker modules, external solver libraries, image models, or network services are added in this stage.

## Current automated checks

`src/puzzle/solved.test.ts` independently enumerates signed permutation matrices by permutation parity, rather than reusing the predicate's cross-product test. It checks:

- all 24 proper frames accepted and all 24 improper frames rejected;
- every face/angle move from every solved frame, followed by its inverse;
- whole-cube rotations composed of opposite face turns;
- slots and orientations both required, including a corner twisted in its home slot;
- missing, duplicate, unknown, or swapped identities and inconsistent slots;
- non-exact, non-finite, repeated-axis, and scaled orientations rejected;
- agreement with an explicit 24-goal oracle throughout a mixed legal walk;
- close dimensions, reordered/deserialized states, and frozen-input non-mutation.

`src/puzzle/validation.test.ts` and `src/solver/coordinates.test.ts` additionally verify reachability constraints, clean snapshots, all coordinate-factor ranges, history-free round-trips, and move equivalence through all global frames. See the state-encoding guide for coverage and limits.

Run `npm test` and `npm run build`. There are no UI or renderer changes to visually verify in this stage.
