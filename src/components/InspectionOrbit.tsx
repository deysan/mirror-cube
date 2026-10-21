import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { createInspectionOrbit } from "../rendering/inspectionOrbit";

/** Keep the click/drag guard alive throughout editing, including transitions back to presets. */
export function InspectionOrbit({ enabled }: { enabled: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const resource = useRef<ReturnType<typeof createInspectionOrbit> | null>(null);
  useLayoutEffect(() => {
    const orbit = createInspectionOrbit(camera, gl.domElement, invalidate);
    resource.current = orbit;
    return () => { orbit.dispose(); resource.current = null; };
  }, [camera, gl, invalidate]);
  useLayoutEffect(() => { resource.current?.setEnabled(enabled); }, [enabled, camera, gl, invalidate]);
  return null;
}
