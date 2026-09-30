# Twin Cities tour: low-end WebGL performance review

Review date: **2026-09-28**. Status: **findings and options for user review; no
optimization has been selected or implemented by this review.**

The release goal is a usable tour across inexpensive and older devices, including browsers
without WebGPU. The user reports that the 360° photographs appear to be the largest slowdown.
Prioritize that path while retaining improvements elsewhere. A particular phone is one test
sample, not the hardware target. Avoid reducing the experience on devices that can sustain it;
apply visible quality reductions only when needed or explicitly selected.

The comprehensive source review, all 70 optimization candidates, their expected performance
and UX effects, ownership, and revised panorama-first priorities live in FOSS Earth's
[WebGL and panorama performance review](../../../foss-earth/docs/webgl-panorama-performance-review.md).
This companion records the tour's content, release implications, and decisions still needed.

## Scope and confidence

The review inspected the current local working trees, including existing uncommitted changes,
and installed dependencies. It did not establish which revision is deployed. It made no
renderer or content changes and did not run a fresh build, phone benchmark, or device
qualification. Expected gains are hypotheses supported by code inspection, not measured FPS
improvements. Existing desktop validation is not an Android Firefox performance certificate.

Distinguish three workloads when evaluating changes: globe navigation and its preview markers,
loading or replacing a photograph, and rotating an already loaded immersive photograph.
Smaller downloads can improve arrival time without improving steady rotation. Lack of WebGPU
selects a backend; it does not establish the device's performance tier.

## Current tour content and startup

The [scene manifest](../public/tour/twin-cities/scene.json) describes separate files, not a
single large download. The [scene build](../tools/twin-cities/build-scene.mjs) uses FOSS Earth's
preparation tools; see the [build documentation](../tools/twin-cities/README.md).

| Item inspected | Finding | Implication |
| --- | --- | --- |
| Photographs | 60 distinct photographs from 79 source panorama IDs | Preview loading should be demand-driven; opening one photograph must not require all immersive images. |
| Manifest | 308,480 bytes; 60 assets, 24 groups, 134 links | Keep the small index together; splitting it into one request per stop does not address image rendering. |
| Preview representations | Cubes with 64, 128, and 256 px faces | Existing smaller assets can support visible-size selection and constrained residency. |
| Immersive representations | Equirectangular JPEGs at 2048 × 1024, 4096 × 2048, and 6144 × 3072 | Select by viewport, zoom, capability, and budget; the largest representation need not be the default everywhere. |
| Generated content folder | About 262.78 MiB of file bytes | This is publication size, not the startup download. Immersion files are fetched individually on entry. |
| Native-size re-encoding | Preserving the 60 validated original 6144 px JPEGs would save 28,774,081 bytes, about 18.1% of current full-size outputs | Avoiding another lossy generation reduces transfer and storage; it does not reduce decoded dimensions or GPU memory. |
| Existing production artifact | Main JavaScript: 6,446,461 bytes raw, about 1.47 MB gzip | Startup parsing and transfer deserve attention. This is an existing local artifact, not a fresh build or a deployed-size guarantee. |

The JPEG comparison sums the selected source photographs against their generated
`immersion-6144.jpg` files; the percentage uses the generated full-size output total as its
denominator. It is specific to this collection. Preserving originals must validate dimensions,
orientation, metadata policy, and scene byte counts through the shared preparation tool.

The current [entry point](../src/tour/twinCities.ts) mounts the full globe application. The
[content-delivery review](content-delivery.md) records loading and release boundaries, including
why app/content deployment separation alone does not reduce panorama shader work or the
browser's main JavaScript download.

## Panorama-first priorities

The next implementation choices should start with the shared review's lossless opportunities:
remove normal-use panorama diagnostic recording; cull invisible orbs; eliminate equivalent
per-fragment work; use opaque rendering for fully opaque immersion; bypass retained globe
scene evaluation and unrelated UI work during immersion; and cancel obsolete uploads.
Allocation, upload strips, and mip generation need coordinated admission and frame budgets.
These changes belong in FOSS Earth, with the tour consuming its public package exports.

Then compare prepared cubemap immersion with the current equirectangular shader, and complete
viewport/zoom-based representation selection. Cubemaps may remove expensive longitude/latitude
shader calculations, but require measured comparison of sharpness, seams, bytes, and frame
times. Tiled panoramas and GPU-compressed textures are larger options in the shared review.
Lowering framebuffer resolution is a separate, reversible quality control; it should not
automatically discard a detailed source photograph when memory permits retaining it.

## First pass: work-saving experiments (2026-09-29)

FOSS Earth now has four of the shared review's equivalent-output candidates behind switches,
all off by default: skipping the hidden globe while a panorama is shown, leaving out the
panorama renderer's test records, drawing a fully opaque panorama without blending, and
simpler WebGL panorama shaders. Renderer → Work-saving experiments has a tick box for each and
one for all; in the address bar, `?set.renderer.experiments.all=1` turns them all on for a
visit. FOSS Earth's [experiments page](../../../foss-earth/docs/validation/panorama-experiments.md)
says what each does.

They were measured on this tour's own build and photographs with FOSS Earth's
[scene A/B benchmark](../../../foss-earth/benchmarks/scene-ab/README.md), headless on an Apple
M5 at a phone's viewport:

```sh
npm run build:app
node ../../foss-earth/benchmarks/scene-ab/run.mjs --dist=dist-app --content=public \
  --page=/tour/twin-cities/ --rounds=5 --seconds=5          # add --webgl1 for WebGL 1
```

Every experiment draws the tour as before (the shaders within 1/255). Inside a stop, skipping
the hidden globe cut Babylon's main-thread render time by a quarter, since it examined 1 mesh a
frame instead of 289. No GPU change could be told from noise on that machine, which is the
wrong one to judge GPU savings. The
[retained runs](../../../foss-earth/validation/evidence/panorama-experiments/2026-09-29/README.md)
hold every number. Whether any of this is enough on a phone is what the device trial decides.

To try it on a phone, serve a production build on the local network and open it on the phone
with and without the switch:

```sh
npm run build && npm run preview -- --host
# then on the phone: http://<this computer's address>:4173/tour/twin-cities/
#               and: http://<this computer's address>:4173/tour/twin-cities/?set.renderer.experiments.all=1
```

## Tour-owned options to consider

All options below remain pending user selection. Generic representation, renderer, loader,
and shell changes belong in FOSS Earth; this repository owns the tour assets, presentation,
accessible content, and deployment choices that consume those features.

| Option | Expected performance or reliability effect | UX cost and boundary |
| --- | --- | --- |
| Preserve validated native-size source JPEGs; tune reduced variants | Smaller transfer/storage and no extra full-size JPEG generation | Native-size preservation avoids another lossy pass. Reduced-quality settings require photographic comparison. Change the shared preparation tool first, then rebuild here if selected. |
| Prepare cubemap, tiled, or GPU-compressed alternatives after shared support exists | Potentially lower fragment cost, view-dependent transfer, or GPU residency | Seams, sharpening delay, compression artifacts, and old-browser fallback need qualification. Do not generate unsupported variants speculatively. |
| Add smaller emergency immersive representations | Lower decode, upload, and residency costs | Softer photographs and reduced useful zoom. Preserve higher tiers for capable devices. |
| Provide static photographic sprites for preview markers as an optional last resort | Cheaper globe markers than analytic photographic orbs | Less elaborate marker appearance. Sprite rendering belongs in FOSS Earth; the tour supplies appropriate imagery. This does not require disabling interactive 360° viewing. |
| Build the accessible tour with meaningful HTML, photographs, descriptions, and stop navigation | Earlier useful content and a usable path when graphics cannot initialize | Static content cannot replace free look, but must preserve access to the tour. This is already open on the [roadmap](roadmap.md). |
| Offer panorama-first entry with the globe loaded on demand | Avoids initial globe data, scene, and startup costs for visitors viewing stops | Geographic exploration becomes optional or deferred. Shared lightweight viewer support belongs in FOSS Earth. |
| Offer a simple campus map and, only where necessary, static perspective views | Gives very constrained devices a usable route through the content | Reduced 3D context or free look; retain readable labels, touch targets, text, and stop navigation. |
| Publish immutable, versioned media independently and cache within an explicit allowance | Faster repeat visits and smaller app releases; stable references across deployments | Storage/data use must be bounded. Follow [content delivery](content-delivery.md); no host or migration is selected by this review. |
| Reduce the initial application bundle and defer optional UI/features | Less download, parse, compile, and initial heap work | First use of deferred features can wait. Shared imports and feature boundaries require changes in FOSS Earth. |

Keep **marker rendering**, **immersive rendering**, **source-image detail**, and **framebuffer
resolution** independent. A weak device may benefit from static markers while still sustaining
good interactive 360° photographs. Static immersive photographs are a separate last-resort
fallback when usable free look cannot be maintained.

## Decisions and release evidence still needed

The user will choose which optimizations are worth implementing and when. No named quality
tier, browser support floor, automatic downgrade order, or release threshold was approved by
this review. Shared automatic controls should react to measured CPU, GPU, loading, and memory
pressure within visible user limits, with conservative restoration and no oscillation.

Before claiming low-end readiness, exercise cold startup, active globe movement, settled 360°
rotation, image loading while dragging, rapid stop changes, return to the globe, and a sustained
session that exposes thermal slowdown and memory accumulation. Cover real WebGL1 and WebGL2
contexts on a representative range of devices and browsers. Record long frames and p95/p99
frame times alongside time to usable content, input responsiveness, memory behavior, and
context loss; a 30 FPS goal gives a 33.3 ms frame budget. The shared review supplies the fuller
qualification plan. These checks remain future work, not results of this document.
