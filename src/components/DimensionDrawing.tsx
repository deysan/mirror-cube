import { useId } from "react";
import { AXIS_COLORS, DIMENSION_AXES, type DimensionDrawing as Drawing } from "../rendering/dimensionDrawing";

/** Accessible equivalents live in the face-labeled dimension list; this SVG never handles pointer input. */
export function DimensionDrawing({ drawing, unit }: { drawing: Drawing; unit: string }) {
  const id = useId();
  const line = (a: readonly number[], b: readonly number[]) => ({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
  return <svg className="dimension-overlay" aria-hidden="true" focusable="false"
    viewBox={`0 0 ${drawing.width} ${drawing.height}`}>
    <defs>{DIMENSION_AXES.map(axis => <marker key={axis} id={`${id}-${axis}`} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      <path d="M0 0 L6 3 L0 6 Z" fill={AXIS_COLORS[axis]} />
    </marker>)}</defs>
    {drawing.rulers.map(r => <g key={r.axis} data-dimension-axis={r.axis} stroke={AXIS_COLORS[r.axis]}>
      <line {...line(r.edge[0], r.line[0])} opacity="0.8" />
      <line {...line(r.edge[1], r.line[1])} opacity="0.8" />
      <line {...line(r.line[0], r.line[1])} strokeWidth="1.5" markerStart={`url(#${id}-${r.axis})`} markerEnd={`url(#${id}-${r.axis})`} />
      <line {...line([(r.line[0][0] + r.line[1][0]) / 2, (r.line[0][1] + r.line[1][1]) / 2], r.label)} strokeDasharray="2 2" />
      <rect x={r.label[0] - 42} y={r.label[1] - 11} width="84" height="22" rx="5" fill="#182832" />
      <text x={r.label[0]} y={r.label[1] + 5} textAnchor="middle" fontSize="14" fill={AXIS_COLORS[r.axis]} stroke="none">{r.face} · {r.value} {unit}</text>
    </g>)}
  </svg>;
}
