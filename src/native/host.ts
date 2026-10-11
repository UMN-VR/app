import { copyCampusCodecInput, estimateCampusImage, subscribeCampusResourceSettings } from "./adapters";
import type { AppIdentity, BuiltFrom, ReleaseManifest } from "@foss-earth/about";
import type { SettingsRegistry, SettingsStorage } from "@foss-earth/ui/settings";
import type { CampusNativeHostFactory, CampusNativeHost, CampusExternalArrival, CampusRoute } from "../native-entry";
import type { GlobeRuntime, SettledGlobeRuntime } from "@foss-earth/engine/babylon";
import type { SceneExternalNavigationPorts, isSceneHistoryEntry } from "@foss-earth/scenes/browser";
import { CAMPUS_NATIVE_PARAMETERS, CAMPUS_DEPLOYMENT_PARAMETERS, createCampusResourcePolicy,
  createCampusTerrainPreparationPolicy, type CampusOverviewPreparationPolicy } from "./policy";

export interface CampusNativeHostOptions {
  about: { release: ReleaseManifest; builtFrom: BuiltFrom | null; identity: AppIdentity };
  deployment: {
    publishedVersionUrl: string;
    workerUrl: "/foss-earth-sw.js";
    workerScope: "/";
    retainedResourceUrls: readonly string[];
    cacheNamespace: string;
    messageIdentity?: string;
  };
  overviewPreparation?: CampusOverviewPreparationPolicy;
  /** Programmatic consumers only; Vite JSON contains no callback. */
  onError?(error: unknown): void;
}

export const CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY = "umnVRCampusExternalArrival";
const CAMPUS_EXTERNAL_ROUTES = [
  { id: "minneapolis", sceneId: "umn-minneapolis", path: "/tour/minneapolis/" },
  { id: "st-paul", sceneId: "umn-st-paul", path: "/tour/st-paul/" },
] as const;
export interface CampusExternalBrowserPorts {
  history: Pick<History, "state" | "pushState" | "replaceState">;
  location: Pick<Location, "href" | "pathname" | "reload">;
}

/** Campus selects its registered route; Scenes supplies the named panorama. */
export function createCampusExternalNavigation(target: CampusExternalBrowserPorts): SceneExternalNavigationPorts {
  return { async navigate(input) {
    if (input.signal.aborted) return { ok: false, reason: "cancelled", message: "Campus route selection was cancelled." };
    const route = CAMPUS_EXTERNAL_ROUTES.find(entry => input.destination.id === entry.id
      && input.destination.sceneId === entry.sceneId
      && (input.destination.routeId === undefined || input.destination.routeId === entry.id));
    if (!route || !CAMPUS_EXTERNAL_ROUTES.some(entry => entry.sceneId === input.source.sceneId)
      || input.source.sceneId === route.sceneId || !input.panoramaId
      || input.link.target !== input.panoramaId || input.link.externalDestination !== input.destination.id)
      return { ok: false, reason: "unavailable", message: "The external Campus destination is not a registered scene and panorama selection." };
    const beforeState: unknown = target.history.state, beforeUrl = target.location.href;
    try {
      target.history.pushState({ [CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY]: {
        version: 1, routeId: route.id, sceneId: route.sceneId, panoramaId: input.panoramaId,
        view: input.link.arrivalView ? { ...input.link.arrivalView } : null, source: { ...input.source },
      } }, "", route.path);
      target.location.reload();
      return { ok: true };
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      try { target.history.replaceState(beforeState, "", beforeUrl); }
      catch (rollback) { message += `; restoring the source route failed: ${rollback instanceof Error ? rollback.message : String(rollback)}`; }
      return { ok: false, reason: "failed", message: `Campus route selection failed: ${message}` };
    }
  } };
}

/** Consume only this owner's key. Shared validation owns the finite arrival view. */
export function consumeCampusExternalArrival(target: CampusExternalBrowserPorts, route: CampusRoute,
  validateHistory: typeof isSceneHistoryEntry): CampusExternalArrival | undefined {
  const state: unknown = target.history.state;
  if (!state || typeof state !== "object" || Array.isArray(state)
    || !Object.hasOwn(state, CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY)) return undefined;
  const retained = { ...state } as Record<string, unknown>;
  const value = retained[CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY];
  delete retained[CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY];
  target.history.replaceState(retained, "");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The one-use Campus arrival is not an owned arrival record.");
  const arrival = value as Record<string, unknown>;
  const registration = CAMPUS_EXTERNAL_ROUTES.find(entry => entry.id === arrival.routeId && entry.sceneId === arrival.sceneId);
  const source = arrival.source;
  if (arrival.version !== 1 || !registration || registration.path !== target.location.pathname
    || route.initialSceneId !== registration.id || !route.examples.some(example => example.id === registration.id)
    || !source || typeof source !== "object" || Array.isArray(source)
    || !validateHistory({ v: 1, session: "umn-vr.external-arrival", sceneId: arrival.sceneId,
      revision: (source as Record<string, unknown>).revision, destination: arrival.panoramaId, view: arrival.view }))
    throw new Error("The one-use Campus arrival does not match its registered route, scene, panorama or view.");
  return { sceneId: registration.sceneId, panoramaId: arrival.panoramaId as string,
    view: arrival.view as CampusExternalArrival["view"] };
}

/** Required map-owner retirement contract. Never substitute an empty promise. */
export function requireGlobeSettlement(runtime: GlobeRuntime): () => Promise<void> {
  const owner: GlobeRuntime & Partial<Pick<SettledGlobeRuntime, "whenSettled">> = runtime;
  if (typeof owner.whenSettled !== "function") throw new Error(
    "Engine delivery is missing SettledGlobeRuntime.whenSettled(): Promise<void>; the accepted older artifact cannot prove Google/download/model parsing retirement.");
  return () => {
    const work = owner.whenSettled!.call(runtime);
    if (!work || typeof work.then !== "function") throw new TypeError(
      "Engine SettledGlobeRuntime.whenSettled() did not return its native retirement promise.");
    return work;
  };
}

function browser(container: HTMLElement) {
  const document = container.ownerDocument, view = document.defaultView as (Window & typeof globalThis) | null;
  if (!view) throw new Error("Campus requires the container's browser Window.");
  let storage: SettingsStorage | null = null;
  try { storage = view.localStorage; } catch { /* Public registry preserves usable in-memory settings. */ }
  return { document, view, storage };
}

async function settingsFor(view: Window & typeof globalThis, storage: SettingsStorage | null, search: string) {
  const [ui, browserUi, engine, renderer, viewer, images, tiled, sheets, sky, toolbar, scenes] = await Promise.all([
    import("@foss-earth/ui/settings"), import("@foss-earth/ui/browser"), import("@foss-earth/engine/settings"),
    import("@foss-earth/renderer/settings"), import("@foss-earth/360/settings"), import("@foss-earth/images/settings"),
    import("@foss-earth/tiled-cubemap/settings"), import("@foss-earth/preview-sheets/settings"),
    import("@foss-earth/sky/settings"), import("@foss-earth/toolbar"), import("@foss-earth/scenes"),
  ]);
  const settings = ui.createSettingsRegistry({ storage, searchParams: new view.URLSearchParams(search),
    deviceContext: browserUi.readDeviceContext({ navigator: view.navigator, window: view }),
    sourceBase: "https://github.com/UMN-VR/app/blob/main/" });
  settings.register([...ui.UI_PARAMETERS, ...engine.CONTROLS_PARAMETERS, ...engine.MAP_SOURCE_PARAMETERS,
    ...engine.MAP_DETAIL_PARAMETERS, ...engine.MAP_LOADING_PARAMETERS, ...engine.MAP_SELECTION_PARAMETERS,
    ...engine.MAP_TERRAIN_SELECTION_PARAMETERS, ...engine.MAP_AUTO_PARAMETERS, ...engine.GLOBE_RUNTIME_PARAMETERS,
    ...engine.TERRAIN_IMAGE_DECODE_PARAMETERS, ...engine.MAP_CACHE_PRESENTATION_PARAMETERS, ...engine.POSITION_GEOID_PARAMETERS,
    ...renderer.RENDERER_PARAMETERS, ...renderer.RENDERER_OWNED_EXPERIMENT_PARAMETERS,
    ...renderer.frameProfilingParameters({ tab: "renderer", section: "performance" }),
    ...viewer.VIEWER_PARAMETERS, ...images.createImageResourceParameters({ keptGpuDefault: tiled.keptGpuDefault }),
    ...tiled.TILED_CUBEMAP_PARAMETERS, ...sheets.PREVIEW_SHEETS_PARAMETERS, ...sky.SKY_PARAMETERS,
    ...toolbar.POSITION_PARAMETERS, ...toolbar.MAP_SOURCE_HUD_LAYOUT_PARAMETERS,
    ...scenes.SCENE_DOCUMENT_PARAMETERS, ...CAMPUS_NATIVE_PARAMETERS, ...CAMPUS_DEPLOYMENT_PARAMETERS]);
  for (const [tab, section, title] of [...viewer.VIEWER_SECTION_TITLES, ...images.IMAGE_RESOURCE_SECTION_TITLES, ...sky.SKY_SECTION_TITLES, ...scenes.SCENE_SECTION_TITLES])
    settings.setSectionTitle(tab, section, title);
  settings.migrateLegacy([...engine.createEngineMigrations(storage), ui.THEME_LEGACY_MIGRATION]);
  return settings;
}

/** Host supplies deployment/DOM/native adapters; UI owns cadence and status. */
async function publication(options: CampusNativeHostOptions, container: HTMLElement, settings: SettingsRegistry, signal: AbortSignal) {
  const { document, view } = browser(container);
  const [ui, diagnostics] = await Promise.all([import("@foss-earth/ui/browser"), import("@foss-earth/ui/diagnostics")]);
  const target = new view.URL(options.deployment.publishedVersionUrl, view.location.href);
  const watcher = ui.createPublishedVersionWatcher({ signal, onError: options.onError,
    policy: { enabled: () => settings.get("app.checkPublished") === true,
      intervalMs: () => settings.get<number>("app.checkPublishedEvery") * 60000,
      watchEnabled: listener => settings.watch("app.checkPublished", listener),
      watchInterval: listener => settings.watch("app.checkPublishedEvery", listener) },
    environment: { build: options.about.identity.build || null,
      readPage: async requestSignal => { const response = await view.fetch(target, { signal: requestSignal, cache: "no-store" });
        if (!response.ok) throw new Error(`Published page answered ${response.status}.`); return response.text(); },
      // The Campus page's declared build stamp. Native parsing is a host transport adapter.
      parseStamp: html => new view.DOMParser().parseFromString(html, "text/html").querySelector('meta[name="foss-earth-build"]')?.getAttribute("content") ?? null,
      compareStamps: (mine, other) => { const a = view.Date.parse(mine), b = view.Date.parse(other);
        if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Published build stamp is not a finite date.");
        return a === b ? "same" : b > a ? "newer" : "older"; },
      createAbortController: () => new view.AbortController(), now: view.Date.now,
      setTimer: (work, ms) => view.setTimeout(work, ms), clearTimer: timer => view.clearTimeout(timer as number),
      shown: () => !document.hidden,
      onReturn: listener => { const changed = () => { if (!document.hidden) listener(); };
        document.addEventListener("visibilitychange", changed); view.addEventListener("pageshow", changed);
        return () => { document.removeEventListener("visibilitychange", changed); view.removeEventListener("pageshow", changed); }; },
      reload: () => view.location.reload(),
    } });
  return { ...watcher, describe: () => diagnostics.describePublishedVersion(watcher.state(), watcher.now()),
    shown: () => { void watcher.ask().catch(error => options.onError?.(error)); } };
}

/** No feature runtime is imported or constructed until prepare is called. */
export function createCampusNativeHostFactory(options: CampusNativeHostOptions): CampusNativeHostFactory {
  if (options.deployment.workerUrl !== "/foss-earth-sw.js" || options.deployment.workerScope !== "/")
    throw new Error("Campus retains the root service worker URL and scope.");
  if (!options.deployment.cacheNamespace.trim()) throw new Error("Campus requires the exact generated-worker cache namespace.");
  return {
    async report({ container, signal, search }) {
      const { view, storage } = browser(container);
      signal.throwIfAborted();
      const settings = await settingsFor(view, storage, search);
      signal.throwIfAborted();
      const published = await publication(options, container, settings, signal);
      try {
        const { createCampusReport } = await import("./report");
        signal.throwIfAborted();
        return createCampusReport({ container, signal, settings, identity: options.about.identity, published });
      } catch (error) { published.dispose(); await published.whenSettled(); throw error; }
    },
    async prepare({ container, signal, route }) {
      const { document, view, storage } = browser(container);
      signal.throwIfAborted();
      const [rendererApi, rendererNative, engineApi, engineNative, engineBrowser, engineBrowserGlobe, engineSettings, viewerApi,
        viewerNative, viewerRuntime, viewerResources, viewerGlobe, viewerInputApi, images, imageBrowser,
        sheetsApi, skyApi, skyNative, toolbar, ui, diagnosticsApi, panelsApi, gamepad, gamepadCore, gamepadUi,
        engineGamepad, enginePanels, sceneBrowser] = await Promise.all([
        import("@foss-earth/renderer"), import("@foss-earth/renderer/babylon"), import("@foss-earth/engine"),
        import("@foss-earth/engine/babylon"), import("@foss-earth/engine/browser"), import("@foss-earth/engine/browser-globe"), import("@foss-earth/engine/settings"),
        import("@foss-earth/360"), import("@foss-earth/360/babylon"), import("@foss-earth/360/viewer"),
        import("@foss-earth/360/resources"), import("@foss-earth/360/globe"), import("@foss-earth/360/globe-browser"),
        import("@foss-earth/images"), import("@foss-earth/images/browser"), import("@foss-earth/preview-sheets/browser"),
        import("@foss-earth/sky"), import("@foss-earth/sky/babylon"), import("@foss-earth/toolbar/browser"),
        import("@foss-earth/ui/browser"), import("@foss-earth/ui/diagnostics"), import("./panels"),
        import("@felipegalind0/gamepad-tools/browser"), import("@felipegalind0/gamepad-tools/core"), import("@felipegalind0/gamepad-tools/ui"),
        import("@foss-earth/engine/gamepad"), import("@foss-earth/engine/panels"), import("@foss-earth/scenes/browser"),
      ]);
      signal.throwIfAborted();
      const googleProviders = await engineBrowserGlobe.loadBrowserGlobeGoogleProviders();
      signal.throwIfAborted();
      const externalArrival = consumeCampusExternalArrival(view, route, sceneBrowser.isSceneHistoryEntry);
      const settings = await settingsFor(view, storage, view.location.search);
      signal.throwIfAborted();
      const policy = createCampusResourcePolicy(settings, view);
      const clock = { nowMs: () => view.performance.now(), after(work: () => void, ms: number) {
        const timer = view.setTimeout(work, ms); return () => view.clearTimeout(timer); } };
      const timers = { setTimeout: (work: () => void, ms: number) => view.setTimeout(work, ms), clearTimeout: (timer: unknown) => view.clearTimeout(timer as number) };
      const skyTimers = { set: timers.setTimeout, clear: (timer: number) => timers.clearTimeout(timer) };
      const root = document.createElement("div"); root.className = "campus-native-host";
      root.style.cssText = "position:fixed;inset:0;width:100%;height:100%;";
      const canvas = document.createElement("canvas"); canvas.tabIndex = 0; canvas.setAttribute("aria-label", "Campus map and 360 photographs");
      canvas.style.cssText = "display:block;width:100%;height:100%;";
      const hotspots = document.createElement("div"), shellContainer = document.createElement("div"), hudContainer = document.createElement("div"), mapHudContainer = document.createElement("div");
      hotspots.className = "campus-scene-hotspots"; shellContainer.className = "campus-shell"; hudContainer.className = "campus-toolbar";
      const logElement = document.createElement("div"); root.append(canvas, hotspots, hudContainer, mapHudContainer, logElement, shellContainer); container.append(root);
      let retired = false, deviceDisposed = false, settlementProven = false;
      const cleanups: (() => void)[] = [], drains: (() => Promise<void>)[] = [];
      const frames = new Set<() => void>();
      const framePort = { subscribe(listener: () => void) { frames.add(listener); return () => { frames.delete(listener); }; } };
      const logListeners = new Set<(change: { width: number | null; resized: boolean }) => void>(); let logWidth: number | null = null;
      const log = ui.createGameLog(settings, ui.browserGameLogPorts(logElement, view, {
        onSize: change => { logWidth = change.width; for (const listener of [...logListeners]) listener(change); },
        isCentered: () => document.documentElement.dataset.dockLayout === "centered",
      }));
      const onError = (error: unknown): void => { log.print({ text: error instanceof Error ? error.message : String(error), tone: "error" }); options.onError?.(error); };
      cleanups.push(() => log.destroy());
      const authorities = { runtimes: 0, viewers: 0, schedulers: 0, brokers: 0, uploaders: 0 };
      const broker = images.createImageSessionBroker(policy.session()); authorities.brokers += 1;
      let runtime: SettledGlobeRuntime | undefined;
      let scheduler: ReturnType<typeof rendererApi.createRenderScheduler> | undefined;
      let lifecycle: ReturnType<typeof rendererNative.createBabylonRendererLifecycle> | undefined;
      let native: ReturnType<typeof rendererNative.createNativeImageResources> | undefined;
      let overview: ReturnType<typeof engineApi.createGlobeOverviewBinding> | undefined;
      let viewerFrame: ReturnType<typeof viewerGlobe.createGlobeViewerFrameBinding> | undefined;
      let bootstrap: Awaited<ReturnType<typeof rendererNative.bootstrapGlobeRenderer>> | undefined;
      let actualGlobeSettlement: (() => Promise<void>) | undefined;
      const closure = rendererApi.createBorrowedFrameClosure({ signal,
        presentation: () => lifecycle,
        prepareFrame: now => { runtime?.prepareFrame(now); },
        afterFrame: (now, rendered) => { runtime?.afterFrame(now, rendered); overview?.observeFrame(); for (const listener of [...frames]) listener(); },
        shouldKeepRendering: () => runtime?.shouldKeepRendering() === true,
        minFrameIntervalMs: () => runtime?.minFrameIntervalMs() ?? 0,
        stopScheduler: () => scheduler?.stop(), onFrameError: onError,
        resourceWork: { prepare: () => native?.resourceWork.prepare() },
        cleanup: [() => { retired = true; scheduler?.stop(); }, () => rendererApi.attemptNativeCleanup(cleanups.reverse(), "Campus native bindings cleanup failed.")],
        whenOwnersSettled: [async () => {
          // The scene/session owner has cancelled before the primary awaits this drain.
          const results = await Promise.allSettled(drains.map(settle => settle()));
          const errors = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
          if (runtime && !actualGlobeSettlement) errors.push(new Error("Engine GlobeRuntime retirement contract is missing; device disposal remains blocked."));
          // Parsers, decoders and uploaders must retire before the live device's
          // final marker, including native commands submitted directly by Babylon.
          if (bootstrap) {
            try {
              await rendererNative.whenBorrowedDeviceSettled({ scene: bootstrap.scene,
                observeDeviceLoss(listener) {
                  const engine = bootstrap!.renderer.engine;
                  const observer = engine.onContextLostObservable.add(listener);
                  return () => { engine.onContextLostObservable.remove(observer); };
                }, onError });
            } catch (error) { errors.push(error); }
          }
          if (errors.length) throw new AggregateError(errors, "Campus native owner drain failed.");
          settlementProven = true;
        }],
      });
      scheduler = rendererApi.createRenderScheduler(closure.schedulerOptions({ requestFrame: callback => view.requestAnimationFrame(callback), cancelFrame: handle => view.cancelAnimationFrame(handle) }));
      authorities.schedulers += 1;
      const destroyDevice = (): void => {
        if (deviceDisposed) return;
        if (!settlementProven) throw new Error("Campus device disposal requires the actual frame/native/map retirement proof.");
        deviceDisposed = true;
        rendererApi.attemptNativeCleanup([() => bootstrap?.scene.dispose(), () => bootstrap?.renderer.engine.dispose(), () => broker.dispose(), () => root.remove()], "Campus device cleanup failed.");
      };
      try {
        bootstrap = await rendererNative.bootstrapGlobeRenderer(canvas, { host: rendererNative.createBrowserRendererHost({ window: view, document }),
          force: settings.get("renderer.backend") === "auto" ? null : settings.get("renderer.backend") as "webgpu" | "webgl2" | "webgl", antialias: settings.get<boolean>("renderer.antialias") });
        signal.throwIfAborted();
        const { renderer, scene } = bootstrap;
        const profile = rendererNative.createFrameProfileSession({ scene, engine: renderer.engine, now: clock.nowMs });
        cleanups.push(() => profile.dispose());
        cleanups.push(rendererNative.bindFrameProfileSettings(settings, profile));
        lifecycle = rendererNative.createBabylonRendererLifecycle({ renderer, scene, scheduler, settings,
          platform: rendererNative.createBrowserRendererPlatform({ window: view, document }),
          isPreparingFrame: () => closure.inFrame, presentationLayer: engineNative.NAVIGATION_PRESENTATION_LAYER,
          timers, readinessPolicy: rendererApi.defaultReadinessPolicy });
        cleanups.push(() => lifecycle?.dispose());
        const createCanvas = (width: number, height: number) => { const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface; };
        native = rendererNative.createNativeImageResources({ broker, scene, limits: policy.upload, createCanvas,
          wakeWork: () => scheduler?.requestWork(), after: clock.after, observeDeviceLoss: listener => lifecycle!.onDeviceLost(listener),
          invalidatePublishedSource: onError, onRetirementError: onError, signal });
        authorities.uploaders += 1;
        cleanups.push(() => native?.retire()); drains.push(() => native!.whenSettled());
        const nativeOperations = new Set<Promise<unknown>>();
        const track = <T>(work: Promise<T>): Promise<T> => { nativeOperations.add(work); void work.then(() => nativeOperations.delete(work), () => nativeOperations.delete(work)); return work; };
        drains.push(async () => { while (nativeOperations.size) await Promise.allSettled([...nativeOperations]); });
        const decode = (bytes: Uint8Array, mimeType: "image/jpeg" | "image/png"): Promise<ImageBitmap> => {
          const grant = broker.pools.reserve("encoded", 2 * bytes.byteLength, "Campus ArrayBuffer and Blob native codec input copies");
          if (!grant.ok) return Promise.reject(new Error("No encoded headroom for the native codec's input copy."));
          let work: Promise<ImageBitmap>;
          try { work = view.createImageBitmap(new view.Blob([copyCampusCodecInput(bytes)], { type: mimeType }), { colorSpaceConversion: "none", premultiplyAlpha: "none", imageOrientation: "from-image" }); }
          catch (error) { grant.reservation.release(); throw error; }
          return track(work.finally(() => grant.reservation.release()));
        };
        const mapCache = engineBrowser.createMapCache({ storage: () => view.caches, fetcher: view.fetch.bind(view), now: view.Date.now,
          Response: view.Response, Request: view.Request, Headers: view.Headers });
        const lighting = engineNative.createTerrainLightingAdapter({ GROUND_LIGHT_TABLE: skyApi.GROUND_LIGHT_TABLE,
          GROUND_LIGHT_SAMPLES: skyApi.GROUND_LIGHT_SAMPLES, GROUND_LIGHT_LEAST_SINE: skyApi.GROUND_LIGHT_LEAST_SINE,
          MERCATOR_MAX_LAT_DEG: skyApi.MERCATOR_MAX_LAT_DEG, NIGHT_RADIANCE_UNITS: skyApi.NIGHT_RADIANCE_UNITS, groundLightAt: skyApi.groundLightAt });
        const map = engineBrowserGlobe.createBrowserGlobeBindings({ realm: { window: view, document, ...{
          AbortController: view.AbortController, AbortSignal: view.AbortSignal, DOMException: view.DOMException, Blob: view.Blob, URL: view.URL,
          Response: view.Response, TransformStream: view.TransformStream, Node: view.Node, Element: view.Element, HTMLInputElement: view.HTMLInputElement,
          WheelEvent: view.WheelEvent, Event: view.Event, performance: view.performance } },
          renderer, scene, settings, clock, timers, googleProviders, readinessPolicy: rendererApi.defaultReadinessPolicy, broker, cache: mapCache, native, lighting,
          imageTransferLimits: policy.transfer, terrainLoaderLimits: () => ({ maxConcurrent: settings.get<number>("map.loader.requests"),
            cacheEntries: settings.get<number>("map.loader.cacheEntries"), timeoutMs: settings.get<number>("map.loader.timeout") }),
          describeMapTransfer: () => ({ declaredBytes: 0 }),
          mapPriority: () => 0, createWorker: () => null, createCanvas, decode, onError, log: view.console, signal });
        cleanups.push(() => map.retire()); drains.push(() => map.whenSettled());
        let sky: ReturnType<typeof skyNative.createSkyRuntime> | undefined;
        runtime = engineNative.createGlobeRuntime(canvas, { renderer, scene, scheduler, frameProfile: profile, lifecycle, settings, clock,
          platform: map.platform, mapPorts: map.mapPorts,
          sky: { attach: context => { sky = skyNative.createSkyRuntime({ ...context, scene, settings, ecefToGeodetic: engineApi.ecefToGeodetic,
            terrain: map.skyTerrain, nightTilePorts: { ...map.nightTilePorts, retryDelayMs: engineApi.retryDelayMs },
            now: view.Date.now, clock: clock.nowMs, timers: skyTimers, isHidden: () => document.hidden });
            const detach = skyNative.bindSkyReadingsAndNotes({ settings, sky }); return { runtime: sky, detach }; } },
          framePreparation: { prepare: frame => viewerFrame?.framePreparation.prepare(frame) },
          terrainPreparation: createCampusTerrainPreparationPolicy(settings, options.overviewPreparation),
          budgets: engineSettings.createGlobeRuntimeBudgets(settings), ...engineSettings.resolveMapRuntimeConfig({ settings, searchParams: new view.URLSearchParams(view.location.search) }),
          log: view.console });
        authorities.runtimes += 1;
        cleanups.push(() => sky?.dispose(), () => runtime?.destroy());
        // The owner now declares the true terminal drain. Accepted older artifacts
        // remain frozen and must pass the defensive runtime contract check.
        actualGlobeSettlement = requireGlobeSettlement(runtime); drains.push(actualGlobeSettlement);
        const live = runtime;
        const store = imageBrowser.createMediaStore({ open: () => imageBrowser.openIndexedDbBackend(view.indexedDB), now: view.Date.now,
          maxBytes: policy.n("savedMiB") * 1024 * 1024 });
        drains.push(() => store.settled());
        const cache = images.createImageSourceCache<import("@foss-earth/360/resources").ComposedImageSource>({ broker,
          keptGpuBytes: policy.n("keptGpuMiB") * 1024 * 1024, gpuBytes: source => source.gpuBytes });
        cleanups.push(() => cache.dispose());
        const files = (group?: import("@foss-earth/images").MediaGroup) => imageBrowser.createImageFileService({ broker,
          limits: policy.transfer, priority: () => 0, fetch: view.fetch.bind(view), decode,
          cache: group ? { files: store.files(group), settled: () => store.settled() } : null });
        const commonFiles = files();
        const sheetFiles = new WeakMap<import("@foss-earth/images/browser").EncodedImageFile, ReturnType<typeof files>>();
        const sheets = sheetsApi.createPreviewSheetSources({ broker,
          obtain: async (file, bytes, scope) => { const service = files(file.mediaGroup), body = await service.obtain(file, bytes, scope); sheetFiles.set(body, service); return body; },
          decode: (body, file, scope) => (sheetFiles.get(body) ?? commonFiles).decode(body, file, scope),
          crop: (image, x, y, width, height) => track(view.createImageBitmap(image, x, y, width, height, { colorSpaceConversion: "none", premultiplyAlpha: "none" })) });
        cleanups.push(() => sheets.dispose());
        const representations = viewerApi.createBuiltInRepresentations(() => ({ tileMemoryBytes: policy.n("tileMemoryMiB") * 1024 * 1024,
          responseBytes: policy.transfer().responseBytes, requests: policy.count("tileRequests"), waiting: policy.count("tilesWaiting"),
          uploadOutstandingBytes: policy.upload().outstandingBytes }));
        const estimate = (record: import("@foss-earth/images").ImageRepresentation) =>
          estimateCampusImage(record, representations, renderer.engine.getCaps().maxTextureSize, view.location.href);
        let viewer: ReturnType<typeof viewerRuntime.createImageViewer> | undefined;
        const choice = viewerApi.createViewerSelection({ representations, parameters: policy.selection,
          maxTextureSide: () => renderer.engine.getCaps().maxTextureSize,
          viewportHeightDevicePx: () => renderer.engine.getRenderHeight(),
          current: input => viewer?.currentSources(input.id) ?? { preview: null, shown: null },
          admissible: (record, overlap) => { const cost = estimate(record); cache.evictUnused(cost.sourceGpu, overlap);
            return broker.pools.fits("sourceGpu", cost.sourceGpu, { overlap }) && broker.pools.fits("decoded", cost.decoded) ? null : "Current image resource budget"; },
          imageName: record => record.id });
        const resources = viewerResources.createViewerResources({ broker, cache, files: commonFiles,
          filesFor: (input, representation) => files(images.mediaGroup(input.asset, representation)), uploader: native.uploader,
          atlasDevice: native.regionDevice, sheets, previewSheetsEnabled: () => settings.get("scene.panorama.previewSheets") === true,
          maxTextureSide: () => renderer.engine.getCaps().maxTextureSize,
          whenReady: (texture, requestSignal) => new Promise<void>((resolve, reject) => {
            let stop = () => {}; const abort = () => { stop(); reject(requestSignal.reason); };
            requestSignal.addEventListener("abort", abort, { once: true });
            stop = rendererApi.checkUntilSettled(1, () => texture.isReady() ? 0 : 1,
              () => { requestSignal.removeEventListener("abort", abort); resolve(); }, timers, rendererApi.defaultReadinessPolicy);
            if (requestSignal.aborted) abort(); }),
          estimate, choice, tiles: { memoryBytes: () => policy.n("tileMemoryMiB") * 1024 * 1024, limits: policy.tiles,
            selection: record => ({ texelsPerPixel: policy.selection().immersionDensity ?? 1, marginDeg: policy.n("tileMarginDeg"),
              levelCap: Math.max(0, Math.min(record.levelBytes.length - 1, Math.floor(Math.log2(policy.detailWidth() / 4 / record.tileSize)))) }),
            outlines: () => settings.get("scene.panorama.tileOutlines") === true },
          devicePixelsPerCss: () => renderer.engine.getRenderHeight() / Math.max(1, canvas.clientHeight), requestRender: () => live.requestRender() });
        cleanups.push(() => resources.retire()); drains.push(() => resources.whenSettled());
        const panorama = viewerNative.createPanoramaRenderer(scene, { getCamera: () => scene.activeCamera,
          viewportHeightCssPx: () => canvas.clientHeight, presentationLayerMask: engineNative.NAVIGATION_PRESENTATION_LAYER,
          appearance: policy.viewer().appearance, getPresentationView: () => live.getPresentationView(), requestRender: () => live.requestRender(), onError });
        cleanups.push(() => panorama.dispose());
        const navigation = viewerGlobe.createGlobeViewerNavigation(live, { owner: "umn-vr.campus",
          returnFocus: element => { if (element instanceof view.HTMLElement) element.focus(); },
          isAbortSignal: (value): value is AbortSignal => value instanceof view.AbortSignal });
        const input = viewerInputApi.createGlobeViewerInput(live, canvas, navigation.engineLeaseFor, { nowMs: clock.nowMs,
          controlTakesKey: gamepad.controlTakesKey, abortReason: () => new view.DOMException("Campus navigation interrupted", "AbortError"), signal });
        cleanups.push(() => input.dispose());
        viewer = viewerRuntime.createImageViewer({ renderer: panorama, resources, world: viewerGlobe.globeViewerMath, poses: viewerGlobe.globeViewerPoses,
          navigation: navigation.navigation, input: input.input, settings: policy.viewer, now: clock.nowMs,
          devicePixelsPerCss: () => renderer.engine.getRenderHeight() / Math.max(1, canvas.clientHeight), createAbortController: () => new view.AbortController(),
          requestRender: () => live.requestRender(), holdRendering: () => { live.beginContinuous(); let held = true;
            return () => { if (held) { held = false; live.endContinuous(); } }; },
          isOccluded: (eye, direction, distance) => {
            const hit = live.surface.raycast(engineApi.ecef(eye), engineApi.ecef(direction), distance);
            return hit !== null && hit.distanceMeters < distance;
          },
          signal, onRetirementError: onError, failure: (_input, _kind, error) => onError(error) });
        authorities.viewers += 1;
        cleanups.push(() => viewer?.dispose()); drains.push(() => viewer!.whenSettled());
        viewerFrame = viewerGlobe.createGlobeViewerFrameBinding({ viewer, isCurrent: () => !retired,
          requestRender: () => live.requestRender(), frames: framePort,
          description: { representations,
            tileMemoryBytes: () => policy.n("tileMemoryMiB") * 1024 * 1024,
            maxTextureSide: () => renderer.engine.getCaps().maxTextureSize } });
        overview = engineApi.createGlobeOverviewBinding({ runtime: live, isOverview: () => !viewer!.status().active,
          minimumPreparationRadiusMeters: () => options.overviewPreparation?.minimumRadiusMeters ?? settings.get<number>("scene.overview.minimumPreparationRadius"),
          configuredFovDegrees: () => settings.get<number>("camera.fieldOfView"), createAbortController: () => new view.AbortController(),
          combineSignals: signals => view.AbortSignal.any([...signals]), abortReason: () => new view.DOMException("Campus overview interrupted", "AbortError"), signal });
        cleanups.push(() => overview?.dispose()); drains.push(() => overview!.whenSettled());
        const freshInput = (event: Event) => {
          if (event.type !== "wheel" || input.wheels.begins()) overview!.cancel();
        };
        canvas.addEventListener("pointerdown", freshInput); canvas.addEventListener("wheel", freshInput, { passive: true });
        cleanups.push(() => canvas.removeEventListener("pointerdown", freshInput), () => canvas.removeEventListener("wheel", freshInput));
        const published = await publication(options, container, settings, signal);
        cleanups.push(() => published.dispose()); drains.push(() => published.whenSettled());
        signal.throwIfAborted();
        const appFiles = ui.createKeptFilesClient({ signal, onError, cacheNamespace: options.deployment.cacheNamespace, messageIdentity: options.deployment.messageIdentity,
          policy: { enabled: () => settings.get("app.keepFiles") === true, subscribe: listener => settings.watch("app.keepFiles", listener) },
          environment: { worker: { url: new view.URL(options.deployment.workerUrl, view.location.href).href }, scope: options.deployment.workerScope,
            container: view.navigator.serviceWorker ?? null, caches: view.caches ?? null,
            observeLoaded: listener => { listener([...options.deployment.retainedResourceUrls]);
              if (typeof view.PerformanceObserver !== "function") return () => {};
              const observer = new view.PerformanceObserver(entries => listener(entries.getEntries().map(entry => entry.name)));
              observer.observe({ type: "resource", buffered: true }); return () => observer.disconnect(); },
            onControllerChange: listener => { view.navigator.serviceWorker?.addEventListener("controllerchange", listener);
              return () => view.navigator.serviceWorker?.removeEventListener("controllerchange", listener); },
            afterLoad: work => { if (document.readyState === "complete") { work(); return; }
              view.addEventListener("load", work, { once: true }); return () => view.removeEventListener("load", work); } } });
        cleanups.push(() => appFiles.dispose()); drains.push(() => appFiles.whenSettled());
        const diagnostics = diagnosticsApi.createDiagnostics({ settings, log, trailEnvironment: ui.browserTrailEnvironment(),
          parts: () => ({ at: new view.Date(), appName: document.title || "UMN-VR Campus Tour", page: diagnosticsApi.reportPage(view.location.href),
            ...options.about.identity, userAgent: view.navigator.userAgent, screen: { width: view.innerWidth, height: view.innerHeight,
              devicePixelRatio: view.devicePixelRatio, touch: settings.getDeviceContext().touch },
            device: { cores: settings.getDeviceContext().hardwareConcurrency, memoryGiB: settings.getDeviceContext().deviceMemoryGiB },
            environment: ui.readBrowserReportDetails(), renderer: { asked: renderer.requested, mode: renderer.mode,
              driver: null, maxTextureSize: renderer.engine.getCaps().maxTextureSize, fallbackReason: renderer.fallbackReason ?? null, lost: lifecycle!.getDeviceGeneration() },
            state: [published.describe(), `Campus map: ${live.status.mode}; image resources: ${JSON.stringify(cache.stats())}`] }), page: view, console: view.console });
        cleanups.push(() => diagnostics.destroy()); diagnostics.attachRuntime({ describe: () => `Campus ${live.status.mode}; ${renderer.mode}`,
          onDeviceLost: listener => lifecycle!.onDeviceLost(listener), onDeviceRestored: listener => lifecycle!.onDeviceRestored(listener) });
        const hud = toolbar.createHudBar(hudContainer, { document, items: ["location", "controls", "interface", "settings", "map", "renderer", "sky", "time", "scenes", "about", "bug-report", "panorama", "panorama-settings"].map(id => ({
          kind: "button" as const, id: `campus-${id}`, title: id, ariaLabel: `Open ${id}`, appearance: "chip" as const, text: id })) });
        cleanups.push(() => hud.destroy());
        const launchers = Object.fromEntries(["location", "controls", "interface", "settings", "map", "renderer", "sky", "time", "scenes", "about", "bug-report", "panorama", "panorama-settings"].map(id => [id, hud.getElement<HTMLButtonElement>(`campus-${id}`)!]));
        for (const [id, launcher] of Object.entries(launchers)) launcher.dataset.campusTab = id;
        const controllerRoot = document.createElement("div");
        const panels = panelsApi.createCampusPanels({ root, canvas, inputAnchor: launchers.controls, toggleControls: () => launchers.controls.click(), controller: controllerRoot,
          settings, storage, runtime: live, cache: mapCache, frames: framePort, nowMs: clock.nowMs, diagnostics: { ...diagnostics,
            copy: ui.createBrowserClipboard(document, view.navigator), reportSecrets: () => settings.list().filter(spec => spec.sensitive).map(spec => settings.get(spec.id)).filter((value): value is string => typeof value === "string") }, appFiles, published });
        cleanups.push(() => panels.destroy());
        const saved = sceneBrowser.createSavedImagesSection({ document, source: store, refresh: panels.refresh,
          maxListedGroups: () => settings.get<number>("scene.panorama.savedGroupsShown") });
        const savedSection = panels.parameterSection({ tab: "scenes", section: "saved", main: saved.element, covers: [] });
        cleanups.push(() => saved.destroy(), () => savedSection.destroy());
        const mapHud = enginePanels.createMapSourceHud(mapHudContainer, { document,
          layout: settings.get("interface.mapHud.layout") === "expanded" ? "expanded" : "compact",
          ui: { createExternalLinkIcon: ui.createExternalLinkIcon, attachMapDownloadSpeed: toolbar.attachMapDownloadSpeed,
            setMapSourceLabel: toolbar.setMapSourceLabel, attachTileStreamingActivity: toolbar.attachTileStreamingActivity },
          activity: live, onProviderClick: () => launchers.map.click(), detail: { document, controller: panels.detail } });
        mapHud.update(live.status);
        cleanups.push(() => mapHud.destroy(), live.subscribeStatus(status => mapHud.update(status)),
          settings.watch("interface.mapHud.layout", value => mapHud.setLayout(value === "expanded" ? "expanded" : "compact")));
        const status = toolbar.createStatusHud(launchers.location, settings, { document });
        cleanups.push(() => status.destroy(), framePort.subscribe(() => { const value = live.getViewState(); if (value) status.update(value); }));
        const controllerInput = gamepad.createBrowserInputSource({ target: view });
        const panoramaProfile = viewerApi.createPanoramaProfileContribution(gamepadCore.DEFAULT_BINDING_TRANSFORM);
        const standardProfile = () => engineGamepad.createStandardGlobeProfile(controllerInput.getSelectedDevice()?.slot ?? 0,
          settings.get<number>("input.gamepad.deadzone"), panoramaProfile);
        const controller = new gamepadCore.BindingRuntime({ profile: standardProfile(),
          adapter: engineGamepad.createGlobeGamepadAdapter(live, { featureActions: viewerApi.PANORAMA_GAMEPAD_ACTIONS,
            getContext: () => live.getNavigationState()?.inputContext ?? "globe", onResetNorth: () => live.setViewState({ headingDeg: 0 }) }) });
        const controllerEditor = gamepadUi.mountBindingEditor({ root: controllerRoot, runtime: controller, source: controllerInput,
          store: gamepadCore.createProfileStore(), builtInProfiles: [{ id: "standard", label: engineGamepad.STANDARD_GLOBE_PROFILE_NAME, create: standardProfile }] });
        cleanups.push(() => controllerInput.dispose(), () => controller.dispose(), () => controllerEditor.destroy(),
          controllerInput.subscribe(frame => controller.dispatch(frame)), controllerInput.start({ intervalMs: 33, shouldPoll: () => !document.hidden }),
          settings.watch("input.gamepad.deadzone", () => controller.setProfile(engineGamepad.withStickDeadzone(controller.getProfile(), settings.get<number>("input.gamepad.deadzone")))));
        const resourceWatch = subscribeCampusResourceSettings(settings, policy.resourceParameterIds, {
          updateResources() {
            broker.setLimits(policy.session()); cache.setKeptGpuBytes(policy.n("keptGpuMiB") * 1024 * 1024);
            native!.uploader.setLimits(policy.upload()); live.requestRender();
          },
          updateSavedImages() { store.setLimits({ maxBytes: policy.n("savedMiB") * 1024 * 1024 }); },
        });
        cleanups.push(resourceWatch);
        signal.throwIfAborted();
        scheduler.requestRender();
        const host: CampusNativeHost = {
          externalArrival,
          inspectImages: () => store.inspect(),
          pickPanoramasAt: (clientX, clientY) => Number.isFinite(clientX) && Number.isFinite(clientY) ? viewer!.pick(clientX, clientY) : [],
          observe() {
            const gl = renderer.mode === "webgpu" ? null : canvas.getContext("webgl2") ?? canvas.getContext("webgl");
            const glVersion = gl ? String(gl.getParameter(gl.VERSION)) : null;
            const actual = renderer.mode === "webgpu" ? "webgpu"
              : glVersion?.startsWith("WebGL 2") ? "webgl2" : glVersion?.startsWith("WebGL 1") ? "webgl1" : "unknown";
            const engineClass = renderer.engine.getClassName?.() ?? null;
            const engineVersion = (renderer.engine.constructor as unknown as { Version?: string }).Version ?? null;
            return {
              authorities: { ...authorities },
              backend: { actual, requested: renderer.requested, mode: renderer.mode, glVersion,
                engineVersion: engineVersion ?? engineClass, engineClass,
                deviceKind: "unknown", fallbackReason: renderer.fallbackReason ?? null },
              runtimeStatus: { ...live.status }, navigation: live.getNavigationState(), camera: live.getViewState(),
              viewer: viewer!.status(), activeImage: viewer!.status().active ? viewer!.describeImage(viewer!.status().active!) : null,
              imageCache: cache.stats(),
              activeSources: viewer!.status().active ? viewer!.currentSources(viewer!.status().active!) : null,
              published: published.state(), interfaceTheme: settings.get("interface.theme"),
              installed: options.about.builtFrom, release: options.about.release,
            };
          },
          shellContainer, bindings: { document, hotspots,
            scene: { window: view, canvas, baseUrl: view.location.origin + "/", fetch: view.fetch.bind(view), viewer, representations,
              externalNavigation: createCampusExternalNavigation(view),
              frames: viewerFrame.frames, sessionId: view.crypto.randomUUID(), markerRadiusMeters: () => policy.n("markerRadiusMeters"),
              dragThresholdPx: () => settings.get<number>("input.mouse.dragThreshold"), limits: {
                get manifestBytes() { return settings.get<number>("scene.manifestMiB") * 1024 * 1024; },
                get entities() { return settings.get<number>("scene.entityLimit"); },
                get assets() { return settings.get<number>("scene.assetLimit"); },
                get links() { return settings.get<number>("scene.linkLimit"); },
              },
              // The public 360 adapter owns representation facts, ordering and resource costs.
              describeImage: viewerFrame.describeImage,
              projectLink: viewerGlobe.createGlobeViewerProjection({ viewer, renderer: panorama, runtime: live }) },
            world: { surface: live.surface, showOverview: (value, request) => overview!.showOverview(value, request) },
            scenesUi: panels.scenesUi, viewerUi: panels.viewerUi,
            sceneContributions: [...panels.sceneContributions, { section: "saved", title: "Saved images", ...savedSection }],
            about: { ...options.about, publishedVersion: published, createAbortController: () => new view.AbortController(), externalLinkIcon: () => ui.createExternalLinkIcon(document) },
            basePanels: panels.basePanels, dev: { createAbortController: () => new view.AbortController(), onError },
            shell: { storage, geometry: ui.browserOverlayGeometry(view, () => hud.element.getBoundingClientRect().bottom),
              layoutPort: ui.browserOverlayLayout(document.documentElement), logSize: { getWidth: () => logWidth,
                subscribe: listener => { logListeners.add(listener); return () => { logListeners.delete(listener); }; } },
              launchers, onBugReportShow: panels.onBugReportShow, focus: { onClose: () => canvas.focus() } } },
          whenSettled: () => closure.whenSettled(),
          dispose() { closure.dispose(); if (settlementProven) destroyDevice();
            else void closure.whenSettled().then(destroyDevice, onError); },
        };
        return host;
      } catch (error) {
        const failures: unknown[] = [error];
        let startupDrain: Promise<void> | undefined;
        let startupDrainValid = true;
        if (typeof engineNative.NativeMapStartupError === "function" && error instanceof engineNative.NativeMapStartupError) {
          try {
            startupDrain = error.whenSettled();
            if (!startupDrain || typeof startupDrain.then !== "function")
              throw new TypeError("Engine NativeMapStartupError did not return its native retirement promise.");
            const ownedDrain = startupDrain;
            drains.push(() => ownedDrain);
            // Abort may have started the frame closure before this exceptional
            // owner was returned. Join it explicitly as well as through drains.
            void ownedDrain.catch(() => {});
          } catch (cleanup) { startupDrainValid = false; failures.push(cleanup); }
        }
        try { closure.dispose(); } catch (cleanup) { failures.push(cleanup); }
        const cleanupResults = await Promise.allSettled([closure.whenSettled(), ...(startupDrain ? [startupDrain] : [])]);
        const cleanupErrors = cleanupResults.flatMap(result => result.status === "rejected" ? [result.reason] : []);
        failures.push(...cleanupErrors);
        if (!cleanupErrors.length && startupDrainValid) {
          try { destroyDevice(); } catch (cleanup) { failures.push(cleanup); }
        }
        throw new AggregateError(failures, "Campus native startup failed.");
      }
    },
  };
}
