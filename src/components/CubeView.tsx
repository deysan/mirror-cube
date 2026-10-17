import { useId } from "react";
import type { SolvedCube } from "../puzzle/model";
import { getVisibleSolvedFaces, projectIsometric } from "../rendering/solvedView";

interface CubeViewProps {
  readonly cube: SolvedCube;
}

export function CubeView({ cube }: CubeViewProps) {
  const titleId = useId();
  const descriptionId = useId();
  const faces = getVisibleSolvedFaces(cube).map((face) => ({
    ...face,
    points: face.vertices.map(projectIsometric),
  }));
  const points = faces.flatMap((face) => face.points);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const padding = cube.edgeLength * 0.15;
  const viewBox = [
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2,
  ].join(" ");

  return (
    <svg
      className="cube-view"
      viewBox={viewBox}
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
    >
      <title id={titleId}>Solved 2×2 Mirror Cube</title>
      <desc id={descriptionId}>
        An isometric view of the top and two sides. Unequal divisions show the
        different piece dimensions. The puzzle is static and cannot be turned yet.
      </desc>
      {faces.map((face) => (
        <polygon
          key={`${face.pieceId}:${face.side}`}
          className={`cube-face cube-face--${face.side}`}
          points={face.points.map(({ x, y }) => `${x},${y}`).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
