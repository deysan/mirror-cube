// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { lazy, StrictMode, useEffect, type ComponentProps, type ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { LazyCubeScene } from "./components/LazyCubeScene";
import { messages } from "./i18n/messages";

// Real React.lazy/Suspense semantics with a controllable network/module promise.
// Ordinary App suites mock the scene boundary synchronously; browser checks use real imports/WebGL.
vi.mock("./components/LazyCubeScene", () => ({ LazyCubeScene: vi.fn() }));
type Props = ComponentProps<typeof LazyCubeScene>;
function deferredScene() {
  let resolve!: (value: { default: ComponentType<Props> }) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<{ default: ComponentType<Props> }>((yes, no) => { resolve = yes; reject = no; });
  const load = vi.fn(() => promise);
  const Scene = lazy(load);
  vi.mocked(LazyCubeScene).mockImplementation(props => <Scene {...props} />);
  return { resolve, reject, load };
}
const readyScene = vi.fn(({ onReady }: Props) => {
  useEffect(onReady, [onReady]);
  return <canvas data-testid="loaded-scene" />;
});
const disabled = (name: string) => screen.getByRole("button", { name }).matches(":disabled");
const workerFactory = vi.fn();
beforeEach(() => { workerFactory.mockClear(); readyScene.mockClear(); vi.stubGlobal("Worker", workerFactory); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("asynchronous graphics loading", () => {
  it("keeps the shell/language usable and puzzle controls locked until the scene is ready", async () => {
    const pending = deferredScene();
    render(<StrictMode><App /></StrictMode>);
    expect(screen.getByRole("status").textContent).toBe(messages.en.sceneLoading);
    expect(screen.getByText("50 mm")).toBeDefined();
    expect(document.querySelector("canvas")).toBeNull();
    for (const name of ["R Right", messages.en.findSolution, messages.en.editor.open, messages.en.resetCube]) {
      expect(disabled(name)).toBe(true); fireEvent.click(screen.getByRole("button", { name }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByRole("status").textContent).toBe(messages.uk.sceneLoading);
    expect(document.documentElement.lang).toBe("uk");
    expect(workerFactory).not.toHaveBeenCalled(); expect(pending.load).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ default: readyScene }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(disabled("R Права")).toBe(false);
    expect(readyScene.mock.calls.at(-1)![0].activeTurn).toBeNull();
    expect(screen.getByText(messages.uk.historyEmpty)).toBeDefined();
    const canvas = screen.getByTestId("loaded-scene"), props = readyScene.mock.calls.at(-1)![0];
    expect(props.cube.splits).toEqual({ x: 22, y: 20, z: 33 });
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("loaded-scene")).toBe(canvas);
    expect(readyScene.mock.calls.at(-1)![0].cube).toBe(props.cube);
    expect(readyScene.mock.calls.at(-1)![0].state).toBe(props.state);
    expect(pending.load).toHaveBeenCalledTimes(1); expect(workerFactory).not.toHaveBeenCalled();
  });

  it("does not confuse a downloaded module with WebGL readiness", async () => {
    const pending = deferredScene();
    const Scene = vi.fn((_props: Props) => <canvas />);
    render(<App />);
    await act(async () => pending.resolve({ default: Scene }));
    expect(document.querySelector("canvas")).not.toBeNull();
    expect(disabled("R Right")).toBe(true); expect(disabled(messages.en.findSolution)).toBe(true);
    act(() => Scene.mock.calls.at(-1)![0].onReady());
    expect(disabled("R Right")).toBe(false); expect(workerFactory).not.toHaveBeenCalled();
  });

  it("uses the existing localized failure path for a rejected graphics chunk, without false readiness or retry loops", async () => {
    const pending = deferredScene();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await act(async () => pending.reject(new Error("Failed to fetch dynamically imported module")));
    expect(screen.getByRole("status").textContent).toBe(messages.en.sceneUnavailable);
    expect(screen.queryByText(/Failed to fetch dynamically/)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull(); expect(disabled("R Right")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByRole("status").textContent).toBe(messages.uk.sceneUnavailable);
    expect(screen.getByText("50 мм")).toBeDefined(); expect(disabled(messages.uk.editor.open)).toBe(true);
    expect(pending.load).toHaveBeenCalledTimes(1); expect(workerFactory).not.toHaveBeenCalled();
  });

  it("does not mount a late scene or allocate workers after the page unmounts", async () => {
    const pending = deferredScene(), view = render(<StrictMode><App /></StrictMode>);
    view.unmount();
    await act(async () => pending.resolve({ default: readyScene }));
    expect(readyScene).not.toHaveBeenCalled(); expect(workerFactory).not.toHaveBeenCalled();
    expect(document.querySelector("canvas")).toBeNull();
  });
});
