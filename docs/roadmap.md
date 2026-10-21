# Roadmap

## Available

- Exact 2×2 Mirror Cube geometry and legal turns for one fixed model.
- Animated turns, scrambling, history, and undo.
- Direct manual state construction with exact dimensions, three orientations, presets, and free inspection.
- History-independent, worker-backed solution search.
- Animated solution steps, forward/backward navigation, demonstration replay, and confirmed reset.
- English/Ukrainian interface with responsive layout and keyboard-accessible controls.

## First public release: manual workflows

The first deployment will publish `main` **without photo input**. The preparation sequence is:

1. Simplify documentation, add a clean screenshot, and review repository security/privacy.
2. Measure the graphics bundle and improve loading/chunking where useful; rerun production checks.
3. Configure Netlify's free plan, publish only `dist`, verify security headers and HTTPS behavior, and smoke-test the deployed workflows.

Documentation cleanup and a local repository review are covered by this change. Bundle optimization and deployment remain pending. No public deployment is configured yet.

Each implementation stage, commit, push, deployment, or new dependency requires explicit approval. This roadmap is not blanket authorization.

## Later: photo input

Photo reconstruction remains a planned input workflow, separate from the first release. Offline analysis tools are preserved on `feat/offline-photo-tools`; they have not produced an accepted photo-derived puzzle state and are not part of `main`.

Before integration, establish a capture protocol, address calibration and occlusion, retain uncertain/rejected alternatives, and require correction/confirmation plus exact validation. One arbitrary photograph is not assumed sufficient. Recognition must remain separate from domain rules, solver, and rendering.

There is no approved scope yet for arbitrary cube models, draft persistence/export, general redo, adjustable playback speed, accounts, or backend services.
