/** Plain overlay data shared with the DOM UI; intentionally no Three.js imports. */
export const DIMENSION_AXES = ["x", "y", "z"] as const;
export type DimensionAxis = typeof DIMENSION_AXES[number];
export const AXIS_COLORS = { x: "#ffb45b", y: "#73d9ff", z: "#d5afff" } as const;
export type Point2 = readonly [number, number];
export interface LabelReservation { readonly position: Point2; readonly halfWidth: number; readonly halfHeight: number }
export interface DimensionRuler {
  readonly axis: DimensionAxis;
  readonly face: string;
  readonly value: number;
  readonly edge: readonly [Point2, Point2];
  readonly line: readonly [Point2, Point2];
  readonly label: Point2;
}
export interface DimensionDrawing {
  readonly width: number; readonly height: number;
  readonly rulers: readonly DimensionRuler[];
}
