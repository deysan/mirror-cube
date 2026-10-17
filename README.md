# MirrorCube

MirrorCube is an interactive, step-by-step guide to solving a 2×2 Mirror Cube. It will show how to hold the puzzle, which half to turn, and what each move does using a 3D view and animations.

The application will support **English and Ukrainian**, including the interface and solution instructions. Repository documentation is written in English.

## Current status

Documentation only. Application code, dependencies, and development commands have not been added yet. The features below are planned, not implemented.

## Documentation

- [Product and MVP scope](docs/product.md)
- [Incremental development roadmap](docs/roadmap.md)
- [Coding agent instructions](AGENTS.md)

## Technical direction

- React and TypeScript for the interface and typed application logic.
- Vite for local development and production builds.
- SVG for the initial 3D view, projecting 3D coordinates onto a 2D surface.
- Vitest for automated checks of the puzzle model.

Puzzle state and move rules, solution search, geometry/projection/animation, and UI should remain separate responsibilities. Add modules and dependencies only when needed for the current stage.

Localization will cover user-facing text without changing puzzle logic or state. Choose the localization implementation when building the multilingual interface; do not add a library or empty translation modules in advance.

## Deployment on Netlify

The target is Netlify's free plan, connected to the GitHub repository, using a `*.netlify.app` address without purchasing a domain. The free plan has usage limits; verify the current terms when setting up deployment. Paid options require the owner's explicit approval.

Once the Vite application exists, the expected settings are:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Base directory | Repository root |
| Build command | `npm run build` |
| Publish directory | `dist` |

These settings cannot produce a deployment yet: the application and build command do not exist. Connect Netlify and verify deployment in a separate stage after the first page is ready. Add redirects if and when client-side routing is introduced.

## Development workflow

Work in small, reviewable stages. Agree on the scope before implementation, verify the result afterward, and stop until the owner approves continuing. Do not commit or push changes without explicit permission.

## License

No license has been selected yet. A public repository does not by itself grant an open-source license to use the code.
