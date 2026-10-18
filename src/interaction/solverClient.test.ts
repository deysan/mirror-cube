import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { createSolvedState } from "../puzzle/state";
import type { SolverRequest, SolverResponse } from "../solver/workerProtocol";
import { SolverClient, SOLVER_WATCHDOG_MS, type SolverWorker } from "./solverClient";

class WorkerStub implements SolverWorker {
  onmessage: SolverWorker["onmessage"] = null;
  onerror: SolverWorker["onerror"] = null;
  onmessageerror: SolverWorker["onmessageerror"] = null;
  postMessage = vi.fn<(request: SolverRequest) => void>();
  terminate = vi.fn();
}
const request = { id: 1, state: createSolvedState(createSolvedCube()) };
const response: SolverResponse = { id: 1, result: { status: "solution", moves: [], visitedNodes: 0 } };
const event = (data: SolverResponse) => ({ data }) as MessageEvent<SolverResponse>;
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("solver worker ownership", () => {
  it("creates lazily, sends only the snapshot/request ID, and reuses a healthy worker", () => {
    const worker = new WorkerStub();
    const factory = vi.fn(() => worker);
    const receive = vi.fn();
    const client = new SolverClient(factory);
    expect(factory).not.toHaveBeenCalled();
    client.start(request, receive);
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(request);
    worker.onmessage!(event(response));
    expect(receive).toHaveBeenCalledExactlyOnceWith(response);
    client.cancel(); // The React effect clears the completed request; retain the idle worker.
    expect(worker.terminate).not.toHaveBeenCalled();
    client.start({ ...request, id: 2 }, receive);
    expect(factory).toHaveBeenCalledTimes(1);
    worker.onmessage!(event(response)); // Duplicate response to request 1 cannot complete 2.
    expect(receive).toHaveBeenCalledTimes(1);
    worker.onmessage!(event({ ...response, id: 2 }));
    expect(receive).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    client.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("terminates cancelled work, ignores captured late callbacks, and creates a fresh worker", () => {
    const oldWorker = new WorkerStub(), nextWorker = new WorkerStub();
    const factory = vi.fn().mockReturnValueOnce(oldWorker).mockReturnValue(nextWorker);
    const receive = vi.fn();
    const client = new SolverClient(factory);
    client.start(request, receive);
    const late = oldWorker.onmessage!;
    const lateError = oldWorker.onerror!;
    client.cancel();
    expect(oldWorker.terminate).toHaveBeenCalledTimes(1);
    expect(oldWorker.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    client.start({ ...request, id: 2 }, receive);
    // Even a forged matching ID from the obsolete worker is ignored by worker identity.
    late(event({ ...response, id: 2 }));
    lateError({ preventDefault() {} } as ErrorEvent);
    expect(receive).not.toHaveBeenCalled();
    expect(nextWorker.terminate).not.toHaveBeenCalled();
    nextWorker.onmessage!(event({ ...response, id: 2 }));
    expect(receive).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it("replaces rather than queues a request, and disposes pending work without callbacks", () => {
    const workers = [new WorkerStub(), new WorkerStub()];
    const client = new SolverClient(() => workers.shift()!);
    const first = workers[0]!, second = workers[1]!;
    const receive = vi.fn();
    client.start(request, receive);
    const late = first.onmessage!;
    client.start({ ...request, id: 2 }, receive);
    expect(first.terminate).toHaveBeenCalledTimes(1);
    client.dispose(); client.dispose();
    late(event(response));
    vi.runAllTimers();
    expect(second.terminate).toHaveBeenCalledTimes(1);
    expect(receive).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates a stalled worker after the total-request watchdog, then permits retry", () => {
    const worker = new WorkerStub(), retry = new WorkerStub();
    const client = new SolverClient(vi.fn().mockReturnValueOnce(worker).mockReturnValue(retry));
    const receive = vi.fn();
    client.start(request, receive);
    const late = worker.onmessage!;
    vi.advanceTimersByTime(SOLVER_WATCHDOG_MS - 1);
    expect(receive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(receive).toHaveBeenCalledExactlyOnceWith({ id: 1, result: { status: "error", reason: "timeout" } });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    late(event(response));
    client.start({ ...request, id: 2 }, receive);
    retry.onmessage!(event({ ...response, id: 2 }));
    expect(receive).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it.each(["construction", "post", "error", "messageerror", "internal"] as const)("recovers from %s failure", (kind) => {
    const worker = new WorkerStub();
    const factory = vi.fn(() => worker);
    if (kind === "construction") factory.mockImplementationOnce(() => { throw new Error("unavailable"); });
    if (kind === "post") worker.postMessage.mockImplementationOnce(() => { throw new Error("clone failure"); });
    const client = new SolverClient(factory);
    const receive = vi.fn();
    client.start(request, receive);
    if (kind === "error") worker.onerror!({ preventDefault() {} } as ErrorEvent);
    if (kind === "messageerror") worker.onmessageerror!({} as MessageEvent);
    if (kind === "internal") worker.onmessage!(event({ id: 1, result: { status: "error", reason: "worker" } }));
    expect(receive).toHaveBeenCalledExactlyOnceWith({ id: 1, result: { status: "error", reason: "worker" } });
    expect(vi.getTimerCount()).toBe(0);
    client.start({ ...request, id: 2 }, receive);
    worker.onmessage!(event({ ...response, id: 2 }));
    expect(receive).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it("discards an idle failed worker without replacing its already-delivered result", () => {
    const worker = new WorkerStub();
    const factory = vi.fn(() => worker);
    const client = new SolverClient(factory), receive = vi.fn();
    client.start(request, receive);
    worker.onmessage!(event(response));
    worker.onerror!({ preventDefault() {} } as ErrorEvent);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    client.start({ ...request, id: 2 }, receive);
    expect(factory).toHaveBeenCalledTimes(2);
    client.dispose();
  });
});
