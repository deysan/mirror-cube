import type { SolverRequest, SolverResponse } from "../solver/workerProtocol";

/** Includes script loading and table initialization; browser timers may be throttled. */
export const SOLVER_WATCHDOG_MS = 15_000;

export interface SolverWorker {
  onmessage: ((event: MessageEvent<SolverResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: SolverRequest): void;
  terminate(): void;
}

const createWorker = (): SolverWorker => new Worker(
  new URL("../solver/solver.worker.ts", import.meta.url), { type: "module" },
);

interface PendingRequest {
  readonly id: number;
  readonly receive: (response: SolverResponse) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Browser resource ownership only. Search and table construction never run here. */
export class SolverClient {
  private worker: SolverWorker | null = null;
  private pending: PendingRequest | null = null;

  constructor(private readonly makeWorker = createWorker) {}

  start(request: SolverRequest, receive: (response: SolverResponse) => void): void {
    this.cancel();
    const pending: PendingRequest = {
      id: request.id, receive,
      timer: setTimeout(() => {
        if (this.pending === pending) this.fail("timeout");
      }, SOLVER_WATCHDOG_MS),
    };
    this.pending = pending;
    try {
      if (!this.worker) {
        const worker = this.makeWorker();
        this.worker = worker;
        worker.onmessage = ({ data }) => {
          // Worker identity also rejects queued events from terminated instances.
          if (this.worker !== worker || !this.pending || data?.id !== this.pending.id) return;
          this.finish(data);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          if (this.worker === worker) this.fail("worker");
        };
        worker.onmessageerror = () => {
          if (this.worker === worker) this.fail("worker");
        };
      }
      // Structured cloning at this boundary isolates the worker's input snapshot.
      this.worker.postMessage(request);
    } catch {
      this.fail("worker");
    }
  }

  /** A queued cancel message cannot interrupt synchronous work: terminate instead. */
  cancel(): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending = null;
    this.dropWorker();
  }

  dispose(): void {
    this.cancel();
    this.dropWorker();
  }

  private dropWorker(): void {
    if (!this.worker) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
    this.worker = null;
  }

  private fail(reason: "worker" | "timeout"): void {
    const pending = this.pending;
    this.dropWorker();
    if (pending) this.finish({ id: pending.id, result: { status: "error", reason } });
  }

  private finish(response: SolverResponse): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    if (response.result.status === "error") this.dropWorker();
    pending.receive(response);
  }
}
