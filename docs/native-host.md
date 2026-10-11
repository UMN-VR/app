# Campus native host source preparation

Status: Contract-repair source only, 2026-10-10. No module import, install, typecheck,
lint, test, build, pack, media operation, browser or server has been run for this
batch. Fifteen native-owner cases and seven native-entry cases are unrun. This is
not a qualified release; prior passing CPU receipts remain unchanged.

`createCampusNativeHostFactory` is the Campus factory at `@umn-vr/app/native`.
Vite calls the creator with serializable About and deployment data. It must
not pass the creator itself as the native host, or substitute an Earth App/site
mount wrapper. The App artifact/source pin is distinct from the exact qualified
Engine, Renderer, 360, UI, Images and Sky provider pins. Draft shared source is
not an accepted replacement for those delivery pins.

The JSON input contains `about.release`, `about.builtFrom` (including null),
`about.identity`, and `deployment.publishedVersionUrl`, `workerUrl`,
`workerScope`, `retainedResourceUrls`, `cacheNamespace` and optional
`messageIdentity`. `workerUrl` is `/foss-earth-sw.js`; `workerScope` is `/`.
Namespace and optional message identity must match the generated worker.
`overviewPreparation` optionally carries finite positive timing values and the
Campus overview minimum radius. A programmatic consumer may provide `onError`;
JSON carries no callback.

Campus owns route/catalogue injection, placements, About identity, launchers,
deployment policy and overview ground acceptance. Engine owns the globe,
geographic navigation, surface queries, map selection and native map bindings.
360 owns published previews/immersion, navigation/input adapters, pose math,
resource choice and rendering. Renderer owns native transfer retirement and the
borrowed frame closure. UI owns registry/persistence, controls, diagnostics,
kept-file and published-version lifecycle. Images owns the single session
broker, source cache, validation, file services and media store. Sky owns its
physical rendering/model. The controller driver/editor remains gamepad-tools.
The factory creates one renderer/scene, broker, source cache, map cache, globe,
viewer and render scheduler; all feature preparation uses that frame authority.

The native canvas, hotspot surface and dedicated `shellContainer` are siblings.
React mounts its shell only in `shellContainer`. The nine feature panels plus
Scenes, About, panorama and panorama-settings keep all thirteen current tab IDs.
Public feature controls include shared map detail, saved image storage and
controller binding editor. Scene document limits use owner parameters. Search
and VR remain deferred; no search provider or extra current tab is supplied.

Report dispatch creates the public read-only UI report and version observer.
It does not allocate a globe, viewer, render scheduler or Dev session, and it
does not register a worker. The report uses the supplied running-build identity
and preserves the earlier visit trail. Settings catalogues supply report values
without constructing their feature runtimes. Checking a published page reports
status; only the explicit shared action reloads. The root keeper follows its
exact namespace and deployment worker and preserves document/network behavior.
Existing older-resource admission must also pass the shared generated-worker
fixtures in the requested compiled integration phase.

On cancellation the shared frame closure stops scheduling, closes any active
frame, attempts all feature cleanup, and waits actual owner drains. Map,
viewer, overview, codec/crop, persistence and native texture work remain joined.
Native codec input copies receive a separate encoded reservation. The native
device and scene outlive the terminal proof. Cleanup errors remain observable.
An absent/failed drain blocks device disposal; a timer, empty promise or forced
worker termination cannot establish native input release.
Engine's declared `NativeMapStartupError.whenSettled` is joined even when globe
construction throws before returning a runtime. The outer catch waits that real
drain alongside the frame closure, including an abort that began closure cleanup
before the exceptional owner was returned. A missing, non-promise or rejected
exceptional drain blocks device disposal and preserves the causal startup error.

The source consumes these declared owner contracts. All new owner source remains
UNQUALIFIED and NOT_BOUND until its checked archive and declarations arrive; the
accepted provider artifacts and canonical locks have not changed:

- `createBrowserGlobeBindings` is imported from the declared public
  `@foss-earth/engine/browser-globe` entry. The public map cache remains at
  `@foss-earth/engine/browser`.
- Engine's factory now declares `SettledGlobeRuntime.whenSettled(): Promise<void>`.
  Campus retains that settled runtime type and joins its actual owner drain with
  the browser map binding's broker/atlas/native drain. The defensive older-artifact
  check refuses a missing method or a method that returns no promise. A failed
  drain blocks device disposal. The qualified owner must prove its Google request,
  model parsing and upload scope; Campus supplies no substitute settlement.
- `createGlobeViewerFrameBinding` receives the real representations registry and
  live `tileMemoryBytes` and `maxTextureSide` getters. The first projects the saved
  `tileMemoryMiB` policy into bytes; the second reads the actual renderer's caps.
  Its shared `describeImage` and `createGlobeViewerProjection` supply Scenes image
  facts and hotspot projection. Campus contains no representation-cost, metadata
  sorting or projection conversion algorithm.
- Deliver exact rebuilt declarations for all new public bindings and their
  retirement methods. The Campus registry/feature projections and tiled detail
  cap need compiled conformance against those declarations.
- Bind a declared Engine imagery worker entry/asset if off-thread imagery is
  required. The source currently uses the supported null-worker path. The root
  service worker is a separate authority and is not imagery-worker evidence.

The declared Scenes `SceneExternalNavigationPorts.navigate` supplies the external
destination identity, named panorama, original link/arrival view, source identity
and cancellation signal. The owned callback registers only `minneapolis` with
`umn-minneapolis` at `/tour/minneapolis/`, and `st-paul` with `umn-st-paul` at
`/tour/st-paul/`. `routeId` is a catalogue ID. It is never interpreted as a URL.
Foreign/self destinations, mismatched link targets and cancelled selection do not
change the route. The callback carries the named panorama and authored arrival
view in `umnVRCampusExternalArrival` browser history state, pushes the fixed route
and requests native reload. A failed reload restores the prior state and address
and returns its causal failure. There is no new query parameter or arbitrary
manifest fetch.

The arriving native host removes only its own history key before validating the
one-use record. Its registered path, catalogue and scene must agree; the shared
history validator checks the finite arrival view. Native entry then awaits the
actual initial scene load, verifies the loaded scene identity and calls the shared
handle's `enter` with the named panorama and cancellation signal. Failure and
cancellation retire the new host; no readiness or navigation result is simulated.

This callback is prepared on `host.bindings.scene.externalNavigation`. The sole
`loadScene` consumer, `src/tour/controller.ts`, is frozen outside this five-file
lease and still drops that port. Full source adoption requires an exact successor
lease for that file to add `CampusSceneBindings.externalNavigation` from
`LoadSceneOptions["externalNavigation"]` and forward it to `loadScene`. Checked
Scenes delivery is also required. The callback and all owner-source recipes
remain NOT_BOUND; no working cross-route runtime is claimed. The original
48/12/60 panoramas, 134 links, 24 groups, authored order and credits are unchanged.

The next requested checks are sequential type/lint/unit/source-package checks,
followed by separately granted compiled consumer/runtime fixtures over exact
qualified provider artifacts. Required fixtures include one-device/one-render
authority, abort inside preparation, late native decode/upload and failed
cleanup, scene replacement/frozen placement, all thirteen tabs, report-only
allocation exclusion, root scope/older resources and explicit reload, and the
four route assemblies. Real WebGPU/WebGL and accessible-media evidence remain
unperformed. Future accessibility and media work is not claimed complete.

Rollback keeps the existing qualified pins and prior native entry available.
Do not delete `.local`, retained worker resources, the original archive or the
private YouVisit backup. Parent acceptance must record all five file hashes and
modes and freeze the exact source before requesting compiled checks. No child
manifest, lock, Earth checkout, attribution policy, community document, media
or remote setting was changed by this batch.

YOU CANNOT HAVE AI AS A CO-AUTHOR, OR YOUR CONTRIBUTIONS WILL BE REJECTED.
