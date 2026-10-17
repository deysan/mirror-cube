# Discrete state and move rules

## Scope

`src/puzzle/state.ts` and `src/puzzle/moves.ts` implement complete face turns without React, SVG, Three.js, or animation. The browser still displays the static solved cube; these rules are not wired into controls yet.

The functions operate on valid states created by `createSolvedState` and subsequent moves. They are not a validator or importer for arbitrary serialized puzzle states. Solved-state detection and solution search are separate future work.

## Definitions versus state

`createSolvedCube` produces the piece definitions: stable IDs, exact local dimensions, and minimum corners in the solved pose. A turn never modifies these definitions.

`createSolvedState(cube)` creates a separate `PuzzleState` containing eight corners:

- `pieceId` links a pose to its immutable piece definition.
- `slot` gives the current octant as three signs, each `-1` or `+1`. This is a logical location, not a center or a length in millimeters.
- `orientation` stores the directions of the piece's local X, Y, and Z axes in world coordinates. They are the columns of a rotation matrix.

The corner array remains in stable piece order. A move returns a new state and new poses for the four moving corners, while sharing unchanged poses. Data is readonly at the TypeScript level, not frozen at runtime.

Orientations contain only `-1`, `0`, and `+1`, form perpendicular unit axes, and have determinant `+1`. No trigonometry, floating-point angles, or tolerance-based comparisons are used for completed turns. Negative zero is normalized to zero.

## Coordinate and direction conventions

The origin is the intersection of the three split planes. It is not the outer cube's geometric center. The fixed world frame has positive X to the right, positive Y upward, and positive Z toward the front.

| Face | Name | Current layer |
| --- | --- | --- |
| `R` | Right | `slot.x === +1` |
| `L` | Left | `slot.x === -1` |
| `U` | Up | `slot.y === +1` |
| `D` | Down | `slot.y === -1` |
| `F` | Front | `slot.z === +1` |
| `B` | Back | `slot.z === -1` |

Face names refer to this frame, not to the currently largest or furthest visible surface. Layer membership is read from the current slot, never from the original piece ID.

A `Move` contains a `face` and `turns`:

- `1`: 90 degrees clockwise **when looking directly at that face from outside**;
- `-1`: 90 degrees counterclockwise from that same viewpoint;
- `2`: 180 degrees, which is its own inverse.

Clockwise corresponds to a negative right-handed rotation about the face's outward normal. Negative-side faces therefore reverse the sign relative to their positive world axis. Internally, quarter-turns are normalized to 1, 2, or 3 positive right-handed steps:

| Rotation axis | One positive right-handed quarter-turn |
| --- | --- |
| X | `(x, y, z) → (x, -z, y)` |
| Y | `(x, y, z) → (z, y, -x)` |
| Z | `(x, y, z) → (-y, x, z)` |

The same rotation is applied to the corner's slot and all three orientation axes.

## Why this represents a shape-changing puzzle

The renderer must not place pieces at uniform slot centers. A piece's actual geometry is obtained by applying its orientation to its original solved coordinates about the split intersection:

```text
worldPoint = orientation.x * solvedPoint.x
           + orientation.y * solvedPoint.y
           + orientation.z * solvedPoint.z
```

For the default `+++` piece, dimensions are `28 × 30 × 33` mm. Its solved box is `[0,28] × [0,30] × [0,33]`. A clockwise front turn maps `(x,y,z)` to `(y,-x,z)`, so this box becomes `[0,30] × [-28,0] × [0,33]`. Its local dimensions remain unchanged, but it now protrudes beyond parts of the original cube.

The current slot is `(1,-1,1)`, while the actual geometric center is `(15,-14,16.5)` mm. These values serve different purposes and must not be confused.

This rigid orientation representation also preserves close dimensions, such as 29 mm and 30 mm, without merging pieces or rounding.

## API example

Imports below assume a caller under `src/`:

```ts
import { createSolvedCube } from "./puzzle/model";
import { createSolvedState } from "./puzzle/state";
import { applyMove, inverseMove, type Move } from "./puzzle/moves";

const definition = createSolvedCube();
const initial = createSolvedState(definition);
const move: Move = { face: "F", turns: 1 };
const turned = applyMove(initial, move);
const restored = applyMove(turned, inverseMove(move));
// restored is deeply equal to initial; neither input was mutated.
```

`inverseMove` is a move utility, not a solution-search algorithm. Reversing a known sequence is only a test of reversibility here, not an implementation of history, undo UI, or a solver.

## Verification

`src/puzzle/moves.test.ts` checks:

- all eight initial slots and identity orientations;
- explicit expected clockwise positions and orientations for every face;
- each of the 18 face/angle combinations followed by its inverse;
- four quarter-turns in either direction and equivalence of half-turns to two quarter-turns;
- exactly four affected corners selected by their current layer, from both solved and mixed states;
- restoration after reversing a mixed sequence;
- non-mutation of frozen input states and piece definitions;
- unique slots and identities, proper orientations, and exact local edge lengths through 300 deterministic moves;
- a concrete transformed box corner and center for an asymmetric piece;
- preservation of a one-millimeter dimension difference after rotation.

## Rendering and animation boundary

The Three.js/React Three Fiber scene renders this data but does not own the puzzle rules. `src/rendering/pieceTransform.ts` converts each orientation and solved center into a mesh matrix. The mathematical modules do not import Three.js.

The static scene and animated manual controls are separate stages; animation is not implemented yet. Intermediate animation angles will belong only to the visual layer. The exact next discrete state will be committed after a completed animation; it must not be reconstructed from floating-point mesh transforms.
