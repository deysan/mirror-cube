# Coding agent instructions

## Context

MirrorCube is an interactive, step-by-step guide to solving a 2×2 Mirror Cube. The application will provide its interface and solution instructions in English and Ukrainian. The owner is a frontend developer experienced in React and TypeScript who wants to review changes, understand the architecture, and control decisions.

The final goal is photos of a physical cube → reconstructed and confirmed state → solution search → animated instructions. Photo input is required but deliberately deferred until the solver and playback work. The virtual cube is a foundation, not the complete product. Do not assume one photo is sufficient or that move history will be available to the solver.

Before working, read [README.md](README.md), the [product description](docs/product.md), and the [roadmap](docs/roadmap.md). Do not treat planned features as already implemented.

## Collaboration

- Explain decisions to the owner in Ukrainian, at a developer-friendly level.
- Write all repository documentation in English. Ukrainian application translations are expected when localization is implemented.
- Describe the product as a guide to solving a 2×2 Mirror Cube; do not add experimental or commercialization framing.
- Work in small, complete stages: one clear behavior change or a focused infrastructure task at a time.
- Before each stage, briefly explain what will be implemented, which parts will change, and why this approach was chosen.
- Do not start an unapproved stage. The roadmap is not permission to implement every item.
- After each stage, summarize the changes, key files, verification steps, and known limitations. Stop until the owner asks to continue.
- Do not commit or push without the owner's explicit permission. Approval to edit files is not approval to publish them.
- Do not add out-of-scope features or empty modules for future stages.
- Update documentation when implementation changes documented assumptions or commands.

## Technical direction

- Use React, TypeScript, and Vite, with Three.js and React Three Fiber for rendering.
- Three.js replaces the initial solved-only SVG renderer to handle depth and occlusion during shape-changing turns. No separate animation-timing library is currently needed.
- Before adding any further graphics or animation tool, explain the specific problem it solves.
- Separate puzzle state/move rules, solution search, geometry/projection/animation, and UI. When photo input is implemented, keep recognition as a separate boundary that produces a candidate state for confirmation and validation; do not scaffold it beforehand.
- Keep the mathematical model and solution search independent of React, Three.js, and the selected language. Convert domain data to Three.js objects only in the rendering layer.
- Introduce abstractions and dependencies only when there is a concrete need.
- Preserve each piece's exact local dimensions along all three axes during turns. Do not equate similar dimensions or determine solved status from an approximate silhouette.
- Implement English and Ukrainian user-facing text as part of the localization and subsequent UI stages. Language switching must not reset puzzle state or solution progress.
- Choose the localization approach when it is needed; do not scaffold unused translation modules in advance.

## Verification

Add meaningful tests alongside the relevant functionality:

- solved-state geometry is correct;
- a move followed by its inverse restores the state;
- four quarter-turns restore the state;
- turns preserve piece identities and local dimensions;
- animation endpoints match exact move geometry, and duplicate/stale completion callbacks cannot commit twice;
- state validation rejects impossible corner twists but accepts legal odd permutations on a 2×2;
- solver encoding preserves exact poses through round-trips and maps moves correctly through all global frames;
- applying a returned solution actually solves the input state without requiring its move history;
- language switching updates user-facing text without changing puzzle state or solution progress.

Run the checks available for the current stage. Report what was verified and what could not be verified; never claim that unrun tests passed.

## GitHub and deployment

- The repository is public: never commit secrets, tokens, private keys, or local environment files.
- Target Netlify's free plan with a `*.netlify.app` address, but defer deployment until solving and animated step-by-step playback are ready.
- Do not enable paid options, services, or a custom domain without separate approval. Check current free-plan terms before deployment.
- Do not add deployment configuration before a buildable application exists.
- The owner chooses the license; do not add one independently.
