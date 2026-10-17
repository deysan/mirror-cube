import { FACE_LAYERS, type Move } from "../puzzle/moves";

export function getTurnDuration(move: Move): number {
  return move.turns === 2 ? 0.9 : 0.6;
}

/** Visual radians only; completed puzzle states never use this floating-point angle. */
export function getTurnAngle(move: Move, progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t * t * (3 - 2 * t);
  return -FACE_LAYERS[move.face].side * move.turns * (Math.PI / 2) * eased;
}
