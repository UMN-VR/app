// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSceneController, loadScene, type LoadSceneResult,
  type SceneControllerOptions } from "@foss-earth/scenes/browser";
import { createCampusSceneController, type CampusSceneBindings } from "./controller";

// These fixtures observe the Campus consumer boundary. The public owner decides
// routing, link following and native readiness; no shared algorithm is recreated.
vi.mock("@foss-earth/scenes/browser", () => ({
  createSceneController: vi.fn(), loadScene: vi.fn(),
  createBrowserSceneHistory: vi.fn(() => ({ record: vi.fn(), subscribe: vi.fn(() => () => {}) })),
}));
afterEach(() => vi.resetAllMocks());

function harness(externalNavigation?: CampusSceneBindings["externalNavigation"]) {
  const bindings = {
    examples: [{ id: "st-paul", title: "Saint Paul", description: "Campus", url: "/tour/st-paul/releases/fixture/scene.json" }],
    window, canvas: document.createElement("canvas"), baseUrl: "https://campus.example/",
    fetch: vi.fn(), viewer: {}, representations: [], world: {}, frames: { subscribe: vi.fn() },
    sessionId: "fixture-campus-session", markerRadiusMeters: () => 1, dragThresholdPx: () => 5,
    limits: {}, describeImage: vi.fn(), projectLink: vi.fn(),
    ...(externalNavigation ? { externalNavigation } : {}),
  } as unknown as CampusSceneBindings;
  const result: LoadSceneResult = { ok: false, errors: [{ path: "$", message: "Fixture owner result; not runtime qualification." }] };
  const controller = { destroy: vi.fn() } as unknown as ReturnType<typeof createSceneController>;
  vi.mocked(createSceneController).mockReturnValue(controller);
  vi.mocked(loadScene).mockResolvedValue(result);
  expect(createCampusSceneController(bindings)).toBe(controller);
  const options = vi.mocked(createSceneController).mock.calls[0][0];
  const request: Parameters<SceneControllerOptions["load"]>[1] = {
    signal: new AbortController().signal, onFailure: vi.fn(), onProgress: vi.fn(),
  };
  return { bindings, result, options, request };
}

describe("Campus external navigation consumer", () => {
  it("forwards the exact host port and load-owner observers without invoking navigation", async () => {
    const externalNavigation: NonNullable<CampusSceneBindings["externalNavigation"]> = {
      navigate: vi.fn(async () => ({ ok: true as const })),
    };
    const h = harness(externalNavigation);
    await h.options.load(h.bindings.examples[0].url, h.request);
    const forwarded = vi.mocked(loadScene).mock.calls[0][1]!;
    expect(forwarded.externalNavigation).toBe(externalNavigation);
    expect(forwarded.signal).toBe(h.request.signal);
    expect(forwarded.onFailure).toBe(h.request.onFailure);
    expect(forwarded.onProgress).toBe(h.request.onProgress);
    expect(externalNavigation.navigate).not.toHaveBeenCalled();
  });

  it("keeps a local-only host compatible when the optional port is omitted", async () => {
    const h = harness();
    await h.options.load(h.bindings.examples[0].url, h.request);
    const forwarded = vi.mocked(loadScene).mock.calls[0][1]!;
    expect(forwarded.externalNavigation).toBeUndefined();
    expect(forwarded.viewer).toBe(h.bindings.viewer);
    expect(forwarded.world).toBe(h.bindings.world);
  });

  it("returns the public owner's causal load failure unchanged", async () => {
    const h = harness();
    expect(await h.options.load(h.bindings.examples[0].url, h.request)).toBe(h.result);
  });

  it("preserves a public owner's rejected failure instead of inventing a successful scene", async () => {
    const h = harness(), failure = new Error("The qualified owner rejected scene loading.");
    vi.mocked(loadScene).mockRejectedValue(failure);
    await expect(h.options.load(h.bindings.examples[0].url, h.request)).rejects.toBe(failure);
  });

  it("forwards the cancelled request signal and its causal owner rejection", async () => {
    const h = harness(), cancellation = new AbortController(), cause = new Error("Fixture load was cancelled.");
    cancellation.abort(cause); h.request.signal = cancellation.signal;
    vi.mocked(loadScene).mockRejectedValue(cause);
    await expect(h.options.load(h.bindings.examples[0].url, h.request)).rejects.toBe(cause);
    expect(vi.mocked(loadScene).mock.calls[0][1]!.signal).toBe(cancellation.signal);
    expect(vi.mocked(loadScene).mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
});
