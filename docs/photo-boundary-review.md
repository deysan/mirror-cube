# Boundary-analysis module: extraction, review, and export

## Completion boundary

The owner requested continuing through the module rather than stopping after each substep. The **offline boundary-analysis module** now has a complete path:

1. decode local photographs and inspect manually selected regions;
2. preserve alternative straight contrast boundaries;
3. explicitly review the selected line, its semantic type, and its intended use;
4. validate the review against the exact catalog;
5. export reviewed observations or concrete missing-evidence diagnostics.

This completes that observation-level workflow, **not the entire product photo workflow**. Automatic whole-image discovery, reliable camera calibration, cross-view piece correspondence, discrete state reconstruction, in-app confirmation/import, and solving the photographed state remain unfinished. A valid boundary review never returns a `PuzzleState` or implies that the physical cube has been recognized.

No dependencies, external recognition services, AI models, deployment changes, commits, or pushes were added. The main application and its bundles are unchanged. The local review page is a separate development tool, not the application's photo-input screen.

## Candidate extraction

`tools/photo-geometry/refineEdge.ts` now preserves all local gradient peaks in its per-station diagnostics, including competitors and clipped peaks. Its earlier strongest-peak refinement behavior remains available and retains its rejection rules.

`boundaryCandidates.ts` builds deterministic line hypotheses from peaks at eight spread-out anchor stations. It associates only same-polarity peaks within 1.5 pixels of a hypothesis, rejecting ambiguous station associations rather than picking the strongest. Three association/refit passes require at least 80% support. Linearity, angle, and search-border limits remain those of the [pixel-refinement check](photo-edge-refinement.md). This is deterministic consensus fitting; unlike the earlier single-line fit, it can omit unsupported stations. It is not an exhaustive detector or a statistically calibrated uncertainty method.

Near-duplicate hypotheses of the same polarity are consolidated within 2 pixels. Distinct remaining lines are ordered by signed normal offset, not by assumed physical relevance. More than eight alternatives causes an explicit rejection, not a silently truncated list. Each candidate must have a unique geometric match after the same four initial-region perturbations used previously to be marked stable. Stable means only that this numerical test passed.

No camera score, body/sticker label, or piece template enters extraction. Candidate IDs are local to the fingerprinted catalog, not permanent physical identities. Changing an image, annotation, implementation, or candidate set requires a new catalog and review.

## Review contract

`boundaryReview.ts` validates plain-data catalogs and review manifests. Every original region must have exactly one decision. Unknown, duplicate, missing, or stale decisions fail validation; no partial geometry is exported while any decision is pending.

For each region, the reviewer chooses:

- **pending**: not yet reviewed;
- **exclude**: retain an explicit reason, not silently discard the observation;
- **use**: select a stable candidate or explicitly retain the original manual mark, give a reason, and declare its type and purpose.

Boundary types and uses:

| Type | Direction use | Body-position use |
| --- | --- | --- |
| Straight body edge | Allowed as a human-reviewed observation | Allowed as a human-reviewed observation, not a metric dimension |
| Inset/sticker border | Requires an explicit assumption that it is parallel to the body edge | Rejected |
| Bevel boundary | Requires an explicit parallelism assumption | Rejected |
| Unknown | Rejected | Rejected |

Parallelism and boundary type are **reviewer declarations**, not automatically verified facts. The reviewer identifies themselves and declares owner or analyst provenance; this is local attribution, not authentication or proof of physical accuracy. In particular, an analyst review must not be described as owner confirmation of the puzzle state.

The original direction group and fit/check role are immutable. Excluding a fit observation leaves a recorded reason and can make coverage insufficient. All original held-out checks must remain usable, with at least three fit edges and one check per direction, before the reviewed observation can be passed to camera diagnostics. Dropping a troublesome check cannot create an apparently complete dataset. The review page deliberately does not show camera scores while choices are made.

A reviewer may explicitly choose a different candidate for a held-out check. This creates a **new reviewed dataset**, unlike the preceding pixel-refinement comparison that kept the original check coordinates fixed. It does not feed checks into fitting, but its residuals are not a directly comparable accuracy benchmark against the earlier manual checks. No improvement claim is made from changing those references, and manual review is not a blinded physical ground-truth measurement.

There is **no implicit manual fallback**. The reviewer must explicitly choose the original manual mark if a numerical alternative is unsuitable. Unstable candidates cannot be selected through the export boundary. Catalog fingerprints bind choices to their source data, not to whichever candidate happens to have the same display number in a later run. The fingerprint is an integrity/reproducibility check, not a cryptographic trust signature against a person who rewrites both files.

## Local bilingual reviewer

`reviewUi.js` is embedded in a standalone `review.html` by the runner. It provides English and Ukrainian controls, candidate overlays, semantic choices, notes, reviewer attribution, explicit draft/completed JSON downloads, and re-opening a matching saved review. Language changes preserve decisions and text. Nothing is selected automatically, even when there is only one numerical candidate. A completed download requires all regions to be accounted for; draft files can retain incomplete edits for later resumption.

The page uses no network services, scripts from third parties, or automatic persistence. Source JPEG/PNG bytes are embedded once per image. The page has a restrictive CSP with an exact hash for the embedded UI script; input labels and JSON are escaped. Review JSON import is limited to 32 MB. The Node review command remains authoritative: editing a downloaded JSON file does not bypass its semantic or stale-data checks.

**The HTML contains private photographs and may retain their metadata; the review JSON contains annotations and reviewer attribution. Do not publish or commit either without permission.**

## Commands and outputs

Use the supported Node version and installed local Chrome/Chromium as described in the [pixel-refinement guide](photo-edge-refinement.md). No browser or library is downloaded.

```sh
node tools/photo-geometry/boundaries.mjs prepare private-observations.json /tmp/new-boundary-review
```

The input is the existing `shared-camera` JSON with image paths and grouped manual regions. Output:

- `catalog.json`: exact source/grayscale/implementation hashes, region definitions, immutable fit/check roles, and candidate alternatives;
- `review-template.json`: a fully pending manifest;
- `review.html`: the self-contained bilingual reviewer.

Open `review.html`, make the decisions, and explicitly download the review JSON. Then run:

```sh
node tools/photo-geometry/boundaries.mjs review \
  /tmp/new-boundary-review/catalog.json \
  /path/to/mirror-cube-boundary-review.json \
  /tmp/new-reviewed-observations
```

The `observations.json` output distinguishes:

- `needs-review`: some regions are still pending; no partial observations or camera diagnostics are emitted;
- `needs-observations`: the review is complete but selected evidence lacks required per-axis fit/check coverage; exact deficits and exclusion reasons are listed;
- `reviewed-observations`: coverage is sufficient to compute diagnostic directions/camera estimates and sensitivity, **not** to accept physical calibration or infer identities.

Every result has `readyForPuzzleState: false`. Camera diagnostics explicitly remain `calibrationStatus: "unverified"`. Body-position observations are separated from direction-only borders; they do not become millimeters, piece identities, or poses.

All output directories must be new, with existing parents, outside the public repository. Existing output is never overwritten. Catalog modification or an old manifest produces an error instead of silently reusing choices.

## Physical run and current blocker

The unchanged selected regions in views 4 and 1 produced **18 numerical alternatives across 17 of 36 regions**: 9 candidates in each image. View 1's `right-right-bottom` check has two retained alternatives; neither is automatically chosen. Nineteen regions have no eligible straight candidate under the current strip and support limits. The earlier 12-candidate result used a different strongest-peak policy and should not be interpreted as a directly comparable recognition score.

Even if every numerical candidate were subsequently reviewed as a valid direction, candidate-backed fit/check region counts would be **2/0, 2/1, 2/2** for directions a/b/c in view 4, and **2/0, 3/1, 2/0** in view 1. Two alternatives in one region count as one observation, not two independent checks. Neither image has sufficient fully pixel-backed coverage across all directions. Explicitly retaining the old manual marks is possible, but it does not by itself remove their previously measured calibration sensitivity.

The owner-facing artifact is `/tmp/mirror-cube-photo-geometry/boundary-review-final/review.html`, with its adjacent catalog and pending template. No real decisions are pre-filled or attributed to the owner. Testing import/export with synthetic exclusion decisions did not constitute a physical review; those artifacts are separately named and not used for camera acceptance.

The module correctly reports missing review/evidence rather than producing a guessed state. Completing the **whole photo-to-solution workflow** still needs reliably typed geometry and an independently checkable camera/measurement reference. The six photographs have not been proved insufficient in principle; the current method has not established adequate accuracy from them.

A concrete next evidence request, if capture is easier than inspecting all uncertain boundaries, is one unchanged-state oblique photograph of the puzzle **alongside a matte rectangular box with measured width, height, and depth**, showing three faces of each without mutual occlusion. The box must have straight, approximately right-angle edges, and all three dimensions must be supplied. This would provide a known 3D calibration reference in the same frame; a ruler or one flat rectangle alone would not supply the same constraints. It is a targeted calibration probe, not a promise that one additional photo resolves every piece. Do not reuse its camera intrinsics for the older photos without evidence that lens, crop, focus, and scaling match. No new photograph is fabricated or calibration assumed to proceed.

## Verification

Synthetic candidate tests preserve two competing borders, retain weaker lines without semantic selection, reject weak/curved/clipped/incomplete evidence, and check determinism, perturbation sensitivity, polarity, and endpoint conventions. Contract tests cover pending/no-partial output, independent copies, semantic restrictions, explicit manual retention, unavailable/unstable candidates, exclusions, all original held-out checks, role preservation, malformed and stale manifests, and reordered decisions. A positive-camera synthetic regression changes check selections and verifies that fitted vanishing directions, fit residuals, and calibration remain identical while check residuals change.

Runner tests exercise prepare → pending review → completed synthetic review, including a positive-metric synthetic camera, fingerprint integrity, safe output paths, overwrite refusal, HTML/JSON escaping, and script hash consistency. Real Chrome checks verify default pending state, keyboard focus, selection restrictions, language preservation, draft download, stale-file rejection, import and completed export, and 1280/320 px layout. The downloaded **synthetic** browser review is checked by the real Node command and correctly reports missing observations after excluding everything. Re-running the earlier single-boundary tool on the same real inputs reproduced its numerical selections, perturbation results, coverage, provenance, and camera comparisons exactly; only the newly retained peak arrays and implementation hashes differ. These checks do not demonstrate physical recognition accuracy.

Final repository verification: **674 tests in 28 files**, type checking, and production build pass. The pre-existing large-client-chunk warning remains; application asset hashes are unchanged.

The main application's existing tests remain part of `npm test`. Browser checks here concern the local review tool, not a new in-app photo workflow or a committed cross-browser E2E suite.
