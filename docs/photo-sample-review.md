# Initial physical-photo sample review

## Scope and evidence

Six owner-supplied JPEG photographs were opened for qualitative inspection. Each is 2560 × 2560 pixels. Views 1–4 refer to `photo_1` through `photo_4` of the first batch, not their order in the message. Views 5–6 refer to `photo_1` and `photo_2` of the second batch, showing the inverted puzzle. Source images remain outside the repository; no image copies or embedded EXIF data are included here.

This document records the initial qualitative coverage review, not a reconstructed puzzle state. Subsequent [offline geometric checks](photo-geometry-check.md) fitted three manually annotated near-box patches, then shared cameras on views 1 and 4 using separate fit/check edges. The single-piece estimates are unstable; the shared estimates reduce algebraic failures in tested perturbations but remain physically unverified. A later [pixel-refinement probe](photo-edge-refinement.md) also processed the selected regions, without establishing reliable body-edge semantics. No full-image automatic detector, complete piece correspondence, or validated candidate state is available. Physical recognition accuracy remains unproven.

## Visible observations

| View | Useful observations | Remaining limitations |
| --- | --- | --- |
| 1 | Oblique view with several upward-facing patches and side surfaces; many straight boundary segments are visually distinguishable. | Protruding pieces hide parts of lower/rear surfaces; sticker and body boundaries are different. |
| 2 | More front-biased view showing substantial vertical patches as well as upward-facing patches. | Depth and far boundaries are less clearly observable; dark surfaces and reflections affect apparent contrast. |
| 3 | A different side-biased view with several distinguishable face outlines. | Cross-view piece identities and whole-cube rotation are not established by inspection alone. |
| 4 | Another oblique view with broad face patches and visible black borders. | Exact cross-view correspondence still requires geometric verification, despite the owner's confirmation of unchanged layers. |
| 5 | Inverted oblique view: four formerly downward-facing metallic patches are exposed, with several side boundaries and large dark exposed plastic surfaces. | Some side faces remain occluded or foreshortened; exact body edges must be distinguished from rounded sticker outlines. |
| 6 | Another inverted view with clear near side patches and complementary boundary segments. | The relative camera pose is not calibrated; this does not by itself establish all three physical dimensions of every piece. |

Across the set:

- The puzzle is fully framed without fingers covering it, and many near boundaries appear clear enough to attempt manual geometric annotation.
- Black borders contrast with the metallic patches. This provides useful candidate boundaries, but does not yet demonstrate successful automatic detection.
- The metallic patches are inset and rounded. Their measured outlines must not be equated directly with the model's full piece dimensions. Straight-segment extrapolation and a consistent body-versus-sticker convention will need testing.
- Brushed surface texture and wood grain introduce additional lines; reflections change brightness across a single face. Simple brightness thresholds or edge detection alone cannot be assumed to identify piece boundaries correctly.
- Sharpness varies with depth. A large image does not guarantee sufficient precision to distinguish nearby physical dimensions.
- The inverted views expose broad dark plastic planes around the metallic patches. Dark pixels cannot all be classified as gaps or background; brightness alone also cannot reliably separate dark reflections from plastic.

## Confirmed capture history and remaining uncertainty

The owner confirmed that no layers were turned between photographs. In the first batch the puzzle was rotated while keeping the same side down. It was then inverted as a whole for the second batch, again without changing the internal state. This resolves the initial capture-history questions and supplies observations of the previously hidden downward-facing side.

This confirmation does not provide calibrated camera poses, the exact axis/angle of inversion, or a full mapping of pieces between views. Do not infer those numerically from the requested capture instructions. Do not infer a generating scramble sequence.

At this initial coverage-review point, no further photographs were requested. The next step was to use the six views for a first geometric annotation/fitting check, retaining uncertainty rather than guessing piece identities. Request a targeted supplementary view or measurement only if that check identifies a specific missing constraint. A matte background would help future automatic boundary detection, but the existing set need not be discarded.

## Geometric-check scope and outcome

The owner approved the following bounded geometric check, before a full photo interface or recognition dependency:

1. Explicitly annotate visible straight body-edge segments and their associations across views, distinguishing them from sticker borders. Store image coordinates and uncertain observations, not guessed piece IDs.
2. Test perspective/camera and known-piece geometric constraints against those observations. Four arbitrary image corners alone do not establish a rectangle's physical aspect ratio; calibration assumptions and sensitivity must be explicit.
3. Report compatible piece/pose alternatives and measurement uncertainty. Verify consistency across additional views rather than choosing the visually closest template without evidence.

The implemented probe and [results](photo-geometry-check.md) show that the current single-box self-calibration is too sensitive to rough annotations to assign identities. Only three near-box patches were fitted; reliable cross-view association and complete candidate elimination were not achieved. All eight shapes remain in the diagnostic rankings; no nearest result becomes a recognized piece. The owner then approved a shared per-image camera check. Views 1 and 4 were fitted independently with 12 fit and 6 held-out edges each; overlays exposed marking errors, which were documented and corrected without changing held-out membership. Fitted parameters still vary substantially, and held-out direction discrepancies remain. No shape ranking or state assignment follows from this uncertain calibration. The owner subsequently approved local pixel refinement. Its numerical contrast candidates do not consistently represent the intended body edges, and the mixed camera comparison does not improve both views. See the [separate report](photo-edge-refinement.md). The owner then requested completing the module. An [offline boundary reviewer](photo-boundary-review.md) now preserves alternatives and validates explicit semantic choices. It is ready for real review, not a verified reconstruction: its real manifest starts pending and no owner choices are invented. No additional library has been selected. A same-frame known-dimension 3D reference is now proposed as a concrete calibration probe; more arbitrary viewing angles are not claimed to fix the uncertainty.

Do not publish a solution or import an exact state from this initial review. Keep the non-AI direction and user-confirmation requirement in the [photo-input plan](photo-input.md); the runtime application is unchanged.
