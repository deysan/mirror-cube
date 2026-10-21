# User guide

## Start with a virtual cube

Choose an angle/direction, then a face. Four highlighted pieces turn together; the state and history update only when the animation completes. **Scramble** performs twelve turns from the current state, without resetting earlier moves. It is a random walk, not a competition scramble or a difficulty guarantee.

**Undo last move** animates the inverse of the latest recorded move. There is no general redo. **Reset cube** restores the solved model and clears history and the solution after confirmation; it cannot be undone.

## Recreate a physical cube

1. Hold the physical cube in a fixed reference frame: **U** top, **F** front, **R** right. Do not turn its layers while entering the state.
2. Choose **Build a physical cube state**. The isolated draft starts empty.
3. Select one of eight corner positions using its button or a visible piece/empty target in the 3D view.
4. Choose a piece from the palette. Numbers identify pieces in this app, not manufacturer markings. Compare all three body dimensions, not sticker borders.
5. Cycle its **three proper orientations**. The edge rulers and face-labeled text show the selected pose's exact lengths.
6. Inspect the model from the presets or enable **Free inspection**. Drag with the left mouse button or one finger; short clicks/taps select, while drags do not. This changes the camera, not the pieces or reference faces.
7. Once all eight pieces are placed and validation succeeds, choose **Use this state** and confirm that the model matches the physical cube.
8. Choose **Find solution**, then follow the animated instructions.

Each identity can occupy only one position. Remove a piece before assigning it elsewhere. Replacing a piece resets only that position's orientation. A single unbalanced corner twist is invalid; the editor never repairs it automatically.

The app uses the fixed [geometry](architecture.md#geometry-and-reference-frame). Piece 2 (`--+`, 22×20×17 mm), initially assigned to UFR, has R=22, U=20, F=17 mm. If no orientation matches, check the model, reference frame, and identity rather than treating similar pieces as interchangeable. A mechanically valid draft does not prove an accurate physical match.

**Copy current virtual state** is a starting point, not recognition. Replacing, clearing, or cancelling a populated draft requires confirmation. Cancel preserves the previous cube, history, and solution; apply validates again and replaces them with a history-free input. An open draft never goes to the solver.

### Inspection and dimensions

- Presets, **Look at selected position**, and **Solution view (U/F/R)** leave free mode. Turning free mode off restores the last preset.
- Language changes and resizing preserve the free camera angle. Leaving the builder restores the solution camera; reopening starts in fixed mode.
- There is no free zoom, pan, roll, or two-finger camera gesture.
- Rulers follow the camera, but remain display overlays: an annotated edge may be hidden behind another piece. Near end-on edges may omit their ruler; all three exact lengths remain in text.
- There is no arbitrary dimension entry, isolated enlarged-piece view, or automatic piece identification.

## Follow a solution

Search uses the current validated state, not its move history. Finding a solution does not turn the cube automatically. During search, conflicting controls are locked; cancellation and language switching remain available. A search limit is not a claim that the state is unsolvable.

Keep U on top, F toward you, and R on your right. In the standard view, F is the left visible side and R the right. **Clockwise is viewed directly from the named face**, including hidden L, D, and B faces. A prime means counterclockwise; `2` means a half-turn.

| Control | Behavior |
| --- | --- |
| Execute next step | Animate one verified move, then wait |
| Numbered step | Reach the state after that step, animating all intermediate forward or inverse turns |
| Back to solution start | Reverse only the completed solution prefix, not the original input |
| Show step again | Demonstrate the last completed step without changing state, history, or progress |

Keep the physical cube in sync when navigating. **Do not repeat a physical turn merely because you replay its demonstration.** To demonstrate another step, navigate there first.

Manual turns, ordinary undo, scrambling, or a new search discard the old plan. There is no mid-turn pause/cancel or adjustable animation speed. Reduced-motion preference skips interpolation while retaining exact state updates.

## Session and browser limits

English/Ukrainian switching preserves the current session. Reloading does not: there is no draft export, saved progress, or persisted language selection.

WebGL 2 is required. If the scene fails, controls are disabled and the last committed puzzle is preserved in memory; an unfinished turn is not applied. An open draft can be cancelled. Reload to retry rendering, knowing that it clears the session.

The model uses ideal cuboids without stickers, bevels, gaps, or a mechanism. The manual workflow has been used successfully with a matching physical cube, but this does not establish compatibility with arbitrary Mirror Cube models. Photo import is not part of the current application.
