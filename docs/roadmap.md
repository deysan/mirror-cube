# Roadmap

## Available

- Exact 2×2 Mirror Cube geometry and legal turns for one fixed model.
- Animated turns, scrambling, history, and undo.
- Direct manual state construction with exact dimensions, three orientations, presets, and free inspection.
- History-independent, worker-backed solution search.
- Animated solution steps, forward/backward navigation, demonstration replay, and confirmed reset.
- English/Ukrainian interface with responsive layout and keyboard-accessible controls.

## Public release: manual workflows

The manual app is live at **https://mirror-cube.netlify.app/**, built from `main` **without photo input**. Documentation cleanup, a bounded repository review, graphics loading/chunking, and the initial Netlify deployment are complete.

Only `dist` is published. HTTPS, security/cache headers, worker loading, and desktop/mobile workflows have been checked on the public site. Git continuous deployment is not connected; see [deployment](deployment.md) for release checks, hosting limits, and remaining verification boundaries.

Each implementation stage, commit, push, deployment, or new dependency requires explicit approval. This roadmap is not blanket authorization.

## Later: photo input

Photo reconstruction remains a planned input workflow, separate from the first release. Offline analysis tools are preserved on `feat/offline-photo-tools`; they have not produced an accepted photo-derived puzzle state and are not part of `main`.

Before integration, establish a capture protocol, address calibration and occlusion, retain uncertain/rejected alternatives, and require correction/confirmation plus exact validation. One arbitrary photograph is not assumed sufficient. Recognition must remain separate from domain rules, solver, and rendering.

There is no approved scope yet for arbitrary cube models, draft persistence/export, general redo, adjustable playback speed, accounts, or backend services.
