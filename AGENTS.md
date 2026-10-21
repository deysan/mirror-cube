# Coding agent instructions

Read [README.md](README.md), [architecture](docs/architecture.md), and the [roadmap](docs/roadmap.md) before changing the project. Consult the [user guide](docs/usage.md), [solver design](docs/solver.md), and [security notes](docs/security.md) when relevant.

## Collaboration

- Communicate with the owner in Ukrainian; write repository documentation in English.
- Keep application text and instructions bilingual, English/Ukrainian.
- Agree on small stages before implementing them. A roadmap is not authorization.
- Report changes, checks, and limitations after each stage, then stop.
- Every commit, push, deployment, new dependency, or paid service requires explicit permission for that action. Do not treat historical permissions as standing authorization.
- Preserve unrelated work. Do not rewrite Git history or choose a license independently.
- Keep documentation about current behavior, not conversations, temporary files, or an approval log.

## Product and architecture

- MirrorCube is a guide to solving a 2×2 Mirror Cube, not a general cube-model editor.
- The first public release targets the manual workflows on `main`. Photo input is a separate future workflow; do not merge `feat/offline-photo-tools` into `main` without approval.
- The app explicitly uses `MIRRORED_CUBE_PARAMETERS`: edge 50 mm; splits X=22, Y=20, Z=33. Keep the generic factory's historical Z=17 default for offline-tool compatibility; it is not an app option.
- Preserve exact piece identities and integer dimensions. Do not merge similar sizes, infer solvedness from silhouettes, or silently repair twists.
- A piece at a fixed corner has three proper orientations. Investigate dimensions, identity, reference frame, and handedness if a physical match fails; do not assume user error or add improper rotations.
- Keep domain rules and solver free of React, Three.js, UI, and localization dependencies.
- Drafts, animation/replay previews, and camera transforms are not committed puzzle state. Validate and explicitly confirm drafts before solving.
- Search and table construction run in a worker. Terminate on cancellation, reject stale results, and never label budget exhaustion as unsolvability or return partial solutions.
- Commit moves/history/progress exactly once after matching animation completion. Preserve monotonic IDs and the last committed state on failure.
- Free orbit is editor-only. Preserve click/drag separation, exact dimension labels, preset access, listener cleanup, and the standard solution camera on exit.
- Language changes must not reset puzzle state, camera inspection, workers, or playback.

## Verification and publication

- Follow [development checks](docs/contributing.md); report only checks actually run.
- Never commit credentials, private photos, local annotations, or image-containing reports. Review all staged files, not just source code.
- Treat every file in `dist` and every client-side environment value as public. Publish only `dist`, never the repository root or photo-tool output.
- Netlify's free plan is the intended host. Verify its current limits before deployment; no paid options, custom domain, or auto recharge without approval.
