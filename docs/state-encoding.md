# State validation and solver coordinates

## Scope

These modules implement the history-independent input boundary for the solver:

- `src/puzzle/validation.ts`: validate plain structured data and return a clean state or a diagnostic code;
- `src/puzzle/orientation.ts`: shared exact rotation operations, also used by solvedness;
- `src/puzzle/corners.ts`: canonical piece/slot order and the corner-twist convention;
- `src/solver/coordinates.ts`: encode/decode normalized states and map moves back to the input frame.

Transition/distance tables and pure search are implemented separately (see [solver tables](solver-tables.md) and [IDA* search](solver-search.md)). [Worker integration](solver-worker.md) now consumes committed snapshots; imported-state UI and photo recognition are not implemented yet. These functions do not import React or Three.js, consult history, or modify piece definitions.

## Validation API

```ts
import { validatePuzzleState } from "./puzzle/validation";

const result = validatePuzzleState(candidate); // candidate: unknown
if (result.valid) {
  const state = result.state;
} else {
  const { code, cornerIndex } = result.error;
}
```

The boundary accepts plain data in the `PuzzleState` shape, such as the result of JSON parsing or a future recognizer's candidate state. It does not parse raw JSON strings, estimate camera pose, infer missing pieces, or make uncertain observations exact. Objects with executable getters/proxies are outside this plain-data contract.

Checks run in this order:

1. Root/corner object structure and exactly eight corners.
2. Known home-sign piece IDs, each used once.
3. Slots with three exact ±1 coordinates, each occupied once.
4. Orientation columns forming a proper signed-axis rotation, not a reflection.
5. Each slot equals the orientation applied to that piece's home slot.
6. The sum of all corner twists is zero modulo three.

For this eight-corner 2×2 model, these are the reachability constraints. **No even-permutation constraint is imposed.** A face quarter-turn is an odd four-cycle; unlike a 3×3, there are no edge pieces whose permutation parity must match.

On success, the result is an independent snapshot in this canonical identity order:

```text
---  --+  -+-  -++  +--  +-+  ++-  +++
```

Extra fields (including any supplied history) are ignored. Nested pose data is copied. Negative zero in orientations is canonicalized to zero; other values are not rounded, coerced, or repaired. As with the existing model, readonly types do not imply runtime freezing.

On failure, no partial state is returned. The first error has a stable, language-independent code:

| Code | Meaning |
| --- | --- |
| `structure` | Missing or malformed root, corner array, or corner record |
| `corner-count` | Not exactly eight corners |
| `piece-id` / `duplicate-piece` | Unknown or repeated identity |
| `slot` / `duplicate-slot` | Invalid or repeated slot |
| `orientation` | Missing, malformed, or improper orientation |
| `pose` | Slot and orientation disagree for that piece |
| `twist-sum` | The corner twists cannot be obtained by legal turns |

`cornerIndex`, when present, refers to the original supplied array, not the canonical order. User-facing translations of these diagnostics will be added with solver input/result UI; these are not UI messages yet. `isSolved` remains a separate goal predicate, not an unknown-input validator.

## Corner-twist convention

Each signed slot defines three outward normals, ordered with its U/D normal first and a common cyclic handedness (determinant −1):

| Slot | Ordered normals |
| --- | --- |
| `---` | D, B, L |
| `--+` | D, L, F |
| `-+-` | U, L, B |
| `-++` | U, F, L |
| `+--` | D, R, B |
| `+-+` | D, F, R |
| `++-` | U, B, R |
| `+++` | U, R, F |

Twist is the destination index (0, 1, or 2) of the piece's original U/D outward normal after applying its orientation. For a valid pose, the other normals follow the same cyclic shift. `cornerOrientation(pieceId, slot, twist)` constructs that rotation by mapping source normal `j` to destination normal `(j + twist) % 3`.

Using consistent cyclic orders is essential: checking only whether a local axis points along world X, Y, or Z loses the sign/slot convention and can produce a wrong twist sum. Legal moves preserve the total twist modulo three. One isolated corner twist is rejected; a balanced pair is allowed.

The low-level corner and rotation helpers operate on known piece IDs and valid signed slots/rotations. Untrusted input must enter through validation or encoding, not those helpers.

## Encoding API and reference frame

```ts
import { encodeState, decodeState, mapMoveFromFrame } from "./solver/coordinates";

const result = encodeState(candidate); // validates first; no history argument
if (result.valid) {
  const { coordinates, frame } = result;
  const normalized = decodeState(coordinates);
  const restored = decodeState(coordinates, frame);
  const worldMove = mapMoveFromFrame({ face: "R", turns: 1 }, frame);
}
```

The encoder returns validation errors unchanged. On success it uses the current orientation `A` of piece `---` as `frame`, and rotates the validated snapshot by `A⁻¹` (the transpose) to normalize it. Pose consistency guarantees that this places the reference piece at `---` with identity orientation. This is a mathematical coordinate change, **not a physical turn**.

All 24 global rotations of one state share the same coordinates. Keeping `frame` allows the decoder to restore the original physical frame exactly, in canonical piece order. Without it, decoding returns the reference-normalized state.

The compact record has two integer fields:

- `permutation` in **0..5039**: the lexicographic Lehmer rank of the seven non-reference identities, read in canonical slot order excluding `---`;
- `twist` in **0..728**: six base-three digits, most significant first, for slots `--+` through `++-`. The reference twist is zero; the twist at `+++` is recovered from the modulo-three sum.

The exported exclusive bounds are `PERMUTATION_COUNT = 5040` and `TWIST_COUNT = 729`. The pair `{ permutation: 0, twist: 0 }` is the normalized solved state. Every coordinate pair denotes a legal normalized state: `7! × 3^6 = 3,674,160` states in total. The coordinates identify pieces, not size classes; close dimensions and symmetric custom shapes do not merge identities.

`decodeState` accepts typed coordinates and an optional typed orientation. It throws `RangeError` for noninteger/out-of-range coordinates or an improper frame. Outputs do not reuse input pose objects. This encoding is an internal solver representation, not a versioned file/export format yet.

## Move mapping

`mapMoveFromFrame(move, frame)` rotates the move's outward face normal by the saved frame. The resulting face may be any of U/D/L/R/F/B. The angle/direction value is unchanged because a proper rotation preserves clockwise viewed from outside a face.

For example, a +90° global Z frame maps normalized R clockwise to world U clockwise, and normalized U counterclockwise to world L counterclockwise. It must not reverse the turn value merely because the destination uses a negative world axis.

Search uses R/U/F in the normalized frame. None moves the `---` reference corner, so the saved frame remains constant throughout a solution. Tests verify that applying mapped moves in the original frame equals applying normalized moves then transforming the state.

## Verification and limits

Automated tests cover:

- malformed plain data, duplicate identities/slots, reflections, inconsistent poses, nonfinite and approximate values;
- single/improperly balanced corner twists rejected, balanced twists and odd permutations accepted;
- explicit R/F/U twist fixtures and 1,000-move history-free legal walks;
- exactly three proper poses for each of the 64 piece/slot combinations;
- all 24 global frames, normalization equivalence, and exact restoration;
- all 5,040 permutation ranks with varying twists, and all 729 twist ranks at several permutations;
- explicit rank/digit conventions, no coordinate collisions in those exhaustive factor checks, and range rejection;
- all 18 moves mapped through every frame and the R/U/F reference invariant;
- copied data, negative-zero handling, non-mutation of frozen inputs, and preserved close-size identities.

The codec tests exhaustively cover factor ranges, not all 3,674,160 full-pose round-trips. A separate test-only BFS in the search suite now enumerates the complete coordinate graph. Existing exact move rules and solvedness tests remain independent checks. Search measurements and verification limits are documented in the search guide; no photo-recognition accuracy is claimed.

Run `npm test` and `npm run build`. There are no UI/rendering changes requiring a new browser review in this stage.
