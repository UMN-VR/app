# UMN VR site and campus tour

This repository is <https://umn-vr.github.io/>. It holds two things:

- **The UMN VR club's landing page:** `index.md` and `Media /`, rendered by GitHub Pages' Jekyll.
- **The University of Minnesota's virtual campus tour:** <https://umn-vr.github.io/tour/twin-cities/>.
  It is an app built on [FOSS Earth](https://github.com/foss-earth/foss-earth.github.io), the
  way [0SFS](https://github.com/0SFS/0SFS.github.io) is. FOSS Earth provides the globe and the
  panorama viewer; this repository provides the tour's scene and page.

[AGENTS.md](AGENTS.md) sets out what belongs here, in FOSS Earth and in 0SFS.

## Running the tour locally

The tour links FOSS Earth and gamepad-tools from checkouts beside this one, as 0SFS does:

```text
gh/
├── foss-earth/
├── Felipegalind0/gamepad-tools/   (built: npm run build)
└── UMN-VR/UMN-VR.github.io/
```

```sh
npm install
npm run dev
```

Open the address Vite prints. It leads to the tour, which opens with the campus scene loaded.
App edits hot reload; a deploy is not part of this development loop. For a phone on the same
network, use `npm run dev -- --host 0.0.0.0` and scan the QR code `npm run qr` prints in another
terminal; it carries the Google key too ([FOSS Earth: Testing on a phone](../../foss-earth/docs/development.md#testing-on-a-phone)). An HTTP
LAN URL uses the WebGL fallback; to exercise WebGPU, use a trusted HTTPS development proxy or
tunnel, since WebGPU requires a secure context. Panorama rendering supports WebGL 2 and
capable WebGL 1 contexts; [content delivery](docs/content-delivery.md) describes the limits.
The generated scene and media are served directly from `public/`, without copying or uploading
them for each edit.

## How the photographs load

Inside a panorama, each photograph arrives as tiles of an equi-angular cube: only the tiles the
view needs, at the detail its pixels need, drawn over the orb's preview, which is on screen
already. The view sharpens in a second or two on a 2 Mbit/s connection (measured on a desktop
with Chrome's network emulation; not yet on a phone), where a 5 MiB whole
image took 20 seconds or more, and a look back shows tiles already loaded. This is FOSS Earth's
[tiled cube](https://github.com/foss-earth/foss-earth.github.io/blob/main/docs/scenes/format.md#tiled-cubes),
measured in its [progressive 360° prototype](https://github.com/foss-earth/foss-earth.github.io/blob/main/benchmarks/eac-progressive-prototype/REPORT.md);
the build makes both kinds of tiles and the whole images for every photograph.

Each file is downloaded once. The viewer keeps what it downloads in the browser, under the
photograph's revision in the scene, and reads it from there on a reload, on a later visit and
when you look back at a part of a panorama: Scenes → Saved images shows what is kept (256 MB at
most), what the visit took from it, and clears it. The map shows all 60 orbs after one request,
from one image that holds every photograph's small preview, and loads a sharper preview only
for an orb drawn large enough to show it. FOSS Earth's
[scene format](https://github.com/foss-earth/foss-earth.github.io/blob/main/docs/scenes/format.md#saved-images)
describes both. The app's own files are kept too, by FOSS Earth's
[service worker](https://github.com/foss-earth/foss-earth.github.io/blob/main/docs/app-files.md),
so a later visit downloads none of them however long after the last it comes (Settings → App
files). On a phone or another device with little graphics memory, the GPU holds the view and
gives the rest back to the disk: Scenes → Loading and memory and Tiled images set how much.

Two selectors, each a row of buttons:

| What | Where | Choices |
| --- | --- | --- |
| **Renderer**, the GPU interface | The renderer button on the bar at the bottom (it reads WebGPU, WebGL2 or WebGL) → Renderer tab | Auto-detect, WebGPU, WebGL2, WebGL. A change reloads the page. |
| **Representation**, how the photograph arrives | Inside a panorama: 360 image settings → Image | Equi-angular cube tiles (the default), cube tiles, whole image. A change applies at once: the new kind loads behind the one on screen, then crossfades in. |

**Tile outlines**, beside Representation, draws each tile's edges and tints it by its level as
it loads. The panorama's own tab says how many of the view's tiles are on screen and how much
has been downloaded; Scenes → Tiled images holds the tiles' memory, requests and uploads per
frame. Both choices can be put in a link, as any FOSS Earth setting can, for showing the tour
one way: `?renderer=webgl2`, `?set.scene.panorama.representation=cube-tiles` or `=whole`,
`?set.scene.panorama.tileOutlines=true`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The tour with hot reload, FOSS Earth included |
| `npm run qr` | Prints a QR code that opens the running dev or preview server's tour on a phone, with the Google key |
| `npm run build:scene` | Rebuilds the tour's scene from the YouVisit backup; see [tools/twin-cities/README.md](tools/twin-cities/README.md) |
| `npm run build:app` | Builds `dist-app/`, leaving the scene and photographs out |
| `npm run build` | Builds the complete site in `dist/`, for `npm run preview` or a full release |
| `npm run ci` | Lint, tests and a production build |
| `npm run deploy` / `npm run deploy:app` | Builds and publishes only the app and landing page; preserves published content |
| `npm run deploy:content` | Checks and publishes the generated scene and photographs; preserves the app |
| `npm run deploy:full` | Builds and replaces the complete published site; use for the first release or an intentional full refresh |

## Layout

| Path | Contents |
| --- | --- |
| `tour/twin-cities/index.html`, `src/tour/` | The tour page: FOSS Earth's app, offering the tour's scene and opening it |
| `public/tour/twin-cities/` | The scene and its prepared images, generated by `npm run build:scene` |
| `tools/twin-cities/`, `tools/deploy.mjs` | The scene's build and hand-edited placements, and the separate release commands |
| `docs/` | What is left to do ([roadmap.md](docs/roadmap.md)), and a prompt for each larger piece |
| `index.md`, `_config.yml`, `Media /` | The Jekyll landing page, copied into the build unchanged |
| `.local/` | Gitignored: the YouVisit backup the tour is built from, and scratch |

## Deploying

Routine releases use `npm run deploy`, which builds `dist-app/` and adds just those files to
`gh-pages`. It does not rebuild, copy or replace the 661 MiB of scene content. Existing
photographs and old hashed app bundles remain available for people with a page already open.

After a placement or photograph changes, run `npm run build:scene`, then
`npm run deploy:content`. Content releases validate the manifest and all referenced image files
before publishing. When the app and the content change together, publish first the side the
other relies on, so the live pair always works:

- New content an old app can read: the content first, then the app.
- Content the deployed app cannot read: the app first, then, ten minutes later, when GitHub
  Pages' cached copies of the old page have expired, the content. The tiled cubes of
  2026-10-03 are such a change: an app from before then refuses a scene that lists them, and a
  later app skips any kind of image it does not know.

Preview what would be sent without publishing:

```sh
npm run build:app
node tools/deploy.mjs app --dry-run
node tools/deploy.mjs content --dry-run
```

`npm run deploy:full` keeps the original complete-site release in `dist/`:

- the tour's pages and bundle;
- its scene and images;
- the landing page's sources, which GitHub Pages renders with Jekyll as before.

The build refuses to produce a file that Jekyll would leave out, one whose name starts with `_`
or `.`. App-only output is a release overlay, so use `npm run build` followed by
`npm run preview` when you need a complete local production preview.

This reduces local copying and keeps content out of routine app release payloads. **GitHub
Pages still builds and publishes the whole branch.** It does not make the existing media leave
that branch or guarantee a short Pages job. A cold `gh-pages` cache also still clones that
branch's current files. The remaining split—an independently hosted, versioned scene folder—is
described with the format and loading strategy in [docs/content-delivery.md](docs/content-delivery.md).

Before the first deploy, GitHub Pages must serve the `gh-pages` branch instead of `main`: under
**Settings → Pages**, set the source to the `gh-pages` branch and its root. Until then the live
site is still `main` as Jekyll renders it.
