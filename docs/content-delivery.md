# Tour content and releases

The scene already has the folder-and-pointers layout needed for demand loading. The large
deployment is the sum of separate photographs; it is not a single 661 MiB scene download.

## On disk and over HTTP

```text
public/tour/twin-cities/
├── scene.json                         # metadata, positions, links and image URLs
└── media/
    ├── northrop-mall/
    │   ├── preview-64/{px,nx,py,ny,pz,nz}.jpg
    │   ├── preview-128/{px,nx,py,ny,pz,nz}.jpg
    │   ├── preview-256/{px,nx,py,ny,pz,nz}.jpg
    │   ├── eac-tiles/<face>/<level>/<x>/<y>.jpg   # equi-angular cube, 510 tiles of 194 px
    │   ├── cube-tiles/<face>/<level>/<x>/<y>.jpg  # ordinary cube, the same tiles
    │   ├── immersion-2048.jpg
    │   ├── immersion-4096.jpg
    │   ├── immersion-6144.jpg
    │   ├── asset.fragment.json        # preparation output used by the build
    │   └── prepared.json              # provenance and build reuse settings
    └── ...59 more panorama folders
```

The scene format belongs to FOSS Earth:
[`docs/scenes/format.md`](https://github.com/foss-earth/foss-earth.github.io/blob/main/docs/scenes/format.md).
The tour's build and sources are described in [tools/twin-cities/README.md](../tools/twin-cities/README.md).

`scene.json` is ordinary JSON with `format: "foss-earth-scene"` and `version: 1`. Its main parts
are `assets` (available image representations and their URLs), `entities` (panorama locations,
poses, titles and links), and `groups` (stops in tour order). `initialPanorama` identifies the
first stop; the tour's startup view uses `overview` for campus map framing. An entity names its image with `assetId`.
Each asset lists interchangeable representations, with their projection, dimensions and
`encodedBytes`. A cube preview points to six separate JPEG faces; a tiled cube to its tiles'
folder, with each level's bytes; a whole immersion image to one equirectangular JPEG. Media URLs
resolve relative to the manifest URL.

Measured from the generated scene on 2026-09-28, and its tiles on 2026-10-03:

| Content | Size | When needed |
| --- | ---: | --- |
| Manifest: 60 panoramas, 24 groups, 134 links | 308,480 bytes (301 KiB) | First; enough to know every stop and its position |
| All 64 px cube previews | 0.64 MiB | Smallest previews for the map or initial entry |
| All 128 px cube previews | 1.71 MiB | More preview detail when requested |
| All 256 px cube previews | 5.45 MiB | More preview detail when requested |
| All 2048 px immersion images | 24.37 MiB | Individual panoramas as they are opened |
| All 4096 px immersion images | 78.41 MiB | Individual higher detail upgrades |
| All 6144 px immersion images | 151.42 MiB | Individual full detail upgrades |
| All equi-angular tiles | 200.62 MiB in 30,600 files | The view's tiles of the panorama entered, at the level it needs: the default |
| All cube tiles | 197.98 MiB in 30,600 files | The same, when cube tiles are chosen |
| Whole generated content folder | 660.59 MiB in 62,460 files (263 MiB before the tiles) | Publishing content; never a prerequisite for showing the map |

The smallest preview tier for all 60 images is less than 1 MiB. Splitting this manifest into 60
metadata requests would add overhead without addressing the image loading problem. Keep the
small index together; fetch image representations independently, with bounded concurrency.

## Runtime delivery

Loading and rendering belong to FOSS Earth. The implemented sequence is:

1. Fetch and validate the manifest, then register all stops immediately. Prepare the campus
   overview's terrain independently of image downloads; ground-relative markers become
   positioned as the displayed terrain becomes available at each location.
2. Fetch each panorama's smallest allowed cube preview first (64 px by default), then sharpen
   toward the configured preview target behind other first-preview requests. Each ready orb
   appears independently; one slow panorama does not hold the entire scene back.
3. On entry, show the preview and load the representation the person chose in 360 image
   settings, equi-angular tiles by default. Tiles draw over the preview at once, and the view's
   tiles arrive at the level its pixels need, the largest share of the view first: on a phone
   that is the finest level, 1536 px faces, for 30 to 40 tiles. A whole image, when chosen,
   loads within the image detail and memory budgets and replaces the preview once usable.
   Nothing is fetched for a panorama until it is entered, and nothing passes through an
   intermediate size first.
4. Cancel obsolete requests on scene replacement or leaving a panorama. Report response bytes
   and failures through the scene's progress events and the app's log.

This is progressive delivery through separate image requests. A whole JPEG still has to finish
before its decoded texture is usable; tiles are each usable as they arrive, so the view
sharpens a tile at a time. FOSS Earth's
[progressive 360° prototype](https://github.com/foss-earth/foss-earth.github.io/blob/main/benchmarks/eac-progressive-prototype/REPORT.md)
measured the difference over throttled HTTP at 2 Mbit/s on three of these panoramas: the view
was within 1 dB of finished after 1.3 s and 258 KiB with tiles, while two of the three whole
images were not sharp in 10 s. The tour's tiles come from FOSS Earth's own JPEG encoder and are
22 to 37% larger than the prototype's for the same photographs, so expect about that much
longer. Here a finest-level equi-angular tile averages 6.5 KB, so a
phone's view of 35 to 40 tiles is about 250 KB, against 4.7 MiB for the photograph's 6144 px
image. Each tile is a separate small file, so a content release publishes tens of thousands of
files, and the content is now about two thirds of GitHub Pages' 1 GB site limit: a cost of the
Pages branch, not of loading, and a reason for the separate content origin below.

Panoramas render through WebGPU, WebGL 2 or capable WebGL 1 contexts. WebGL 1 requires
`EXT_frag_depth`, `OES_standard_derivatives` and high-precision fragment shaders for the same
orb depth and edge behavior. `EXT_shader_texture_lod` is optional; without it, the longitude
seam may sample a softer mip. A missing required capability produces a specific diagnostic.
Both WebGL paths submit image row strips within the configured upload allowance. WebGL 2 can
generate mipmaps for the 6144 × 3072 images and tracks outstanding uploads with GPU fences.
WebGL 1 uses bilinear filtering without mipmaps for that non-power-of-two size; 2048 and 4096
images can use mipmaps. It caps per-frame submissions by both upload limits because WebGL 1
does not expose GPU fences. These are capability and implementation differences, not a claim
that a particular phone or backend has been performance-qualified.

## Development and current releases

Use `npm run dev` for iteration, or `npm run dev -- --host 0.0.0.0` for a phone on the same
network. The HTTP network address Vite prints can use WebGL; WebGPU needs a secure context,
so exercising that backend on a phone requires a trusted HTTPS development proxy or tunnel.
Vite reads `public/` directly and hot reloads app edits. Neither command deploys or
re-encodes photographs. Run `npm run build:scene` only when the scene inputs change; unchanged
prepared images are reused.

The release commands separate the two independently changing inputs:

| Command | Input | Effect on `gh-pages` |
| --- | --- | --- |
| `npm run deploy` or `npm run deploy:app` | `dist-app/`, built without copying `public/` | Adds current app and landing-page files; keeps content and older hashed bundles |
| `npm run deploy:content` | `public/`, checked against its manifest | Adds current scene and media; keeps the app and older content |
| `npm run deploy:full` | Complete `dist/` | Replaces the branch contents with the complete build |

On 2026-09-28, an app-only build contained 85 files and 7.02 MiB, compared with the content
folder's 1,381 files and 262.78 MiB. The app's main JavaScript bundle is still substantial
(about 1.48 MB compressed in that build); separating deployments does not reduce that startup
download.

The app-only helper rejects output containing scene files or photographs. Both content and
full releases run FOSS Earth's `check-scene.mjs` before publishing. `--dry-run` prints the file
count and byte size and performs checks without publishing:

```sh
npm run build:app
node tools/deploy.mjs app --dry-run
node tools/deploy.mjs content --dry-run
```

Additive releases deliberately retain old bundles and files so cached pages still work. They
are not a garbage collector: an occasional full refresh removes files absent from the current
build, and should be planned when old sessions no longer need them. No release rewrites Git
history. `gh-pages` reuses its local cache under `node_modules/.cache/gh-pages`; a cold cache
must clone the published branch. Git transfers changed objects on later pushes, so the large
branch does not prove that unchanged photographs were uploaded on every release.

**The tiled release, 2026-10-03.** The app went first (85 files, 7 MiB; Pages built it in about
a minute), and the content ten minutes later, once GitHub Pages' cached copies of the old app
had expired (`Cache-Control: max-age=600`). The content release took 11 minutes: about 6 to copy
and commit 62,581 files in the `gh-pages` cache and 4.5 to push them. Pages then built the site
in 2 min 14 s, well inside its 10-minute limit. The cache under `node_modules/.cache/gh-pages`
is now 1.6 GB: keep it, or the next release clones the published branch again. Pushing `main`
with the tiles took 4.5 minutes as well; the `gh-pages` push uploads the same files again,
since its cache cannot see `main`'s objects.

This split removes repeated local copying of the scene from app releases. It does **not**
split the final GitHub Pages site artifact: its branch build still sees all the media. The
server-side part of a long deploy can remain. The observed
[2026-09-28 Pages run](https://github.com/UMN-VR/UMN-VR.github.io/actions/runs/36381847888)
took about 67 seconds from creation to completion: its build job took 44 seconds and its
deployment job 14 seconds. That run does not account for ten minutes by itself. The preceding
local build, cold clone and initial media push are plausible contributors, but were not timed.
GitHub currently documents a 1 GB published-site
limit and a 10 minute deployment timeout; the tour should not grow indefinitely inside that
artifact. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Next delivery boundary

Put the scene and media on a separately published static content origin, with the U or the club
owning its account and retention policy. The app should publish only HTML, JavaScript, CSS and
the scene's URL. Choosing and connecting that storage is a separate deployment change; no
third-party account or media migration is configured here.

Use a versioned scene folder, for example `twin-cities/<revision>/scene.json`, with relative
media references. Upload and validate images first and the manifest last, then point the app
at that immutable manifest. Retain older versions while deployed app releases reference them.
Content hashes in shared image paths can avoid duplicating unchanged photographs across scene
revisions. Long-lived caching belongs on immutable media URLs; a mutable scene pointer needs
revalidation. The content service must supply correct image MIME types and CORS for the app's
origin.

`VITE_TOUR_SCENE_URL` configures the app's manifest URL at build time. Once a content origin has
been chosen, this lets the existing app release consume it without rewriting the scene format.
For example, to build an app overlay against a manifest that has already been published:

```sh
VITE_TOUR_SCENE_URL=https://content.example.edu/twin-cities/revision/scene.json npm run build:app
```

Its host and manifest must permit the app to fetch all referenced images. Moving the media
out of the Pages branch is what removes it from Pages' app deployment artifact; the additive
release commands above are an interim workflow.
