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

## When something goes wrong

**First, which version is it?** A phone that comes back to a tab may show its own copy of the
page from days before, with the app of that day: on 2026-10-04 an iPhone was still running the
tour of two days and four releases earlier, and it took the sections missing from its Settings
tab to tell.

- The log's first line, as the tour opens, says which version runs: "App built 2026-10-04
  19:54 UTC from a2c6c28 with FOSS Earth 35ad0e3." The first commit is this repository's and
  the second FOSS Earth's. Settings → About has them in full.
- An app from before that line has none. Its Settings tab tells its age: three sections
  (Presets, Saved settings, About) is an app from before the evening of 2026-10-03; four, with
  App files, from that evening; five, with Diagnostics, from 2026-10-04. Reload the tab, or
  close it and open the address in a new one, to get the published app.
- From the app with that line on, a page that is older than the published one reloads itself
  when it opens, and says so; once it has been touched it says a newer version is published,
  with a Reload button. Settings → App files has the same, and Ask now.
- What the site publishes is in its page's source:

  ```sh
  curl -s -A foss-earth-check/1.0 https://umn-vr.github.io/tour/twin-cities/ | grep -o '<meta name="foss-earth[^>]*>'
  ```

The tour says what it knows. Settings (the gear on the bar) → Diagnostics → **Copy report**
gives, as text, the version that ran, the browser, the renderer and its GPU, the settings that
were changed, and what the visit did: each photograph entered, each warning and error. If the
page stopped without being closed, as a phone's browser stops one that takes too much memory,
the next visit says so in its log, with the photograph it was in. If the tour does not stay
open long enough to reach Settings, add `?report` to its address
(<https://umn-vr.github.io/tour/twin-cities/?report>): the page shows the report and does not
start the map. Nothing is sent anywhere; the report is yours to paste where you report the
fault. FOSS Earth's
[diagnostics page](https://github.com/foss-earth/foss-earth.github.io/blob/main/docs/diagnostics.md)
has the details, and how to attach a browser's inspector to a phone.

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

Commit first, here and in FOSS Earth: the build writes both commits into the page and the app,
with `-dirty` after one that had changes not committed, and that is how a phone's version is
told from another. After a release, a page of the app before it reloads itself the next time
it asks the site, within ten minutes while it is shown, unless someone has touched it.

After a placement or photograph changes, run `npm run build:scene`, then
`npm run deploy:content`. Content releases validate the manifest and all referenced image files
before publishing. When the app and the content change together, publish first the side the
other relies on, so the live pair always works:

- New content an old app can read: the content first, then the app.
- Content the deployed app cannot read: avoid it. The app would go first and the content ten
  minutes later, when GitHub Pages' cached copies of the old page have expired, but a browser
  that restores a tab shows the page it has for as long as it keeps it: on 2026-10-03 an
  iPhone still ran the day before's app an hour after a release, and that app refused the
  scene for its preview sheet. The sheet is now an extension of the scene format, which an
  app that does not know it skips, and so is whatever else a scene can be shown without. The
  tiled cubes of 2026-10-03 were such a change too: an app from before then refuses a scene
  that lists them, and a later app skips any kind of image it does not know.

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
