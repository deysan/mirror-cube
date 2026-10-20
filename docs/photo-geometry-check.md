# Offline geometric feasibility check

## Scope

This is a small, reproducible **development tool**, not application photo recognition or a photo-input UI. The original single-box mode estimates projective geometry, ranks all eight known piece shapes, and probes annotation sensitivity. The subsequent shared-camera mode fits directions across multiple pieces within one image and checks withheld edges; it does not rank pieces. Both consume manual markings and use no AI, image-recognition service, or new dependency. A subsequent [local pixel-refinement check](photo-edge-refinement.md) now reads narrow image regions and compares unreviewed contrast candidates with the original fixed check edges.

The numerical prototypes are in `tools/photo-geometry/geometry.ts` and `tools/photo-geometry/sharedCamera.ts`; the Node runner is `tools/photo-geometry/check.mjs`. The runner imports the existing exact piece dimensions from `src/puzzle/model.ts`. Nothing in the application imports these tools. Solver state, history, playback, and the production bundles are unchanged.

## Single-box observation contract

The input JSON has a `views` array. Each observation has:

- `id`: a unique descriptive label, **not a guessed piece identity**;
- `width`, `height`: positive integer dimensions of the oriented image in pixels;
- optional `image`: a local JPEG/PNG path, absolute or relative to the input JSON, used only for diagnostic overlays;
- optional `note`: annotation provenance and limitations;
- `edges`: the nine named segments below, each `[[x1, y1], [x2, y2]]` in image coordinates, origin at top left.

Choose the common visible corner `o` of three faces. Label its three adjacent corners `a`, `b`, and `c`. The other visible corners are `ab`, `ac`, and `bc`; the hidden eighth corner is `abc`. These are observation coordinates, **not** U/F/R or piece-local physical axes.

| Direction | Required straight edge segments |
| --- | --- |
| a | `oa`, `bab`, `cac` |
| b | `ob`, `aab`, `cbc` |
| c | `oc`, `aac`, `bbc` |

Mark interior portions of straight **body** edges, avoiding rounded endpoints and inset sticker borders. Do not substitute an invisible edge or a neighboring piece's boundary without flagging that the observation is unsupported. The pilot requires all nine segments; it does not yet model partially missing edges. The image dimensions/orientation and markings must be checked visually in the overlay; the runner does not independently decode or verify image dimensions.

The current physical annotations are rough, assistant-made annotations for a feasibility probe, not automatic detections or independently verified ground truth. Images, annotations, and generated overlays remain outside the repository. No physical piece ID or cross-view match is supplied to the calculation.

## Calculation and assumptions

1. Normalize pixel coordinates by image size. Fit each virtual sharp corner to its incident straight lines by least squares. This extrapolates beyond rounded portions; it does not assert that a rounded physical corner exists at that pixel.
2. Fit a projective `3 × 4` camera from the seven inferred corners of a unit cuboid. Its first three columns incorporate the unknown physical edge lengths. The origin depth is normalized to one.
3. Recover camera intrinsics using orthogonality of the three edge directions. Assume **square pixels, zero skew, a pinhole camera, and no lens distortion**. Focal length and principal point are fitted; the principal point is not silently set to the image center. Independent calibration is not available for these photographs.
4. Undo the intrinsics and compare column norms to recover the three edge-length ratios, normalized by their largest value. These are **not millimeters**; absolute scale is not identifiable this way.
5. Compare all eight exact dimension triples under all six axis permutations and an independent common scale. For each permutation, choose least-squares scale `s = sum(d[i] * l[i]) / sum(d[i]^2)`, then score `max(abs(s*d[i] - l[i]) / l[i])`. Retain each shape's lowest score and return the entire ranking. This is a defined discrepancy score, not a probability or an acceptance threshold. Axis permutations are not full corner-pose estimates.
6. Repeat with deterministic independent endpoint jitter of 0, 2, 5, and 10 pixels in each coordinate, 256 trials per radius, LCG seed 42. Report rejected samples, ranges, and how often each shape ranks nearest. These are sensitivity diagnostics, **not confidence intervals, exhaustive uncertainty bounds, or frequencies of correct recognition**. Even a consistently nearest shape can be a poor fit.

Single-box linear fits use Householder QR instead of normal equations. Degenerate edges/projections, unidentifiable camera metrics, nonpositive squared focal lengths, and vertices crossing the camera plane are rejected rather than repaired with an orthographic fallback. A finite estimate is not a validated camera: the square-pixel/distortion assumptions, annotations, and inferred intrinsics may still be wrong. A cropped photograph can in principle have a principal point outside the image; this is reported, not silently clamped.

## Running locally

Use the project's supported Node version (Node 24 recommended; native TypeScript stripping is used by the runner):

```sh
node tools/photo-geometry/check.mjs /path/to/private-observations.json /tmp/mirror-cube-geometry-report
```

The output directory must be new, its parent must exist, and it must be outside this repository. Existing output is never overwritten. The tool reads only local files and creates:

- `report.json`: assumptions, exact shape definitions, observations, nominal estimates, complete rankings, and sensitivity results;
- `overlays.html`: private JPEG/PNG images with marked segments and extrapolated corners. It has no scripts or external resources and can be opened directly in a browser.

**The HTML embeds the original image bytes and may retain their metadata. Treat both outputs as private; do not publish or commit them without permission.** Input coordinates alone can be used without an image, including for synthetic checks. Every output explicitly says `inconclusive-no-identity-assigned`; there is no automatic path into `PuzzleState` or the solver.

The reviewed local artifacts are under `/tmp/mirror-cube-photo-geometry/`: `annotations.json`, `run-2/report.json`, and `run-2/overlays.html`. Temporary artifacts are not durable repository fixtures. The input stores the private image paths, so it is not copied into this guide.

## Results of the first physical probe

All six source photographs were visually reviewed. Numerical fitting was attempted on **three near-box patches**, in views 1, 4, and 5 of the [sample review](photo-sample-review.md), selected for comparatively visible edges. This is not a reconstruction of all eight pieces, and the three patches are not assumed to be the same piece across views.

| Patch | Nominal corner reprojection RMS | Nearest shape's relative discrepancy | Rejected trials at ±5 px | Distinct nearest IDs among finite ±5 px estimates |
| --- | ---: | ---: | ---: | ---: |
| View 1, near box | 9.95 px | 163.5% | 117 / 256 | 7 |
| View 4, near box | 4.88 px | 17.3% | 59 / 256 | 3 |
| View 5, near box | 18.36 px | 164.8% | 142 / 256 | 7 |

All three nominal principal-point estimates lie outside the image, with a particularly large displacement for view 5. The nominal rankings are poor shape fits; the nearest ID must not be interpreted as an identification. No shape is accepted. Some perturbations have no positive-focal camera under the assumptions; others change the nearest shape substantially. Zero-radius repetition is merely the same calculation repeated, not independent evidence of reliability.

The browser overlays were inspected. Rounded edges, body/sticker border choice, and partially obscured far boundaries make these preliminary annotations uncertain; a ±5 px independent jitter model does not cover all systematic marking errors. The discrepancy cannot be attributed solely to the photographs, the known dimensions, or the camera. It can also come from inaccurate or inconsistent edge annotations and the ideal-box approximation.

**Conclusion:** self-calibration from one roughly annotated small piece is not reliable enough here to assign identities. This is a result about this limited method and these annotations, not proof that non-AI reconstruction is impossible or that six photos are inherently insufficient. No exact state, cross-view correspondence, or physical solution has been established.

## Shared per-image camera check

The owner approved continuing with photographs, without video or a new library. This second check uses more spatially distributed edges to estimate one camera **within each photograph**, independently of the other photographs. It does not assume matching piece identities, a known global pose, or identical camera intrinsics across images.

### Input and method

Set top-level `"mode": "shared-camera"` in the same input JSON and keep the `views` array. The default mode remains the single-box check. Each shared-camera view keeps `id`, `width`, `height`, optional `image` and `note`, but replaces `edges` with three direction groups:

```ts
type Mark = {
  id: string;                       // unique physical-edge label within the image, not a piece ID
  role: "fit" | "check";            // fixed before fitting
  segment: [[number, number], [number, number]];
};
// groups: { a: Mark[], b: Mark[], c: Mark[] }
```

Each group needs at least three fit edges and one held-out check edge. Use distinct physical edges, not several portions of one ridge treated as independent evidence. The direction labels are local to an image. In the physical probe there are four fit and two check edges per group: **12 fit and 6 held-out edges per photograph**.

The estimator:

1. Normalizes image coordinates and forms homogeneous lines from fit segments only. Unnormalized endpoint cross products give longer segments more weight.
2. Fits a homogeneous vanishing direction per group by the smallest eigenvector of its symmetric `3 × 3` scatter matrix, using Jacobi rotations. This is an algebraic fit, not a statistically optimal pixel-error fit. It supports directions at infinity and reports an eigenvalue separation diagnostic; that diagnostic is not a confidence score.
3. Estimates focal length and principal point from mutual orthogonality, with the same square-pixel, zero-skew, distortion-free pinhole assumptions as before. Degenerate direction sets or unidentifiable/nonpositive camera metrics are reported, not repaired with a fixed principal point or orthographic fallback.
4. Reports **every** marked edge's discrepancy, separately for fit and check roles. For a given edge, construct the predicted line through its marked midpoint and the fitted vanishing point. Report RMS endpoint displacement in pixels and the acute angle difference. This checks direction consistency, not the edge's physical position, a corner correspondence, millimeters, or complete 3D geometry. These residuals are not comparable to the single-box corner reprojection RMS above.
5. Repeats independent endpoint jitter at 0, 2, 5, and 10 source-image pixels, 256 samples per radius, seed 42. Reports rejected samples and observed ranges of camera parameters and axis-balanced held-out RMS. The latter averages the three per-axis mean squared check errors equally. Check endpoints are also perturbed, but never determine fitted directions or calibration.

No fit edges are silently removed as outliers. Check edges never enter the numerical fit. However, the manual annotations were inspected alongside diagnostics and are **not blinded reference measurements**. Both finite calibration and small held-out direction error can coexist with incorrect annotations or assumptions. No acceptance threshold, physical camera validation, piece assignment, or solver import is implemented in this mode.

### Physical observations and results

Views **4 and 1** were annotated independently. Browser overlays and full-resolution crops were inspected. The first view-4 overlay exposed a wrongly placed outer vertical fit segment; it was corrected against the visible contour. In view 1, the far top fit segment crossed the inset patch, and a vertical fit segment lay too far inside a dark face; both were corrected against full-resolution crops. Held-out markings and fit/check membership were not changed. Initial artifacts were retained locally, rather than overwriting them or presenting the corrections as automatic recognition.

These remain approximate manual body-contour/ridge markings. Rounded ridge centers and blurred far outlines are uncertain. The fitted nominal focal length for view 4 changed from about 3973 px to 2866 px after its one annotation correction: a direct warning that small jitter around a wrong marking does not model systematic annotation error.

Final diagnostics:

| View | Fit RMS, a / b / c | Held-out RMS, a / b / c | Largest held-out angle discrepancy | Positive-metric estimates at ±5 px | Observed focal range at ±5 px |
| --- | --- | --- | ---: | ---: | ---: |
| 4 | 2.89 / 1.72 / 1.12 px | 3.20 / 2.82 / 4.95 px | 3.35 degrees | 256 / 256 | 1477–3284 px |
| 1 | 4.36 / 1.46 / 0.77 px | 6.08 / 4.43 / 2.49 px | 3.69 degrees | 256 / 256 | 2451–3192 px |

Nominal focal lengths are approximately 2866 px and 2842 px, with principal points near `(1212, 2045)` and `(1114, 1905)` respectively in 2560-pixel-square images. These are fitted numbers, **not independently known camera parameters**. In particular, at ±5 px the observed principal-point Y ranges are approximately 1429–3063 px and 1493–2556 px. Finite positive estimates in all 256 trials do not establish accuracy, confidence, or uniqueness. At ±10 px, view 4 still has 18 rejected trials.

Compared with the earlier single-box probe, algebraic camera failures are less frequent in this bounded perturbation sample. This is not a controlled recognition-accuracy benchmark: the marks, fitting objective, and sample dimensionality differ. Remaining parameter spread and held-out disagreement are too large to treat the camera as verified. Consequently, **no physical dimension ranking was repeated under this uncertain calibration, and no piece or state was accepted**.

### Reproduction and privacy

The same runner handles both modes:

```sh
node tools/photo-geometry/check.mjs /path/to/private-camera-observations.json /tmp/new-camera-report
```

The shared-camera JSON contains all markings, per-edge residuals, direction estimates, camera results, and perturbation ranges. Overlays show solid fit markings, dashed held-out markings, and white predicted check directions through their marked midpoints. In shared-camera mode the ranking arrays are empty, and no shape definitions are needed in the report. All decisions remain `inconclusive-no-identity-assigned`.

Reviewed private inputs and outputs are `/tmp/mirror-cube-photo-geometry/camera-two-views-v2.json` and `/tmp/mirror-cube-photo-geometry/camera-final/{report.json,overlays.html}`. Earlier `camera-run-*` and `camera-two-views` artifacts preserve the initial markings. Images and annotation files remain outside the repository; these temporary files are not durable public fixtures. The same output-directory and embedded-image privacy restrictions apply.

## Verification and next boundary

Synthetic tests project each of the eight actual dimension triples with known perspective cameras, then reconstruct without providing the identity or calibration to the estimator. They cover axis permutations, off-center principal points, strong perspective, cropping/resizing, scale ambiguity, close-but-distinct dimensions, degenerate views, impossible metrics, deterministic perturbations, and input nonmutation. CLI tests cover malformed input, reproducible diagnostics, local-only escaped overlays, and refusal to overwrite output or write private reports inside the repository.

Run `npm test`, `npm run typecheck`, and `npm run build`. These validate implementation contracts and synthetic recovery, **not physical recognition accuracy**. The existing graphics-bundle warning remains; this offline tool is not included in the application bundle.

Shared-camera tests additionally cover recovery of known intrinsics from independently projected parallel edge families, held-out exclusion, endpoint/order/axis-label invariance, cropping/resizing, affine directions at infinity, nonphysical metrics, degeneracy, malformed input, deterministic sensitivity, and visible misgrouped-edge residuals. CLI tests cover both modes and escaped edge labels. Type checking includes the offline TypeScript; `allowImportingTsExtensions` permits explicit relative imports for Node's native type stripping without adding a runtime loader. Full verification after the shared-camera stage: 634 tests in 23 files, typecheck, and production build passed. The private overlays were inspected in local Chrome; no new application UI or application browser workflow was introduced.

The owner subsequently approved **pixel-based refinement of manually selected straight-edge regions**. Its [implementation and findings](photo-edge-refinement.md) show that local contrast candidates can be repeatable without representing the intended body ridge. The mixed camera comparison improves one image's fixed-check residual and worsens the other's; no physical state is accepted. Explicit boundary type and intended use are now enforced by the completed [offline boundary-review module](photo-boundary-review.md), without selecting a library or inferring a physical state. Extra photographs remain possible but are not requested without a specific demonstrated missing constraint. Cross-photo association and exact candidate assignment should wait for sufficiently reliable constraints. No commits are authorized by permission to continue working.
