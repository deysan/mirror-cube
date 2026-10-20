import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { EDGES } from "./geometry.ts";

const temporary = [];
function directory() { const path = mkdtempSync(join(tmpdir(), "mirror-photo-cli-")); temporary.push(path); return path; }
function run(...args) { return spawnSync(process.execPath, [resolve("tools/photo-geometry/check.mjs"), ...args], { encoding: "utf8" }); }
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("offline photo geometry CLI", () => {
  it("documents required arguments without changing the application", () => {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });

  it("rejects malformed annotations before creating output", () => {
    const dir = directory(), input = join(dir, "input.json"), output = join(dir, "report");
    writeFileSync(input, JSON.stringify({ views: [{ id: "bad", width: 2560, height: 2560, edges: {} }] }));
    const result = run(input, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid image coordinates");
    expect(existsSync(output)).toBe(false);
  });

  it("writes reproducible inconclusive diagnostics and escaped, local-only overlays; refuses overwrite", () => {
    const dir = directory(), input = join(dir, "input.json"), output = join(dir, "report");
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    writeFileSync(join(dir, "reference.png"), Buffer.from(png, "base64"));
    writeFileSync(input, JSON.stringify({ views: [{ id: "sample</h2><script>bad</script>", image: "reference.png",
      width: 2560, height: 2560, edges: Object.fromEntries(Object.keys(EDGES).map(key => [key, [[100, 100], [200, 100]]])) }] }));
    expect(run(input, output).status).toBe(0);
    const reportText = readFileSync(join(output, "report.json"), "utf8");
    const report = JSON.parse(reportText);
    expect(report.shapes).toHaveLength(8);
    expect(report.reports[0].nominal.status).toBe("rejected");
    expect(report.reports[0].decision).toBe("inconclusive-no-identity-assigned");
    expect(report.reports[0].sensitivity).toHaveLength(4);
    expect(report.reports[0].sensitivity[0].rejected["degenerate-edges"]).toBe(256);
    const html = readFileSync(join(output, "overlays.html"), "utf8");
    expect(html).toContain("data:image/png;base64," + png);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    const output2 = join(dir, "repeat");
    expect(run(input, output2).status).toBe(0);
    expect(readFileSync(join(output2, "report.json"), "utf8")).toBe(reportText);
    expect(run(input, output).status).toBe(1);
    expect(readFileSync(join(output, "report.json"), "utf8")).toBe(reportText);
  });

  it("runs shared-camera diagnostics without ranking identities and escapes edge labels", () => {
    const dir = directory(), input = join(dir, "input.json"), output = join(dir, "report");
    const vanishing = [[-1000, -2000], [4000, -1500], [1200, 5000]];
    const groups = Object.fromEntries(["a", "b", "c"].map((axis, index) => [axis, Array.from({ length: 4 }, (_, i) => {
      const mid = [900 + 150 * i, 1000 + 40 * i], v = vanishing[index];
      const dx = v[0] - mid[0], dy = v[1] - mid[1], s = 100 / Math.hypot(dx, dy);
      return { id: axis + i + "</text><script>bad</script>", role: i === 3 ? "check" : "fit",
        segment: [[mid[0] - dx * s, mid[1] - dy * s], [mid[0] + dx * s, mid[1] + dy * s]] };
    })]));
    writeFileSync(input, JSON.stringify({ mode: "shared-camera", views: [{ id: "camera", width: 2560, height: 2560, groups }] }));
    const result = run(input, output);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(readFileSync(join(output, "report.json"), "utf8"));
    expect(report.mode).toBe("shared-camera");
    expect(report.shapes).toBeUndefined();
    expect(report.reports[0].ranking).toEqual([]);
    expect(report.reports[0].decision).toBe("inconclusive-no-identity-assigned");
    expect(report.reports[0].nominal.calibration.status).toBe("estimated");
    expect(report.reports[0].nominal.directions.a.checkRmsPx).toBeLessThan(1e-7);
    expect(report.reports[0].sensitivity[0].estimated).toBe(256);
    const html = readFileSync(join(output, "overlays.html"), "utf8");
    expect(html).toContain("stroke-dasharray");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("NaN");
  });

  it("rejects unknown modes and missing shared-camera held-out edges without creating output", () => {
    const dir = directory(), input = join(dir, "input.json"), output = join(dir, "report");
    for (const mode of ["unknown", "shared-camera"]) {
      writeFileSync(input, JSON.stringify({ mode, views: [{ id: "bad", width: 2560, height: 2560, groups: { a: [], b: [], c: [] } }] }));
      expect(run(input, output).status).toBe(1);
      expect(existsSync(output)).toBe(false);
    }
  });

  it("refuses output inside the public repository", () => {
    const dir = directory(), input = join(dir, "input.json");
    writeFileSync(input, JSON.stringify({ views: [] }));
    const output = resolve(`photo-geometry-test-${process.pid}`);
    const result = run(input, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("outside the repository");
    expect(existsSync(output)).toBe(false);
  });
});
