# Photo input without AI: agreed direction and feasibility check

## Decision and current status

The owner approved a **non-AI, semi-automatic approach**: guided photographs, classical computer vision and geometric constraints, user correction/confirmation, then the existing state-based solver and playback. The application must not depend on neural networks, LLM vision, or external recognition APIs for this workflow.

The processing target is local execution in the browser, without uploading images to a recognition service. This is a design requirement, **not an implemented capability**. No recognition library, camera/upload UI, backend, or image storage has been added. OpenCV.js is only a possible tool to evaluate; no dependency has been selected.

The immediate stage is a feasibility check using the owner's physical Cayro cube and its confirmed geometry: 50 mm edge, with X/Y/Z splits of 22/28, 20/30, and 17/33 mm. Six photographs have been visually reviewed; see the [sample assessment](photo-sample-review.md). The owner confirmed no layer turns: the first four show the upright puzzle, and the additional two show it inverted. Both original upward- and downward-facing sides are now represented, but full piece correspondence and sufficient geometric constraints have not yet been established. An [offline geometric probe](photo-geometry-check.md) has now fitted three manually annotated near-box patches and measured endpoint sensitivity. The single-piece camera estimates are unstable. A subsequent shared-camera check on views 1 and 4 uses 12 fit and 6 held-out edges per image. It reduces algebraic failures in the tested jitter samples, but camera-parameter spread and held-out disagreement still prevent verified calibration. No identity or state is accepted. A subsequent [pixel-based refinement check](photo-edge-refinement.md) processed 36 manually selected regions in the same two images. Twelve contrast candidates pass local numerical checks, but some represent inset borders rather than intended body ridges; mixed camera results are not uniformly better. The [boundary-analysis module](photo-boundary-review.md) now supports explicit candidate selection, semantic type/use restrictions, a bilingual offline reviewer, and validated observation export. All real observations start pending; no owner confirmation is fabricated. This observation-level module is complete, but the full photo-to-state workflow is not. Any further capture must address a specific missing constraint. A known-dimension 3D rectangular reference alongside the cube in one new frame is the proposed targeted calibration probe; it is not assumed to calibrate the older images or guarantee reconstruction. Full-image automatic edge recognition and physical-state reconstruction remain unimplemented. The capture protocol, achievable automation, calibration requirements, and accuracy are not yet established.

## Initial sample request

Start with **four photographs of one unchanged scrambled state**. This is an exploratory sample set, not a claim that four photographs always determine a state or a final capture protocol.

- Use a plain matte background and diffuse lighting. Avoid flash and strong reflections that hide edges.
- Keep the entire puzzle in frame, with its edges sharply focused and reasonably large in the image. Use the normal camera rather than an ultra-wide lens; avoid portrait blur, filters, and screenshots of photographs.
- Take the first image obliquely so that approximately three sides are visible.
- Take the remaining images from other sides, including the initially hidden back and underside. Aim for overlapping visible details between neighboring views so that correspondence can be checked.
- Rotate the puzzle **as a whole**, or move the camera. Do not turn any layer between photographs. Finish all layer turns before capture; a partially turned layer is outside the discrete state model.
- Preserve the capture order, for example with names `view-1` through `view-4`. Whole-cube reorientation between views must be accounted for, not mistaken for a layer move or silently assigned known camera angles.
- If possible, avoid covering piece boundaries with fingers. Keep the physical state unchanged until any requested supplementary views have been captured.

An existing solved-puzzle photograph is useful as an optional reference. The owner does not need to solve an already scrambled cube to provide the first sample set. More views, closer details, measurements, or orientation guidance may be requested after inspecting coverage.

Sample sharing during development is separate from the planned local-only application workflow. Do not commit raw personal photographs or metadata to the public repository, or forward them to services, without explicit permission. Any later public test fixtures require separate review and approval.

## What the feasibility check must establish

1. **Coverage and correspondence:** which pieces and boundaries are observable across views, which are occluded, and whether the relative whole-cube orientations can be established.
2. **Usable geometry:** distinguish actual piece edges, gaps, bevels, and reflections; identify observations a user could reliably mark or correct.
3. **Perspective and calibration:** determine what camera information or geometric fitting is needed. Raw pixel lengths or ratios from arbitrary perspective views must not be treated as exact physical dimensions.
4. **Candidate constraints:** determine which known piece identities and orientations remain compatible with the observations. Near sizes stay distinct; measurement uncertainty belongs to the observations, not to a rounded or merged puzzle model.
5. **Ambiguity handling:** record multiple candidates or insufficient evidence and specify the additional view/annotation needed. A reachable state is not necessarily the photographed state, so validator success is not recognition proof.
6. **Physical verification:** compare a candidate with the actual puzzle across all supplied views and agree how the user holds it to follow world-frame instructions.

Human inspection or a chat assistant's interpretation of images is not evidence that an automatic non-AI recognizer works. Any algorithm claim must be backed by reproducible classical/geometric processing and checked results. Later tests should include physically verified reference states and difficult/ambiguous examples, not only rendered images. Known move sequences may establish test ground truth, but must not be required as recognition or solver input.

The current stage should produce a coverage/ambiguity report and a concrete proposal for the next small implementation step. It may conclude that more observations are required; it must not invent a complete state merely to proceed to solving. Stop for owner review before adding recognition dependencies or building the photo interface.

## Intended implementation after feasibility review

1. Guided capture or image selection with explicit orientation instructions.
2. Classical edge/line/corner detection where reliable, with manual marking/correction where needed.
3. Geometric fitting and candidate piece/pose assignments, retaining uncertainty until resolved.
4. A 3D candidate view with correction and explicit user confirmation.
5. Existing exact state validation, followed by the common worker solver and playback; no move history required.

Recognition stays outside the puzzle rules and solver. Only a confirmed, validated discrete snapshot may replace the current puzzle, with appropriate history/result invalidation and stale-operation safety. The manual-input route remains supported. Both application languages are required when the UI is implemented.

Fully automatic recognition of arbitrary photographs, a fixed sufficient image count, arbitrary Mirror Cube dimensions, and successful reconstruction under all lighting/occlusion conditions are not promised. Deployment remains a separate deferred stage.
