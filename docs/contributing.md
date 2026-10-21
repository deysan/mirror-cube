# Development and verification

## Setup

Use Node.js 24.15+ within 24.x and npm; `package.json` lists the full supported range. Install the committed lockfile with `npm ci`.

```sh
npm run dev          # Local Vite server
npm test             # Vitest suite
npm run test:watch   # Watch mode
npm run typecheck    # TypeScript only
npm run build        # TypeScript + production build in dist
npm run preview      # Serve the production build locally
npm audit            # Known dependency advisories; requires registry access
```

The application uses React/TypeScript and Three.js/React Three Fiber. Keep domain rules, search, browser resources, rendering, and localization separate. See [architecture](architecture.md) and [solver design](solver.md).

## Change checklist

- Keep changes focused and add tests for behavior and failure paths.
- Preserve exact identities, geometry, and proper orientations; never derive domain state from meshes.
- Keep heavy search and table initialization in the worker.
- Preserve snapshot guards, atomic completion, stale-result rejection, and resource cleanup.
- Include English/Ukrainian text and keyboard-accessible alternatives for new controls.
- Update the relevant documentation rather than appending a development diary.
- Run tests, type checking/build, and `git diff --check`. Review staged filenames/content before publication.
- Follow [security and privacy practices](security.md). Do not add dependencies, publish, or rewrite history without explicit approval.

## Browser smoke checks

Use the production build, not only the dev server. Check both languages at desktop and narrow mobile widths, including 320 px:

1. Turn R, U′, F2; undo and compare the restored state/history. Scramble and verify sequential updates and locking.
2. Enter a complete physical-state draft. Verify duplicate/invalid-twist guards, three orientations, exact rulers, and apply/cancel confirmations.
3. Test all presets and free inspection: mouse/one-finger drag, short tap selection, out-and-back drag suppression, no zoom/pan, and live rulers. Resize and switch language; exit and confirm the standard camera returns.
4. Search with a real worker, cancel a cold search, and retry. Confirm the UI stays responsive and the cube/history remain unchanged until playback.
5. Execute steps, navigate forward/backward, and replay a demonstration. Check each intermediate commit and final solvedness; reset only after confirmation.
6. Check keyboard focus, bounded instruction/history lists, no horizontal overflow, and reduced motion.
7. Simulate WebGL context loss. An unfinished turn/replay must not commit; preserve the completed prefix and offer the localized fallback.
8. Check the console and Network panel for errors and unexpected external requests.

Domain tests include complete coordinate-graph BFS; they do not exercise every full pose through the browser. jsdom tests mock WebGL and use controlled worker stubs. Local Chrome/WebGL checks have covered the manual workflows at desktop/mobile widths, but are not a committed cross-browser E2E suite. Touch emulation is not a substitute for a physical touch device.

## Build and publication

Only `dist` is a deployable application artifact. Source, docs, tests, development tools, and private reports must not be served as the site root. `npm run preview` is a local check, not production hosting.

The graphics bundle currently triggers Vite's 500 kB chunk warning. This is not a build failure. Measure dependency contribution and loading behavior before changing chunk boundaries or warning thresholds; splitting files does not itself reduce total downloaded code. Bundle optimization is a separate follow-up.

The first release targets the manual workflows from `main`. Netlify setup, current free-plan limits, security headers, caching, and HTTPS smoke checks still need a separately approved deployment stage. Photo input is not a prerequisite for that release and must not be merged from its separate branch as part of deployment preparation.

## README screenshot

`images/mirror-cube.webp` is a screenshot of the production-preview UI with a mixed virtual state, not a photograph or a recognition result. Capture only the page using a fresh browser profile; exclude browser chrome, private files, paths, and console output. Re-encode the image without metadata, check it visually, and keep it small. The documentation image is not imported by the application or copied into `dist`.
