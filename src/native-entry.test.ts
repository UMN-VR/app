// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createCampusComposition } from "./tour/composition";
import type { SceneActionResult } from "@foss-earth/scenes/browser";
import { mountCampusApp, type CampusNativeHost, type CampusNativeHostFactory } from "./native-entry";
vi.mock("./tour/composition", () => ({ createCampusComposition: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const route = { examples: [{ id: "st-paul", title: "Saint Paul", description: "Campus", url: "tour/st-paul/releases/pinned/scene.json" }], initialSceneId: "st-paul" };
function harness() {
  const order: string[] = [];
  const host = { shellContainer: document.createElement("div"), bindings: { scene: {} }, whenSettled: vi.fn(async () => { order.push("native settled"); }), dispose: vi.fn(() => { order.push("native dispose"); }) } as unknown as CampusNativeHost;
  const handle = { status: { sceneId: "umn-st-paul" }, enter: vi.fn(async (_id: string, _options: unknown): Promise<SceneActionResult> => ({ ok: true })) };
  const composition = { dispose: vi.fn(() => { order.push("composition dispose"); }), whenSettled: vi.fn(async () => { order.push("composition settled"); }),
    initialScene: Promise.resolve(true), content: { controller: { handle: vi.fn(() => handle) } } };
  vi.mocked(createCampusComposition).mockResolvedValue(composition as unknown as Awaited<ReturnType<typeof createCampusComposition>>);
  const native: CampusNativeHostFactory = { prepare: vi.fn(async () => host), report: vi.fn(async () => host) };
  return { host, native, composition, handle, order };
}
it("uses only the native report path for report+dev and retires it once", async () => {
  const h = harness();
  const app = await mountCampusApp(document.createElement("div"), route, h.native, { search: "?report&dev=1" });
  expect(h.native.prepare).not.toHaveBeenCalled();
  expect(createCampusComposition).not.toHaveBeenCalled();
  await Promise.all([app.destroy(), app.destroy()]);
  expect(h.host.dispose).toHaveBeenCalledOnce();
});
it("injects the selected child catalogue and settles composition before releasing native authorities", async () => {
  const h = harness();
  const app = await mountCampusApp(document.createElement("div"), route, h.native, { search: "" });
  expect(vi.mocked(createCampusComposition).mock.calls[0][0]).toMatchObject({ defaultSceneId: "st-paul", scene: { examples: route.examples } });
  expect(vi.mocked(createCampusComposition).mock.calls[0][0].container).toBe(h.host.shellContainer);
  await app.destroy();
  expect(h.order).toEqual(["composition dispose", "composition settled", "native settled", "native dispose"]);
});
it("retires a native host arriving after startup cancellation without mounting composition", async () => {
  const h = harness();
  let resolve!: (value: CampusNativeHost) => void;
  vi.mocked(h.native.prepare).mockReturnValue(new Promise(done => { resolve = done; }));
  const cancellation = new AbortController();
  const pending = mountCampusApp(document.createElement("div"), route, h.native, { signal: cancellation.signal });
  cancellation.abort(); resolve(h.host);
  await expect(pending).rejects.toThrow("cancelled");
  expect(createCampusComposition).not.toHaveBeenCalled();
  expect(h.order).toEqual(["native settled", "native dispose"]);
});

it("starts native cancellation before a held drain and retains the borrowed device until it settles", async () => {
  const h = harness();
  let release!: () => void;
  const nativeWork = new Promise<void>(resolve => { release = resolve; });
  vi.mocked(h.native.prepare).mockImplementation(async ({ signal }) => {
    signal.addEventListener("abort", () => { h.order.push("native abort"); }, { once: true });
    return h.host;
  });
  vi.mocked(h.host.whenSettled).mockImplementation(async () => {
    h.order.push("native drain start"); await nativeWork; h.order.push("native drain end");
  });
  const app = await mountCampusApp(document.createElement("div"), route, h.native, { search: "" });
  const retiring = app.destroy();
  expect(h.order[0]).toBe("native abort");
  await new Promise<void>(resolve => queueMicrotask(resolve));
  expect(h.host.dispose).not.toHaveBeenCalled();
  release(); await retiring;
  expect(h.order).toEqual(["native abort", "composition dispose", "composition settled", "native drain start", "native drain end", "native dispose"]);
});

it("waits for the actual selected scene before entering the carried named panorama", async () => {
  const h = harness();
  h.host.externalArrival = { sceneId: "umn-st-paul", panoramaId: "community-connections", view: { headingDeg: 17, pitchDeg: -4, verticalFovDeg: 60 } };
  let release!: (loaded: boolean) => void;
  h.composition.initialScene = new Promise(resolve => { release = resolve; });
  const pending = mountCampusApp(document.createElement("div"), route, h.native, { search: "" });
  await new Promise<void>(resolve => queueMicrotask(resolve));
  expect(h.handle.enter).not.toHaveBeenCalled();
  release(true); const app = await pending;
  expect(h.handle.enter).toHaveBeenCalledWith("community-connections", { signal: expect.any(AbortSignal), view: { headingDeg: 17, pitchDeg: -4, verticalFovDeg: 60 } });
  await app.destroy();
});

it("rejects a mismatched loaded scene before entering any panorama", async () => {
  const h = harness(); h.host.externalArrival = { sceneId: "umn-minneapolis", panoramaId: "regis", view: null };
  await expect(mountCampusApp(document.createElement("div"), route, h.native, { search: "" })).rejects.toThrow("external arrival identity");
  expect(h.handle.enter).not.toHaveBeenCalled(); expect(h.host.dispose).toHaveBeenCalledOnce();
});

it("cancels an arrival held behind initial scene loading without entering the named panorama", async () => {
  const h = harness(); h.host.externalArrival = { sceneId: "umn-st-paul", panoramaId: "community-connections", view: null };
  let release!: (loaded: boolean) => void;
  h.composition.initialScene = new Promise(resolve => { release = resolve; });
  const cancellation = new AbortController();
  const pending = mountCampusApp(document.createElement("div"), route, h.native, { search: "", signal: cancellation.signal });
  await new Promise<void>(resolve => queueMicrotask(resolve));
  cancellation.abort(); release(true);
  await expect(pending).rejects.toThrow(); expect(h.handle.enter).not.toHaveBeenCalled(); expect(h.host.dispose).toHaveBeenCalledOnce();
});

it("forwards the identical native external-navigation port through the normal scene binding", async () => {
  const h = harness();
  const externalNavigation: NonNullable<CampusNativeHost["bindings"]["scene"]["externalNavigation"]> = {
    navigate: vi.fn(async () => ({ ok: true as const })),
  };
  h.host.bindings.scene.externalNavigation = externalNavigation;
  const app = await mountCampusApp(document.createElement("div"), route, h.native, { search: "" });
  expect(vi.mocked(createCampusComposition).mock.calls[0][0].scene.externalNavigation).toBe(externalNavigation);
  expect(externalNavigation.navigate).not.toHaveBeenCalled();
  await app.destroy();
});

it("keeps an omitted native external-navigation port absent for a local-only host", async () => {
  const h = harness();
  const app = await mountCampusApp(document.createElement("div"), route, h.native, { search: "" });
  expect(vi.mocked(createCampusComposition).mock.calls[0][0].scene.externalNavigation).toBeUndefined();
  await app.destroy();
});

it("retains a failed named-panorama arrival and settles its owners before native disposal", async () => {
  const h = harness(); h.host.externalArrival = { sceneId: "umn-st-paul", panoramaId: "missing-stop", view: null };
  h.handle.enter.mockResolvedValue({ ok: false, reason: "unavailable", message: "The named panorama is unavailable." });
  await expect(mountCampusApp(document.createElement("div"), route, h.native, { search: "" })).rejects.toThrow("External Campus arrival failed: The named panorama is unavailable.");
  expect(h.order).toEqual(["composition dispose", "composition settled", "native settled", "native dispose"]);
});

it("cancels actual arrival entry through its supplied signal and retires the host", async () => {
  const h = harness(); h.host.externalArrival = { sceneId: "umn-st-paul", panoramaId: "community-connections", view: null };
  const cancellation = new AbortController();
  let entered!: () => void, ownerSignal: AbortSignal | undefined;
  const entering = new Promise<void>(resolve => { entered = resolve; });
  h.handle.enter.mockImplementation(async (_id, options) => new Promise<SceneActionResult>(resolve => {
    ownerSignal = (options as { signal: AbortSignal }).signal;
    ownerSignal.addEventListener("abort", () => resolve({ ok: false, reason: "cancelled", message: "The arrival owner cancelled." }), { once: true });
    entered();
  }));
  const pending = mountCampusApp(document.createElement("div"), route, h.native, { search: "", signal: cancellation.signal });
  await entering; cancellation.abort();
  await expect(pending).rejects.toThrow("External Campus arrival failed: The arrival owner cancelled.");
  expect(ownerSignal?.aborted).toBe(true);
  expect(h.order).toEqual(["composition dispose", "composition settled", "native settled", "native dispose"]);
});
