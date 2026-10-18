import { useEffect, useRef } from "react";
import type { SolverRequest, SolverResponse } from "../solver/workerProtocol";
import { SolverClient } from "./solverClient";

/** Stable request objects/callbacks avoid restarting work on unrelated UI renders. */
export function useSolverWorker(request: SolverRequest | null, receive: (response: SolverResponse) => void): void {
  const clientRef = useRef<SolverClient | null>(null);
  useEffect(() => {
    const client = new SolverClient();
    clientRef.current = client;
    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (request) clientRef.current!.start(request, receive);
    else clientRef.current!.cancel();
  }, [request, receive]);
}
