import { describe, expect, it } from "vitest";
import { Box3, OrthographicCamera, Vector3 } from "three";
import { PIECE_IDS, cornerOrientation, homeSlot } from "../puzzle/corners";
import { placementDimensions } from "../puzzle/draft";
import { createSolvedCube, MIRRORED_CUBE_PARAMETERS } from "../puzzle/model";
import { createPieceMatrix, getPuzzleRadius } from "./pieceTransform";
import { dimensionBox, faceLabelReservations, projectDimensions } from "./dimensions";
import { editorCameraZoom } from "./inspectionOrbit";
const cube = createSolvedCube(MIRRORED_CUBE_PARAMETERS);

describe("exact projected measurement guides", () => {
  it("projects arbitrary orbit angles without changing lengths and omits end-on axes rather than inventing a visible length", () => {
    const camera=new OrthographicCamera(-140,140,105,-105,.1,2000), radius=getPuzzleRadius(cube);
    camera.zoom=editorCameraZoom(radius,280,210);camera.updateProjectionMatrix();
    for(const direction of [[1,0,0],[0,1,0],[0,0,-1],[.01,1,.01],[1,-.6,.2],[-.8,.2,-1]]) {
      camera.position.set(direction[0]!*160,direction[1]!*160,direction[2]!*160);camera.lookAt(0,0,0);
      for(const piece of cube.pieces) for(const slot of PIECE_IDS) for(const twist of [0,1,2]) {
        const d=placementDimensions(piece,slot,twist),before={...d};
        const drawing=projectDimensions(camera,280,210,d,slot,{reserved:faceLabelReservations(camera,280,210,radius),avoidPiece:true});
        expect(d).toEqual(before);
        for(const r of drawing.rulers){
          expect(r.value).toBe(d[r.axis]);
          for(const point of [...r.edge,...r.line,r.label]) expect(point.every(Number.isFinite)).toBe(true);
          expect(r.label[0]).toBeGreaterThanOrEqual(46);expect(r.label[0]).toBeLessThanOrEqual(234);
          expect(r.label[1]).toBeGreaterThanOrEqual(15);expect(r.label[1]).toBeLessThanOrEqual(195);
        }
        if(direction[0]===1&&direction[1]===0)expect(drawing.rulers.map(r=>r.axis)).toEqual(["y","z"]);
      }
    }
  });
  it("uses the actual transformed mesh bounds and keeps the inner vertex at the mechanism origin for every pose", () => {
    for(const piece of cube.pieces) for(const slot of PIECE_IDS) for(const twist of [0,1,2]) {
      const d=placementDimensions(piece,slot,twist), box=dimensionBox(d,slot);
      const {x,y,z}=piece.dimensions;
      const actual=new Box3(new Vector3(-x/2,-y/2,-z/2),new Vector3(x/2,y/2,z/2))
        .applyMatrix4(createPieceMatrix(piece,cornerOrientation(piece.id,homeSlot(slot),twist)));
      expect(box.min).toEqual(actual.min);expect(box.max).toEqual(actual.max);
      expect(box.vertices.some(v=>v.length()===0)).toBe(true);
    }
  });
  it("keeps main-view labels finite, inside the viewport, and separated across all poses and inspection corners", () => {
    const radius=getPuzzleRadius(cube);
    for(const [width,height]of [[240,160],[560,500]]) for(const view of PIECE_IDS) {
      const camera=new OrthographicCamera(-width!/2,width!/2,height!/2,-height!/2,.1,2000), signs=homeSlot(view);
      camera.position.set(signs.x*radius*3,signs.y*radius*3,signs.z*radius*3);camera.lookAt(0,0,0);
      camera.zoom=editorCameraZoom(radius,width!,height!);camera.updateProjectionMatrix();
      for(const piece of cube.pieces) for(const slot of PIECE_IDS) for(const twist of [0,1,2]) {
        const d=placementDimensions(piece,slot,twist), reserved=faceLabelReservations(camera,width!,height!,radius);
        const drawing=projectDimensions(camera,width!,height!,d,slot,{reserved,avoidPiece:true});
        expect(drawing.rulers).toHaveLength(3);
        drawing.rulers.forEach((r,i)=>{
          expect(r.value).toBe(d[r.axis]);expect(r.label[0]).toBeGreaterThanOrEqual(46);expect(r.label[0]).toBeLessThanOrEqual(width!-46);
          expect(r.label[1]).toBeGreaterThanOrEqual(15);expect(r.label[1]).toBeLessThanOrEqual(height!-15);
          const points=dimensionBox(d,slot).vertices.map(v=>{
            const p=v.project(camera); return [(p.x+1)*width!/2,(1-p.y)*height!/2] as const;
          });
          expect(r.label[0]+42<=Math.min(...points.map(p=>p[0])) || r.label[0]-42>=Math.max(...points.map(p=>p[0])) ||
            r.label[1]+11<=Math.min(...points.map(p=>p[1])) || r.label[1]-11>=Math.max(...points.map(p=>p[1])), JSON.stringify({width,height,view,piece:piece.id,slot,twist,axis:r.axis,label:r.label,points})).toBe(true);
          for(const other of reserved) expect(Math.abs(r.label[0]-other.position[0])>=42+other.halfWidth || Math.abs(r.label[1]-other.position[1])>=11+other.halfHeight).toBe(true);
          for(const other of drawing.rulers.slice(0,i)) expect(Math.abs(r.label[0]-other.label[0])>=84 || Math.abs(r.label[1]-other.label[1])>=22).toBe(true);
          for(const p of [...r.edge,...r.line,r.label])expect(p.every(Number.isFinite)).toBe(true);
          expect(r.line[1][0]-r.line[0][0]).toBeCloseTo(r.edge[1][0]-r.edge[0][0],8);
          expect(r.line[1][1]-r.line[0][1]).toBeCloseTo(r.edge[1][1]-r.edge[0][1],8);
        });
      }
    }
  });
});
