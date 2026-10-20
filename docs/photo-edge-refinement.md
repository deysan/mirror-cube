# Local pixel-based edge refinement

## Scope and result

This owner-approved step extends the [offline geometry check](photo-geometry-check.md). It reads real image pixels in narrow regions around existing manual segments, finds local contrast transitions, tests their straightness and sensitivity, and compares camera fits without changing held-out annotations.

It is **not full-image edge recognition, a body/sticker classifier, calibrated metrology, or a photo-input UI**. No puzzle state or solution is produced. There are no new npm dependencies, AI models, recognition services, or application imports. The existing application and its production bundles are unchanged.

Final numerical results on the 36 previously marked regions in views 4 and 1:

- **12 contrast-boundary candidates** pass the local numerical and initial-region checks: 4 fit + 2 check marks in view 4, and 6 fit marks in view 1.
- **24 regions are rejected**: 9 search-window boundary cases, 7 insufficient-support cases, 6 competing-boundary cases, and 2 polarity-change cases.
- A numerically repeatable contrast boundary may be a sticker border instead of the intended body ridge. No candidate is automatically accepted as a physical edge.
- The mixed camera comparison improves agreement with fixed original checks in view 4, but worsens it in view 1. This is not verified calibration or physical recognition accuracy.

## Files and separation

- `tools/photo-geometry/refineEdge.ts`: pure grayscale-raster processing and local selection sensitivity. It has no DOM, file, camera, puzzle-model, or rendering imports (only geometry types).
- `tools/photo-geometry/decodeImage.mjs`: offline Node adapter using an **already installed** local Chrome/Chromium image decoder and Canvas. This is a development-only dependency on an executable, not a new application library.
- `tools/photo-geometry/refine.mjs`: local input validation, private diagnostics/overlays, and the explicit mixed-camera comparison.
- `tools/photo-geometry/refineEdge.test.ts` and `refine.test.mjs`: synthetic pixel tests, fit/check isolation, provenance, privacy/output guards, and decoder failure checks.

The camera estimator and solver are not modified by this stage. Pixel refinement receives neither a camera estimate nor a piece template. A better camera score is never used to choose a contrast peak, tune the settings, or remove an inconvenient edge.

## Image decoding and coordinates

The runner accepts the same `mode: "shared-camera"` observation JSON as the earlier check, with a required local JPEG/PNG path per view. It decodes the source image without resizing. The browser-decoded dimensions/orientation must match the annotated image dimensions; a mismatch fails rather than stretching the image. Transparent pixels are rejected rather than silently assigning a background.

Coordinates have their origin at the image's **upper-left boundary**; decoded pixel centers are at `(column + 0.5, row + 0.5)`. Bilinear sampling accounts for that half-pixel offset. An interim report used integer-index pixel centers; this was corrected before the final run. Its earlier count of 10 stable candidates is superseded by the final 12. This implementation correction does not establish physical correctness or justify accepting the additional candidates.

Grayscale is rounded `0.2126 R + 0.7152 G + 0.0722 B` on the browser-decoded 8-bit RGB values. It is a luma approximation, not radiometrically linear intensity. Browser color management and decoding can affect exact results. Reports record the browser product/version and SHA-256 hashes of input JSON, source bytes, grayscale raster, and implementation files.

The local browser uses an owned temporary profile and a debugging **pipe**, not a listening port. Images are passed as data URLs; the decoder document has restrictive CSP and network/file URL blocking. No HTTP server or external image service is involved. The browser and its profile are cleaned up on normal completion and handled errors. The decoder limits declared images to 25 million pixels and input files to 30 MB; this trusted local development tool is not a hardened public upload service.

## Fixed processing procedure

Settings are explicit in the frozen `EDGE_SETTINGS` constant. They were established with synthetic checks before the physical run, not optimized against the photographs or their camera residuals. They are heuristics, not probabilities or uncertainty guarantees.

1. Require a segment of at least 32 pixels. Form a strip extending **16 pixels on each normal side**. The entire sampling/smoothing support must lie in the image; otherwise reject it. Never clamp missing pixels or silently widen the strip.
2. Sample **64 equally spaced stations** along the segment. At each normal offset, average three tangential bilinear samples at offsets −2, 0, +2 px. Smooth the normal profile with `[1,4,6,4,1]/16`, then take a central difference.
3. Find local absolute-gradient peaks of at least **6 luma units per pixel**. A second peak at least 4 px away and at least 60% as strong makes that station ambiguous. Peaks within one sample of the search border are marked as clipped. Use bounded quadratic interpolation around an otherwise eligible peak for its subpixel offset.
4. Reject the region if more than 10% of stations are ambiguous or clipped, fewer than 80% have usable peaks, or usable peaks change polarity along the segment.
5. Fit normal offset versus along-segment distance by ordinary least squares to **all usable peaks**. There is no RANSAC or residual trimming. Require perpendicular RMS at most 1 px, maximum residual at most 3 px, orientation change at most 5 degrees, and fitted endpoints at least 2 px inside the normal search limits.
6. Return a **candidate**, not a recognized edge. Keep per-station diagnostics, support, residuals, displacement, and angle change.
7. Repeat refinement after moving the initial segment normally by −2 and +2 px and rotating it around its midpoint by −0.5 and +0.5 degrees. All four variants must also produce candidates, within 1.5 px of the nominal fitted line and within 0.5 degrees of its direction. Report failures; do not reinterpret these few probes as confidence intervals or exhaustive bounds.

A separate synthetic test deliberately contains a weak intended transition and a stronger nearby inset-like transition. The stronger transition passes all numerical checks. This documents an important limitation: **repeatability alone cannot distinguish a body edge from an inset border, reflection, shadow, or background feature**.

## Camera comparison and physical findings

Each image retains its original 12 fit and 6 check markings and their direction labels. Every region is processed independently, regardless of role.

For the comparison only:

- replace a fit segment if it passes both the numerical and region-perturbation checks, labelling it `unreviewed-pixel-candidate`;
- retain every rejected or unstable fit segment explicitly as `retained-manual-fit`;
- leave **all six original check segments unchanged**, even if their own pixel refinement produces a candidate, and label them `fixed-original-check`.

Thus view 4 replaces 4 fit segments and retains 8 manual fit segments; view 1 replaces 6 and retains 6. There are not enough eligible pixel-only observations in all three directions to run a fully refined-camera check with the required coverage. The mixed result must not be presented as fully automatic calibration. All rows, including rejected regions, remain in the report.

| View | Original held-out RMS, a / b / c | Mixed-fit held-out RMS, a / b / c | Axis-balanced held-out RMS, before → after |
| --- | --- | --- | --- |
| 4 | 3.20 / 2.82 / 4.95 px | 3.20 / 2.09 / 4.29 px | 3.77 → 3.32 px |
| 1 | 6.08 / 4.43 / 2.49 px | 6.21 / 6.29 / 3.00 px | 4.58 → 5.39 px |

These are direction-consistency errors relative to **unverified manual checks**, not physical dimensions or ground-truth accuracy. The observed focal-length ranges under ±5 px independent endpoint jitter remain broad: approximately 1684–3166 px for the mixed view-4 fit and 2477–3061 px for view 1. That camera probe perturbs resulting segments; it does **not** rerun pixel detection or estimate end-to-end uncertainty.

Private browser overlays were inspected. Some candidates follow visible outer silhouettes; others follow the metallic patch/plastic boundary rather than the original black body-ridge marking. For example, view 1's `front-right-top` fit candidate follows the lower high-contrast border beside the black bevel, not the intended ideal top ridge. Regions with multiple strong borders or a transition at the strip edge are explicitly rejected. These semantic observations are human/assistant inspection, not an implemented classifier or independently verified labels.

The result is therefore mixed, not a successful physical reconstruction. The implementation now performs real pixel-based processing, but semantic boundary choice, calibration accuracy, piece correspondence, and exact state remain unresolved.

## Running and privacy

Use the supported Node version and an installed Chrome/Chromium. On macOS the default is the standard Google Chrome application path; elsewhere the fallback command is `google-chrome`. Set `CHROME_PATH` to select a different local executable. No browser is downloaded or installed by the tool.

```sh
node tools/photo-geometry/refine.mjs /path/to/private-observations.json /tmp/new-edge-report
```

The output directory must be new, its parent must exist, and it must be outside the repository. Existing output is rejected before decoding. Input/source files are not modified. Output contains:

- `report.json`: processing settings, provenance hashes, complete per-region results and perturbation variants, baseline and mixed camera estimates, fixed check observations, and endpoint sensitivity;
- `overlays.html`: per-region crops with original marks, strip borders, and numerical candidates. It has no scripts or external resources. Green means only that numerical checks passed; it does not mean the intended body edge was recognized.

**The HTML embeds original image bytes and may contain metadata. Both outputs are private development artifacts, not public fixtures.** All report decisions remain `inconclusive-requires-boundary-review-no-state-assigned`.

The reviewed input is `/tmp/mirror-cube-photo-geometry/camera-two-views-v2.json`; final output is `/tmp/mirror-cube-photo-geometry/pixel-reviewed/`. Earlier `pixel-run-1` and `pixel-final` directories are retained for provenance; `pixel-reviewed` includes the final implementation hashes. Temporary local artifacts are not a durable public dataset.

## Verification and next boundary

Synthetic tests cover rotated/blurred transitions, contrast and endpoint reversal, small orientation correction, weak or missing support, multiple borders, clipping, curvature, excessive rotation, polarity changes, deterministic noise, initial-region sensitivity, immutable inputs, and the semantic counterexample above. Report tests keep fit/check roles isolated, retain manual fallbacks explicitly, check reproducibility and HTML escaping, refuse unsafe/overwriting output, and validate missing-browser cleanup. The automated report tests inject a synthetic raster decoder and do not claim real browser decoding coverage.

Separate local Chrome checks decoded both actual JPEGs and a generated color PNG; verified luma values; rejected mismatched dimensions, transparency, and a corrupt JPEG; and checked temporary-profile cleanup. Real private overlays were rendered and inspected. No new application browser workflow was introduced.

After this stage, `npm test` passes **656 tests in 25 files**; typecheck and production build pass. The existing graphics-bundle warning remains, and the production asset names/sizes are unchanged.

The owner then requested continuing through the module. The subsequent [boundary-review workflow](photo-boundary-review.md) now preserves alternatives, requires explicit boundary type and use, and exports validated observations or missing-evidence diagnostics. Inset and bevel borders cannot become body-position observations. This completes the offline observation-level workflow, not physical state reconstruction or the application's photo input. Further progress requires reviewed evidence and a checkable calibration reference, rather than arbitrary additional viewpoints. No commits or pushes were authorized or performed.
