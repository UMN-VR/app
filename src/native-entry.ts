import type { SceneExample } from "@foss-earth/scenes/browser";
import type { ViewRecord } from "@foss-earth/scenes";
import { createCampusComposition, type CampusCompositionBindings } from "./tour/composition";

export interface CampusRoute {
  examples: readonly SceneExample[];
  initialSceneId: string;
}
/** One-use arrival selected by the owned fixed-route native callback. */
export interface CampusExternalArrival {
  sceneId: string;
  panoramaId: string;
  view: ViewRecord | null;
}

/** Borrowed public owner ports. Campus assembles the public shared native bindings. */
export interface CampusNativeHost {
  /** React mounts here; native canvas/hotspots remain sibling elements. */
  shellContainer: HTMLElement;
  bindings: Omit<CampusCompositionBindings, "container" | "search" | "signal" | "defaultSceneId" | "scene"> & {
    scene: Omit<CampusCompositionBindings["scene"], "examples" | "signal">;
  };
  externalArrival?: CampusExternalArrival;
  /** Read-only native diagnostic facts from the existing authorities. */
  observe?(): Record<string, unknown>;
  /** Read-only hit-test from the existing published viewer; never enters an image. */
  pickPanoramasAt?(clientX: number, clientY: number): readonly string[];
  inspectImages?(): Promise<unknown>;
  whenSettled(): Promise<void>;
  dispose(): void;
}
export interface CampusNativeHostFactory {
  prepare(input: { container: HTMLElement; signal: AbortSignal; route: CampusRoute }): Promise<CampusNativeHost>;
  /** This path must not create a globe, viewer, scheduler or Dev session. */
  report(input: { container: HTMLElement; signal: AbortSignal; search: string }): Promise<{
    whenSettled(): Promise<void>; dispose(): void;
  }>;
}

/** One native session and one Campus composition; content is supplied by the route. */
export async function mountCampusApp(
  container: HTMLElement,
  route: CampusRoute,
  native: CampusNativeHostFactory,
  { search = container.ownerDocument.defaultView?.location.search ?? "", signal }: { search?: string; signal?: AbortSignal } = {},
) {
  const cancellation = new AbortController();
  let mounted = false;
  const abort = () => {
    cancellation.abort();
    if (mounted) void destroy().catch(() => { /* Observable through whenSettled. */ });
  };
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  let host: CampusNativeHost | Awaited<ReturnType<CampusNativeHostFactory["report"]>> | undefined;
  let composition: Awaited<ReturnType<typeof createCampusComposition>> = null;
  let retirement: Promise<void> | undefined;
  const destroy = (): Promise<void> => retirement ??= (async () => {
    cancellation.abort();
    signal?.removeEventListener("abort", abort);
    const failures: unknown[] = [];
    try { composition?.dispose(); } catch (error) { failures.push(error); }
    // Abort has already begun native retirement through the shared frame closure.
    // Borrowed rendering/image authorities outlive pending scene/session cleanup;
    // the host's device-disposal guard requires its real terminal owner proof.
    for (const settle of [() => composition?.whenSettled(), () => host?.whenSettled()]) {
      try { await settle(); } catch (error) { failures.push(error); }
    }
    try { host?.dispose(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, "Campus session retirement failed");
  })();
  try {
    if (cancellation.signal.aborted) throw new Error("Campus startup was cancelled.");
    if (new URLSearchParams(search).has("report")) {
      host = await native.report({ container, signal: cancellation.signal, search });
    } else {
      const preparedHost = await native.prepare({ container, signal: cancellation.signal, route });
      host = preparedHost;
      if (cancellation.signal.aborted) throw new Error("Campus startup was cancelled.");
      composition = await createCampusComposition({
        ...preparedHost.bindings, container: preparedHost.shellContainer, search, signal: cancellation.signal,
        defaultSceneId: route.initialSceneId,
        scene: { ...preparedHost.bindings.scene, examples: route.examples, signal: cancellation.signal },
      });
      if (preparedHost.externalArrival) {
        if (!composition || !await composition.initialScene)
          throw new Error("The selected external Campus scene could not be loaded.");
        cancellation.signal.throwIfAborted();
        const arrival = preparedHost.externalArrival, handle = composition.content.controller.handle();
        if (!handle || handle.status.sceneId !== arrival.sceneId)
          throw new Error("The loaded Campus scene does not match the external arrival identity.");
        const entered = await handle.enter(arrival.panoramaId, {
          signal: cancellation.signal, ...(arrival.view ? { view: arrival.view } : {}),
        });
        if (!entered.ok) throw new Error(`External Campus arrival failed: ${entered.message}`);
      }
    }
    if (cancellation.signal.aborted) throw new Error("Campus startup was cancelled.");
    mounted = true;
    return { composition, destroy,
      pickPanoramasAt: (clientX: number, clientY: number) => host && "pickPanoramasAt" in host ? host.pickPanoramasAt?.(clientX, clientY) ?? [] : [],
      inspectImages: () => host && "inspectImages" in host ? host.inspectImages?.() ?? Promise.resolve(null) : Promise.resolve(null),
      readRuntime: () => ({
        runtimeStarted: Boolean(composition), viewerCreated: Boolean(composition),
        ...(host && "observe" in host ? host.observe?.() : {}),
        devActivated: composition?.devActivated() ?? false,
        sceneState: composition?.content.controller.state() ?? null,
      }),
      whenSettled: () => retirement ?? Promise.all([composition?.whenSettled(), host?.whenSettled()]).then(() => undefined) };
  } catch (error) {
    try { await destroy(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], "Campus startup and cleanup failed"); }
    throw error;
  }
}
