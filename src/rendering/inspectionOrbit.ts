import { MOUSE, TOUCH, type Camera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Editor-only DOM resource. Neither puzzle state nor a selection callback enters here. */
export function createInspectionOrbit(camera: Camera, element: HTMLElement, invalidate: () => void) {
  const controls = new OrbitControls(camera);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.autoRotate = false;
  controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: null, RIGHT: null };
  controls.touches = { ONE: TOUCH.ROTATE, TWO: null };
  controls.target.set(0, 0, 0);
  const document = element.ownerDocument, window = document.defaultView;
  const previous = { touchAction: element.style.touchAction, cursor: element.style.cursor };
  const pointers = new Map<number, { x: number; y: number }>();
  let enabled = false, connected = false, disposed = false, suppressClick = false;
  const restoreStyle = () => { element.style.touchAction = previous.touchAction; element.style.cursor = previous.cursor; };
  const disconnect = () => {
    if (connected) { controls.disconnect(); connected = false; }
    restoreStyle();
  };
  const connect = () => { controls.connect(element); connected = true; controls.cursorStyle = "grab"; controls.update(); };
  const cancelPointers = () => {
    const ids = [...pointers.keys()]; pointers.clear();
    if (ids.length) suppressClick = true;
    for (const id of ids) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
  const restart = () => { disconnect(); cancelPointers(); if (enabled && !disposed) connect(); };
  const down = (event: PointerEvent) => {
    if (!pointers.size) suppressClick = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1 || (event.pointerType !== "touch" && event.button !== 0)) suppressClick = true;
  };
  const moved = (event: PointerEvent) => {
    const start = pointers.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) suppressClick = true;
    return !!start;
  };
  const move = (event: PointerEvent) => {
    // Do not orbit on click/tap jitter. Once a drag starts, retain that fact even after returning to its origin.
    if (moved(event) && enabled && !suppressClick) event.stopPropagation();
  };
  const up = (event: PointerEvent) => { moved(event); pointers.delete(event.pointerId); };
  const cancel = (event: PointerEvent) => {
    if (pointers.has(event.pointerId)) { suppressClick = true; pointers.delete(event.pointerId); }
  };
  const lostCapture = (event: PointerEvent) => { if (pointers.has(event.pointerId)) restart(); };
  const click = (event: MouseEvent) => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); }
  };
  const changed = () => invalidate();
  controls.addEventListener("change", changed);
  element.addEventListener("pointerdown", down, true);
  element.addEventListener("lostpointercapture", lostCapture);
  element.addEventListener("click", click, true);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", cancel, true);
  window?.addEventListener("blur", restart);

  return {
    setEnabled(value: boolean) {
      if (disposed || enabled === value) return;
      disconnect(); cancelPointers(); enabled = value;
      if (enabled) connect();
    },
    dispose() {
      if (disposed) return;
      disposed = true; disconnect(); cancelPointers();
      controls.removeEventListener("change", changed);
      element.removeEventListener("pointerdown", down, true);
      element.removeEventListener("lostpointercapture", lostCapture);
      element.removeEventListener("click", click, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
      window?.removeEventListener("blur", restart);
    },
  };
}

/** Reserve room for fixed-world face sprites even when an axis lies in the screen plane. */
export function editorCameraZoom(radius: number, width: number, height: number): number {
  const half = Math.min(width, height) / 2, distance = radius * 1.3;
  return Math.max(0.001, Math.min((half - 14) / distance, (half - 4) / (distance + 4)));
}
