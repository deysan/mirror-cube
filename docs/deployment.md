# Deployment

- **Live app:** https://mirror-cube.netlify.app/
- **Netlify project:** https://app.netlify.com/projects/mirror-cube
- **Release scope:** manual workflows from `main`; no photo tools, functions, database, or application backend.

## Build and publication

The site uses the existing Netlify Free team without a plan change or paid add-ons. The first release was built locally and uploaded through the authenticated Netlify API. Only the contents of `dist` are published. Git continuous deployment is **not connected**: pushing to GitHub does not update the live site.

`netlify.toml` defines the source-build settings: Node.js 24, `npm run build`, publish directory `dist`. Vite copies `public/_headers` and `public/favicon.svg` into that directory. Keep `.netlify/` ignored; no deployment credentials belong in source or client environment variables.

For an approved release:

1. Use the intended `main` revision; keep the photo branch separate.
2. Run `npm ci`, `npm test`, `npm run build`, `npm run check:bundle`, and `npm audit`. Review the output and any advisories rather than treating a successful build as a security audit.
3. Inspect `dist`: HTML, the favicon, `_headers`, and hashed JS/CSS assets only. Do not upload the checkout, source maps, local environment files, screenshots, private reports, or photo inputs.
4. Publish the built directory to the existing Netlify project. A prebuilt API build archive may wrap it as `dist/` with a root `netlify.toml` containing an empty build command and `publish = "dist"`; it must not include the source checkout. This bypasses remote compilation, not local verification.
5. Check deploy readiness and the public URL, compare asset hashes, and repeat the [production browser checks](contributing.md#browser-smoke-checks).

Connecting Git, enabling automatic deploys, or publishing another release requires explicit approval. Do not enable photo-branch deployments as part of manual-app maintenance.

## Headers and caching

`public/_headers` is the shared policy for manual uploads and source builds:

- CSP allows same-origin scripts, module workers, styles, and connections; images also permit data URLs. No inline scripts, `eval`, objects, frames, or form submissions are allowed. `base-uri` and framing restrictions prevent base-URL injection and embedding.
- `style-src 'unsafe-inline'` is deliberately limited to styles: React/Three.js use runtime style attributes. It does not permit inline JavaScript.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a permissions policy disable unneeded camera, microphone, location, payment, and USB access.
- HTML must revalidate. Content-hashed `/assets/*` files, including the solver worker, are immutable for one year. Non-hashed files must not receive this immutable policy.

There is no catch-all SPA rewrite: this app has no pathname router. Missing JS or private/source paths return 404 rather than HTML with a successful status. Old tabs may need a reload after a release if an uncached old asset is no longer available; reload discards local puzzle state.

## Verified behavior and limits

The public HTTPS site was checked for HTTP-to-HTTPS redirection, exact local/remote asset hashes, security/cache headers, worker JavaScript MIME, and unavailable source/private paths. Production Chrome checks covered both languages, loading and download failures, manual construction, camera inspection, real worker search, animated solving/navigation/replay/reset, and WebGL context loss at desktop/mobile viewport sizes. Normal security smoke workflows had no CSP violations or external page requests; a deliberate inline-script attempt was blocked.

Touch verification uses Chrome emulation, not physical hardware. These checks are not a penetration test, a cross-browser guarantee, or continuous monitoring. Hosting may retain ordinary access logs.

Free-plan limits depend on account generation. Current credit-based Free plans have a 300-credit monthly hard limit and no auto recharge; a production deploy costs 15 credits. Legacy Free plans instead document hard limits of 100 GB bandwidth and 300 build minutes per month. Confirm the team's actual billing dashboard and remaining allowance before further releases; the MCP team summary identifies Free but does not expose remaining usage. Do not migrate plans, buy credits, enable auto recharge, or add a paid/custom-domain feature without approval.

References: [credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [legacy plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/), [custom headers](https://docs.netlify.com/manage/routing/headers/).
