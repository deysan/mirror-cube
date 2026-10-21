# Security and privacy

## Application boundary

MirrorCube is a static browser application. Puzzle input, history, drafts, and search remain in the browser; there is no application backend, account system, analytics integration, cookie usage, or persistent state storage. Hosting still receives ordinary HTTP requests and may keep access logs: browser-side solving is not a claim of anonymous hosting.

The app loads its own assets and module worker. State input is validated before search; private worker messages are tied to a worker, request ID, and snapshot. Heavy work stays off the UI thread, with budgets and termination-based cancellation. These correctness/resource guards are not authentication for a future public API.

The current application has no photo/file importer, user-supplied HTML, or external recognition service. Do not extend these trust boundaries without a separate review.

## Repository hygiene

- Never commit credentials, tokens, private keys, local environment files, personal photographs, annotations, or image-containing reports.
- Keep private source material and generated reports outside **all** repository checkouts/worktrees. Ignore rules are only a secondary safeguard, not a privacy boundary.
- `.env` files, dependency/build directories, local logs, Netlify state, a root `private/` directory, and common private-key/container extensions are ignored. These patterns do not detect secrets in ordinary files. A deliberately tracked `.env.example` must contain placeholders only.
- Review staged files and public documentation for local paths, identifying details, obsolete development notes, and accidentally embedded images.
- All client-side environment values and build artifacts are public. Never place a secret in a `VITE_*` variable or frontend bundle.
- Removing a file from the current tree does not remove it from branches or history. Revoke/rotate an exposed credential first; coordinate any history cleanup separately. Do not paste secrets into public issues.
- Git author identities, commit messages, branches, and previously published content remain public unless explicitly addressed. Do not rewrite history as routine documentation cleanup.

## Separate photo tools

`feat/offline-photo-tools` contains trusted-local analysis scripts, not a hosted upload service or accepted recognizer. Generated HTML embeds original image bytes, which can retain metadata; never publish those reports. JSON exports can also contain identifying review notes.

The reviewed report generators escape text, validate coordinates/decisions, reject output inside their own checkout, refuse existing output directories, and emit restrictive offline CSPs. The decoder uses an installed Chromium with a temporary profile, a debugging pipe rather than a public debugging port, and blocked page-network requests. Catalog hashes check integrity/reproducibility, not authenticity.

Limits are not uniform across all CLI inputs: JSON and some image files are read before size checks, and the output guard does not enumerate other worktrees. Use trusted local inputs, an up-to-date browser, and output outside every checkout. Do not expose these scripts as a network service without resource limits, path restrictions, and a new threat-model review. This branch is excluded from the first deployment.

## Pre-release review

A local review of application baseline `b6c62df` and photo-tools baseline `0f4434b` covered:

- All locally fetched branch refs and their reachable history: 20 commits and 276 file blobs. Pattern checks found no recognized credential/private-key formats, personal home-directory paths, or long embedded image payloads. No binary file blobs were present in that baseline.
- Tracked filenames, documentation, scripts, package configuration, and browser network/injection/storage entry points; manual inspection of the worker boundary and photo report/decoder paths.
- The lockfile: all 156 dependency archive URLs use the npm registry and include integrity values. The optional platform dependency `fsevents` declares an install script; registry provenance/integrity are not proof that dependencies are safe.
- `npm audit`: zero known advisories reported at review time, including development dependencies. This result is time-sensitive, not a guarantee against undisclosed vulnerabilities.
- A production-preview Chrome run through turns, worker search, complete animated solving, and language switching requested only the same-origin page, JS, CSS, and worker; no external page requests, HTTP errors, or uncaught browser exceptions were observed. The README screenshot was captured from this UI and stripped of image metadata.

The review uses local pattern scanning and targeted code inspection, not an independent penetration test or exhaustive proof. It does not cover unreachable Git objects/reflogs, forks, GitHub issues/attachments/caches, account settings, host configuration, or every transitive dependency's implementation. Documentation cleanup does not erase old text from history or the separate photo branch.

## Before deployment

- Repeat dependency and staged-file checks; review the final `dist` contents and runtime requests.
- Publish only `dist`, not the repository root, source maps, private artifacts, or photo reports. Source maps are currently not emitted by the production build; their absence does not make client code secret.
- Configure and test a Content Security Policy, `X-Content-Type-Options`, referrer policy, framing restrictions, and an appropriate permissions policy on the host. These headers are **not configured yet**.
- Base CSP on actual requirements: same-origin module workers/scripts/styles and canvas-generated image textures. React/Three.js use runtime styles; test enforcement rather than copying a policy that breaks the scene or allowing broad script execution.
- Verify HTTPS, asset caching, worker MIME/loading, scene failure handling, both languages, and mobile interaction on the deployed site.
- Review Netlify account access and current free-plan limits separately. Do not enable paid options or publish a site without approval.
