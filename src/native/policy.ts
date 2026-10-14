import type { SettingsRegistry, ParameterSpec } from "@foss-earth/ui/settings";
import type { TerrainPreparationPolicy } from "@foss-earth/engine";
import { DEFAULT_TERRAIN_LOADER_LIMITS } from "@foss-earth/engine";
import type { ViewerSettings } from "@foss-earth/image-viewer/viewer";
import type { ImageSessionLimits } from "@foss-earth/images";
import type { ImageTransferLimits } from "@foss-earth/images/browser";
import type { ImageUploadLimits } from "@foss-earth/renderer/babylon";

const MIB = 1024 * 1024;

/** Campus destination policy concerns displayed placements, never flight clearance. */
export const CAMPUS_NATIVE_PARAMETERS: readonly ParameterSpec[] = [
  ["scene.overview.minimumPreparationRadius", "Overview preparation minimum radius", 200, 1, 1000000, "m", "scenes", "motion"],
  ["map.loader.requests", "Elevation loader requests", DEFAULT_TERRAIN_LOADER_LIMITS.maxConcurrent, 1, 64, "count", "map", "loading"],
  ["map.loader.cacheEntries", "Elevation loader cache entries", DEFAULT_TERRAIN_LOADER_LIMITS.cacheEntries, 1, 100000, "count", "map", "loading"],
  ["map.loader.timeout", "Elevation request timeout", DEFAULT_TERRAIN_LOADER_LIMITS.timeoutMs, 1, 600000, "ms", "map", "loading"],
  ["map.preparation.minimumQuality", "Destination elevation quality", 10, 0, 30, "none", "map", "loading"],
  ["scene.panorama.savedGroupsShown", "Saved image groups shown", 60, 0, 100000, "count", "scenes", "saved"],
].map(([id, label, value, min, max, unit, tab, section]): ParameterSpec => ({
  id: String(id), label: String(label), kind: "number", unit: unit as "m" | "ms" | "count" | "none",
  description: "Campus host policy for its public rendering or content service.",
  default: Number(value), bounds: () => ({ min: Number(min), max: Number(max) }),
  ...(unit === "count" ? { step: 1 } : {}),
  defaultReason: "Retained Campus development policy; no device performance or height accuracy claim.",
  home: { tab: String(tab), section: String(section), level: "all" },
  appliesLive: true, source: "src/native/policy.ts",
}));

export const CAMPUS_DEPLOYMENT_PARAMETERS: readonly ParameterSpec[] = [
  { id: "app.keepFiles", label: "Keep app files", kind: "boolean", unit: "none", default: true,
    description: "Keep the Campus deployment's loaded resources for later visits; documents continue to use the network.",
    defaultReason: "Retain the existing Campus worker behavior.", home: { tab: "settings", section: "app-files", level: "main" }, appliesLive: true, source: "src/native/policy.ts" },
  { id: "app.checkPublished", label: "Check published version", kind: "boolean", unit: "none", default: true,
    description: "Report when the published page differs. Reloading is an explicit action.",
    defaultReason: "Keep version status available without replacing the current page.", home: { tab: "settings", section: "app-files", level: "main" }, appliesLive: true, source: "src/native/policy.ts" },
  { id: "app.checkPublishedEvery", label: "Version check interval", kind: "number", unit: { id: "min", text: "min" }, default: 10,
    bounds: () => ({ min: 1, max: 1440 }), description: "Minutes between visible-page checks of the Campus deployment.",
    defaultReason: "A bounded Campus status cadence; no automatic reload.", home: { tab: "settings", section: "app-files", level: "all" }, appliesLive: true, source: "src/native/policy.ts" },
];

export interface CampusOverviewPreparationPolicy {
  minimumRadiusMeters?: number;
  timeoutMs?: number;
  sampleIntervalMs?: number;
  stalledAfterMs?: number;
}

/** Projections of the same saved owner parameters; there is no second registry. */
export function createCampusResourcePolicy(settings: SettingsRegistry, view: Window) {
  const n = (suffix: string): number => settings.get<number>(`scene.panorama.${suffix}`);
  const count = (suffix: string, minimum = 1): number => Math.max(minimum, Math.round(n(suffix)));
  const range = (suffix: string) => settings.get<{ min: number; max: number }>(`scene.panorama.${suffix}`);
  const reducedMotion = (): boolean => settings.get("scene.panorama.reducedMotion") === "reduce"
    || settings.get("scene.panorama.reducedMotion") === "system" && view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const detailWidth = (): number => {
    const state = settings.inspect("scene.panorama.immersionWidth");
    return typeof state.value !== "number" || state.bounds && state.value >= state.bounds.max ? Infinity : state.value;
  };
  return {
    n, count, range, reducedMotion, detailWidth,
    session(): ImageSessionLimits {
      return { pools: { sourceGpu: n("sourceGpuMiB") * MIB, overlap: n("overlapMiB") * MIB,
        decoded: n("decodedMiB") * MIB, encoded: n("encodedMiB") * MIB, uploadOutstanding: n("uploadOutstandingMiB") * MIB },
      requests: count("requests"), decodes: count("decodes") };
    },
    transfer(): ImageTransferLimits { return { responseBytes: n("responseMiB") * MIB, timeoutMs: n("requestTimeout") * 1000 }; },
    upload(): ImageUploadLimits { return { bytesPerFrame: n("uploadMiBPerFrame") * MIB, outstandingBytes: n("uploadOutstandingMiB") * MIB }; },
    viewer(): ViewerSettings {
      return { appearance: { previewFovDeg: n("previewFov"), markerDiameterCssPx: range("markerDiameter"), hitTargetDiameterCssPx: n("hitTargetDiameter") },
        look: { dragSensitivity: n("dragSensitivity"), swipeSensitivity: n("swipeSensitivity"), lookRate: n("lookRate"),
          zoomPerNotch: n("zoomPerNotch"), zoomRate: n("zoomRate"), pinchGain: n("pinchGain"), inertiaHalfLifeMs: n("inertiaHalfLife"),
          fovRangeDeg: range("verticalFovRange"), pitchRangeDeg: range("pitchRange"), reducedMotion: reducedMotion() },
        entryOrientation: settings.get("scene.panorama.entryOrientation") === "authored" ? "authored" : "geographic",
        flightDurationMs: reducedMotion() || typeof settings.get("scene.panorama.flightDuration") !== "number" ? 0 : n("flightDuration"),
        expandDurationMs: n("expandDuration"), fadeDurationMs: n("fadeDuration"), reducedFadeDurationMs: n("reducedFadeDuration"),
        orientDurationMs: n("orientDuration"), hoverDurationMs: n("hoverDuration"),
        previewHoldMs: typeof settings.get("scene.panorama.previewHold") === "number" ? n("previewHold") * 1000 : null };
    },
    selection() {
      return { previewFaces: range("previewFaceRange"), previewFovDeg: n("previewFov"), previewDensity: n("previewDensity"),
        immersionWidth: detailWidth(), immersionDensity: typeof settings.get("scene.panorama.immersionDensity") === "number" ? n("immersionDensity") : null,
        preference: settings.get("scene.panorama.representation") as "equi-angular-tiles" | "cube-tiles" | "whole" };
    },
    tiles() {
      return { requests: count("tileRequests"), waiting: count("tilesWaiting"), decodes: count("tileDecodes"), uploadsPerFrame: count("tileUploadsPerFrame"),
        retries: count("tileRetries", 0), retryDelayMs: n("tileRetryDelay"), fadeMs: reducedMotion() ? n("reducedFadeDuration") : n("fadeDuration"),
        viewSlotShare: n("tileViewShare"), retryBackoffDoublings: count("tileRetryBackoffDoublings", 0) };
    },
    resourceParameterIds: ["sourceGpuMiB", "overlapMiB", "decodedMiB", "encodedMiB", "uploadOutstandingMiB", "requests", "decodes", "responseMiB", "requestTimeout", "uploadMiBPerFrame", "keptGpuMiB"].map(suffix => `scene.panorama.${suffix}`),
  };
}

export function createCampusTerrainPreparationPolicy(settings: SettingsRegistry, policy: CampusOverviewPreparationPolicy = {}): TerrainPreparationPolicy {
  const positive = (value: number | undefined, fallback: number): number => {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new TypeError("Campus preparation intervals must be finite and positive.");
    return value ?? fallback;
  };
  const timeout = positive(policy.timeoutMs, 120000), sampleInterval = positive(policy.sampleIntervalMs, 200), stalled = positive(policy.stalledAfterMs, 15000);
  // This overview places a camera looking at the drawn ground; no contact or aircraft requirement is introduced.
  const fallback: TerrainPreparationPolicy["fallback"] = (request, groundHeightMeters) => ({
    groundHeightMeters, altitudeMeters: Math.max(request.altitudeMeters ?? groundHeightMeters,
      groundHeightMeters + (request.altitudeAboveGroundMeters ?? 0), groundHeightMeters + (request.clearanceMeters ?? 0)),
  });
  return {
    timeoutMs: () => timeout, sampleIntervalMs: () => sampleInterval, stalledAfterMs: () => stalled,
    requiredRasterQuality: () => settings.get<number>("map.preparation.minimumQuality"), fallback,
    evaluate(request, samples, google, rendererSettled) {
      const center = samples[0], ready = !!center && Number.isFinite(center.heightMeters)
        && (google ? rendererSettled : center.quality >= settings.get<number>("map.preparation.minimumQuality"));
      return { progress: { phase: ready ? "checking" : center ? "refining" : "loading", readySamples: ready ? 1 : 0,
        totalSamples: 1, progress: ready ? 0.95 : center ? 0.2 : 0,
        message: ready ? "Checking displayed overview ground…" : "Waiting for displayed ground at the overview." },
      result: ready ? fallback(request, center.heightMeters) : null };
    },
  };
}
