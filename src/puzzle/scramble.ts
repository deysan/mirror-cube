import { FACE_LAYERS, type Face, type Move } from "./moves";

export const SCRAMBLE_LENGTH = 12;
const faces: readonly Face[] = ["U", "D", "L", "R", "F", "B"];
const turns: readonly Move["turns"][] = [1, -1, 2];

/** A random walk, not a uniform random-state or competition scramble generator. */
export function createScramble(random: () => number = Math.random): readonly Move[] {
  function pick<T>(values: readonly T[]): T {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("Random samples must be finite numbers in [0, 1).");
    }
    return values[Math.floor(sample * values.length)]!;
  }

  const moves: Move[] = [];
  for (let index = 0; index < SCRAMBLE_LENGTH; index++) {
    const previous = moves.at(-1);
    // Select directly from candidates: even a constant RNG cannot cause a retry loop.
    const candidates = faces.filter((face) =>
      !previous || FACE_LAYERS[face].axis !== FACE_LAYERS[previous.face].axis,
    );
    moves.push({ face: pick(candidates), turns: pick(turns) });
  }
  return moves;
}
