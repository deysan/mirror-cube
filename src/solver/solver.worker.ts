import { createSolverHandler } from "./workerHandler";
import type { SolverRequest } from "./workerProtocol";

const handle = createSolverHandler();
self.onmessage = (event: MessageEvent<SolverRequest>) => {
  self.postMessage(handle(event.data));
};
