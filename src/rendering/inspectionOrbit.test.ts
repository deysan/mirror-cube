// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrthographicCamera } from "three";
import { createInspectionOrbit, editorCameraZoom } from "./inspectionOrbit";

const resources: (() => void)[] = [];
afterEach(() => { resources.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); });
function setup() {
  const parent = document.createElement("div"), canvas = document.createElement("canvas");
  parent.append(canvas); document.body.append(parent);
  Object.defineProperty(canvas, "clientHeight", { value: 240 });
  const captures = new Set<number>();
  canvas.setPointerCapture = id => { captures.add(id); };
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => { captures.delete(id); };
  canvas.style.touchAction = "pan-y"; canvas.style.cursor = "crosshair";
  const camera = new OrthographicCamera(-120,120,120,-120,.1,2000);
  camera.position.set(160,160,160); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  const changed = vi.fn(), selected = vi.fn(); parent.addEventListener("click", selected);
  const orbit = createInspectionOrbit(camera, canvas, changed); resources.push(orbit.dispose);
  const pointer = (type: string, x: number, y: number, id = 1, pointerType = "mouse", target: EventTarget = canvas) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType } });
    target.dispatchEvent(event);
  };
  const click = () => canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return { orbit, canvas, camera, changed, selected, pointer, click, captures };
}

describe("editor orbit resources", () => {
  it("preserves short clicks and jitter, suppresses out-and-back drag selection, and never zooms or moves the target", () => {
    const {orbit,camera,pointer,click,selected,canvas,changed}=setup(); orbit.setEnabled(true);
    const position=camera.position.clone(), distance=position.length(), zoom=camera.zoom;
    pointer("pointerdown",100,100); pointer("pointermove",103,102); pointer("pointerup",103,102); click();
    expect(selected).toHaveBeenCalledTimes(1); expect(camera.position).toEqual(position);
    pointer("pointerdown",100,100); pointer("pointermove",140,130);
    expect(camera.position.equals(position)).toBe(false); expect(changed).toHaveBeenCalled();
    expect(camera.position.length()).toBeCloseTo(distance,8); expect(camera.zoom).toBe(zoom);
    pointer("pointermove",100,100); pointer("pointerup",100,100); click(); expect(selected).toHaveBeenCalledTimes(1);
    const end=camera.position.clone();
    canvas.dispatchEvent(new WheelEvent("wheel",{bubbles:true,cancelable:true,deltaY:100}));
    expect(camera.position).toEqual(end); expect(camera.zoom).toBe(zoom);
    pointer("pointerdown",100,100); pointer("pointerup",100,100); click(); expect(selected).toHaveBeenCalledTimes(2);
  });
  it("supports one-finger orbit, suppresses multi-touch selection, and ignores pinch/pan", () => {
    const {orbit,camera,pointer,click,selected}=setup(); orbit.setEnabled(true);
    pointer("pointerdown",50,50,1,"touch"); pointer("pointermove",70,60,1,"touch");
    const position=camera.position.clone(), zoom=camera.zoom;
    pointer("pointerdown",130,130,2,"touch");
    pointer("pointermove",30,30,1,"touch"); pointer("pointermove",150,150,2,"touch");
    expect(camera.position).toEqual(position); expect(camera.zoom).toBe(zoom);
    pointer("pointerup",30,30,1,"touch"); pointer("pointerup",150,150,2,"touch"); click();
    expect(selected).not.toHaveBeenCalled();
  });
  it("retains suppression across mode changes and releases capture/listeners/styles on disable and disposal", () => {
    const {orbit,camera,pointer,click,selected,canvas,captures}=setup(); orbit.setEnabled(true);
    pointer("pointerdown",50,50); pointer("pointermove",80,80); expect(captures.size).toBe(1);
    orbit.setEnabled(false); expect(captures.size).toBe(0);
    expect(canvas.style.touchAction).toBe("pan-y"); expect(canvas.style.cursor).toBe("crosshair");
    const position=camera.position.clone(); pointer("pointerup",80,80); click(); expect(selected).not.toHaveBeenCalled();
    pointer("pointerdown",50,50); pointer("pointermove",90,90); pointer("pointerup",90,90); click();
    expect(camera.position).toEqual(position); expect(selected).not.toHaveBeenCalled();
    orbit.setEnabled(true); pointer("pointerdown",10,10); orbit.dispose(); orbit.dispose();
    expect(captures.size).toBe(0); expect(canvas.style.touchAction).toBe("pan-y");
    const after=camera.position.clone(); pointer("pointermove",100,100,1,"mouse",document); pointer("pointerup",100,100);
    expect(camera.position).toEqual(after); click(); expect(selected).toHaveBeenCalledTimes(1);
  });
  it("recovers from cancellation, lost capture, and window blur without a stuck drag", () => {
    const {orbit,pointer,click,selected,canvas}=setup(); orbit.setEnabled(true);
    for(const interruption of ["pointercancel","lostpointercapture","blur"]){
      pointer("pointerdown",40,40); pointer("pointermove",80,80);
      if(interruption==="blur") window.dispatchEvent(new Event("blur")); else pointer(interruption,80,80);
      click(); expect(selected).not.toHaveBeenCalled();
      pointer("pointerdown",40,40); pointer("pointerup",40,40); click(); expect(selected).toHaveBeenCalledTimes(1); selected.mockClear();
      expect(canvas.style.touchAction).toBe("none");
    }
  });
  it("fits the body and screen-plane face sprites at small and large sizes", () => {
    const radius=Math.hypot(28,30,33);
    for(const [w,h] of [[240,160],[280,210],[640,560]]){
      const zoom=editorCameraZoom(radius,w!,h!), halfSprite=Math.max(10,4*zoom);
      expect(radius*1.3*zoom+halfSprite).toBeLessThanOrEqual(Math.min(w!,h!)/2-3.999);
      expect(radius*zoom).toBeLessThan(Math.min(w!,h!)/2);
    }
  });
});
