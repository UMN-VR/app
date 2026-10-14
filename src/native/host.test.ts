import { describe, expect, it } from "vitest";
import type { GlobeRuntime, SettledGlobeRuntime } from "@foss-earth/engine/babylon";
import { isSceneHistoryEntry, type SceneExternalNavigationPorts } from "@foss-earth/scenes/browser";
import { CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY, consumeCampusExternalArrival,
  createCampusExternalNavigation, createCampusNativeHostFactory, requireGlobeSettlement,
  type CampusExternalBrowserPorts, type CampusNativeHostOptions } from "./host";

const options = (): CampusNativeHostOptions => ({
  about: { release: { schema: 1 } as unknown as CampusNativeHostOptions["about"]["release"], builtFrom: null,
    identity: { build: "2026-10-10T00:00:00Z", source: "fixture", bundle: "fixture.js" } },
  deployment: { publishedVersionUrl: "https://campus.example/tour/", workerUrl: "/foss-earth-sw.js", workerScope: "/",
    retainedResourceUrls: ["/assets/fixture.js"], cacheNamespace: "Campus fixture" },
});

function routeBrowser(start = "https://campus.example/tour/minneapolis/?map=retained") {
  let href = start, state: unknown = { anotherOwner: "retained" }, reloads = 0, reloadError: Error | null = null;
  const writes: { mode: "push" | "replace"; url: string | null }[] = [];
  const update = (mode: "push" | "replace", value: unknown, url?: string | URL | null) => {
    state = value; if (url != null) href = new URL(url, href).href;
    writes.push({ mode, url: url == null ? null : String(url) });
  };
  const target: CampusExternalBrowserPorts = {
    history: { get state() { return state; }, pushState: (value, _title, url) => update("push", value, url),
      replaceState: (value, _title, url) => update("replace", value, url) },
    location: { get href() { return href; }, get pathname() { return new URL(href).pathname; },
      reload: () => { if (reloadError) throw reloadError; reloads += 1; } },
  };
  return { target, writes, reloads: () => reloads, failReload: (error: Error) => { reloadError = error; } };
}
const externalInput = (): Parameters<SceneExternalNavigationPorts["navigate"]>[0] => ({
  destination: { id: "st-paul", sceneId: "umn-st-paul", routeId: "st-paul" }, sphereId: "community-connections",
  source: { sceneId: "umn-minneapolis", revision: "fixture-source", sphereId: "regis" },
  link: { id: "next-stop", target: "community-connections", externalDestination: "st-paul", label: "Next stop",
    arrivalView: { headingDeg: 17, pitchDeg: -4, verticalFovDeg: 60 } }, signal: new AbortController().signal,
});
const stPaulRoute = { initialSceneId: "st-paul", examples: [{ id: "st-paul", title: "Saint Paul", description: "Campus", url: "/tour/st-paul/scene.json" }] };

describe("Campus registered external selection", () => {
  it("selects the fixed route and carries the named panorama and authored view without a query", async () => {
    const browser = routeBrowser();
    await expect(createCampusExternalNavigation(browser.target).navigate(externalInput())).resolves.toEqual({ ok: true });
    expect(browser.target.location.href).toBe("https://campus.example/tour/st-paul/");
    expect(browser.reloads()).toBe(1);
    expect(browser.target.history.state).toMatchObject({ [CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY]: {
      routeId: "st-paul", sceneId: "umn-st-paul", panoramaId: "community-connections",
      view: { headingDeg: 17, pitchDeg: -4, verticalFovDeg: 60 },
    } });
  });

  it("rejects a foreign scene or URL-shaped route before touching browser state", async () => {
    const browser = routeBrowser(), input = externalInput();
    input.destination.sceneId = "foreign-scene";
    expect((await createCampusExternalNavigation(browser.target).navigate(input)).ok).toBe(false);
    input.destination.sceneId = "umn-st-paul"; input.destination.routeId = "https://foreign.example/";
    expect((await createCampusExternalNavigation(browser.target).navigate(input)).ok).toBe(false);
    expect(browser.writes).toEqual([]); expect(browser.reloads()).toBe(0);
  });

  it("cancels before changing the registered route", async () => {
    const browser = routeBrowser(), input = externalInput(), cancellation = new AbortController();
    cancellation.abort(); input.signal = cancellation.signal;
    expect(await createCampusExternalNavigation(browser.target).navigate(input)).toMatchObject({ ok: false, reason: "cancelled" });
    expect(browser.writes).toEqual([]); expect(browser.reloads()).toBe(0);
  });

  it("consumes the arrival once while preserving another owner's history data", async () => {
    const browser = routeBrowser();
    await createCampusExternalNavigation(browser.target).navigate(externalInput());
    browser.target.history.replaceState({ ...browser.target.history.state as object, anotherOwner: "kept" }, "");
    expect(consumeCampusExternalArrival(browser.target, stPaulRoute, isSceneHistoryEntry)).toEqual({
      sceneId: "umn-st-paul", panoramaId: "community-connections", view: { headingDeg: 17, pitchDeg: -4, verticalFovDeg: 60 },
    });
    expect(browser.target.history.state).toEqual({ anotherOwner: "kept" });
    expect(consumeCampusExternalArrival(browser.target, stPaulRoute, isSceneHistoryEntry)).toBeUndefined();
  });

  it("clears and rejects an arrival presented to the wrong registered catalogue", async () => {
    const browser = routeBrowser();
    await createCampusExternalNavigation(browser.target).navigate(externalInput());
    expect(() => consumeCampusExternalArrival(browser.target, { ...stPaulRoute, initialSceneId: "minneapolis" }, isSceneHistoryEntry)).toThrow("registered route");
    expect(browser.target.history.state).not.toHaveProperty(CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY);
  });

  it("uses shared history validation to reject a nonfinite carried view", async () => {
    const browser = routeBrowser(), input = externalInput();
    input.link.arrivalView!.headingDeg = Infinity;
    await createCampusExternalNavigation(browser.target).navigate(input);
    expect(() => consumeCampusExternalArrival(browser.target, stPaulRoute, isSceneHistoryEntry)).toThrow("panorama or view");
    expect(browser.target.history.state).not.toHaveProperty(CAMPUS_EXTERNAL_ARRIVAL_HISTORY_KEY);
  });

  it("retains the original route and state when native reload fails", async () => {
    const browser = routeBrowser(); browser.failReload(new Error("reload blocked"));
    expect(await createCampusExternalNavigation(browser.target).navigate(externalInput())).toMatchObject({ ok: false, reason: "failed", message: "Campus route selection failed: reload blocked" });
    expect(browser.target.location.href).toBe("https://campus.example/tour/minneapolis/?map=retained");
    expect(browser.target.history.state).toEqual({ anotherOwner: "retained" }); expect(browser.reloads()).toBe(0);
  });
});

describe("Campus native owner boundaries", () => {
  it("refuses absent real map retirement instead of inventing settlement", () => {
    expect(() => requireGlobeSettlement({} as GlobeRuntime)).toThrow("SettledGlobeRuntime.whenSettled");
  });

  it("does not settle while the actual map owner still holds asynchronous work", async () => {
    const events: string[] = [];
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const runtime = { whenSettled: () => { events.push("map-drain-start"); return held; } } as unknown as SettledGlobeRuntime;
    const drain = requireGlobeSettlement(runtime);
    const retiring = drain().then(() => { events.push("map-drain-end"); });
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(events).toEqual(["map-drain-start"]);
    release(); await retiring;
    expect(events).toEqual(["map-drain-start", "map-drain-end"]);
  });

  it("retains an owner's causal retirement failure", async () => {
    const failure = new Error("A submitted map operation failed after cancellation.");
    const runtime = { whenSettled: async () => { throw failure; } } as unknown as SettledGlobeRuntime;
    await expect(requireGlobeSettlement(runtime)()).rejects.toBe(failure);
  });

  it("preserves the real owner's receiver when invoking its retirement method", async () => {
    const runtime = { whenSettled(this: unknown) {
      expect(this).toBe(runtime);
      return Promise.resolve();
    } } as unknown as SettledGlobeRuntime;
    await requireGlobeSettlement(runtime)();
  });

  it("rejects an older artifact whose drain returns no native promise", () => {
    const runtime = { whenSettled: () => undefined } as unknown as GlobeRuntime;
    expect(() => requireGlobeSettlement(runtime)()).toThrow("native retirement promise");
  });

  it("refuses a worker whose deployment scope would lose existing root routes", () => {
    const input = options(); input.deployment.workerScope = "/tour/" as "/";
    expect(() => createCampusNativeHostFactory(input)).toThrow("root service worker");
  });

  it("requires the namespace shared with the exact generated worker", () => {
    const input = options(); input.deployment.cacheNamespace = " ";
    expect(() => createCampusNativeHostFactory(input)).toThrow("cache namespace");
  });

  it("constructs factory dispatch without requesting a browser or native device", () => {
    const factory = createCampusNativeHostFactory(options());
    expect(typeof factory.prepare).toBe("function"); expect(typeof factory.report).toBe("function");
  });
});
