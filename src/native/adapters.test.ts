import { expect, it, vi } from "vitest";
import { createBuiltInRepresentations } from "@foss-earth/360";
import type { SettingsRegistry } from "@foss-earth/ui/settings";
import type { ImageRepresentation } from "@foss-earth/images";
import { copyCampusCodecInput, estimateCampusImage, subscribeCampusResourceSettings } from "./adapters";

it("copies only the encoded subview into an independent ArrayBuffer, including shared input", () => {
  const storage = new SharedArrayBuffer(8), all = new Uint8Array(storage);
  all.set([90, 91, 1, 2, 3, 92, 93, 94]);
  const copy = copyCampusCodecInput(all.subarray(2, 5));
  expect(copy).toBeInstanceOf(ArrayBuffer);
  expect([...new Uint8Array(copy)]).toEqual([1, 2, 3]);
  all[2] = 99;
  expect([...new Uint8Array(copy)]).toEqual([1, 2, 3]);
});

it("uses actual owner validation before estimating malformed or unsupported spatial records", () => {
  const owners = createBuiltInRepresentations(() => ({ tileMemoryBytes: 8 * 1024 * 1024,
    responseBytes: 1000, requests: 1, waiting: 1, uploadOutstandingBytes: 1000 }));
  const base: ImageRepresentation = { id: "whole", role: "immersion", projection: "equirectangular", mimeType: "image/jpeg", encodedBytes: 1000 };
  expect(() => estimateCampusImage(base, owners, 8192, "https://campus.example/")).toThrow("Invalid Campus image representation");
  expect(() => estimateCampusImage({ ...base, projection: "foreign" }, owners, 8192, "https://campus.example/")).toThrow("No representation owner");
  const whole = { ...base, width: 6144, height: 3072, url: "whole.jpg" };
  expect(estimateCampusImage(whole, owners, 8192, "https://campus.example/").decoded).toBe(4 * 6144 * 3072);
  expect(() => estimateCampusImage(whole, owners, 4096, "https://campus.example/")).toThrow("supplied device texture limit");
});

it("applies actual Set notifications once per resource group and preserves unsubscribe", () => {
  let notify!: Parameters<SettingsRegistry["subscribe"]>[0];
  const unsubscribe = vi.fn(), resources = vi.fn(), saved = vi.fn();
  const settings: Pick<SettingsRegistry, "subscribe"> = { subscribe(listener) { notify = listener; return unsubscribe; } };
  const stop = subscribeCampusResourceSettings(settings, ["scene.panorama.encodedMiB", "scene.panorama.keptGpuMiB"], {
    updateResources: resources, updateSavedImages: saved,
  });
  notify(new Set(["interface.theme"]));
  expect(resources).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
  notify(new Set(["scene.panorama.encodedMiB", "scene.panorama.keptGpuMiB", "scene.panorama.savedMiB"]));
  expect(resources).toHaveBeenCalledOnce(); expect(saved).toHaveBeenCalledOnce();
  stop(); expect(unsubscribe).toHaveBeenCalledOnce();
});
