// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import type { RasterBaseMapSource } from "@foss-earth/engine";
import {
  AERONAUTICAL_CHART, CAMPUS_OVERVIEW_PARAMETERS, createOverviewMap, mercatorX, mercatorY, overviewPointToLatLon, planOverview, resolveOverviewSource, tileUrl,
  OVERVIEW_PROVIDER_CHARTS, OVERVIEW_PROVIDER_CURRENT, OVERVIEW_PROVIDER_ID,
} from "./overviewMap";

const raster: RasterBaseMapSource = {
  id: "usgs-imagery",
  label: "USGS Imagery",
  provider: "USGS The National Map",
  protocol: "xyz",
  urlTemplate: "https://tiles.example/{z}/{x}/{y}.png",
  attribution: "USGS The National Map",
  attributionUrl: "https://example.test/usgs",
  minZoom: 0,
  maxZoom: 16,
};

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function mountedMap() {
  const settings = createSettingsRegistry();
  settings.register(CAMPUS_OVERVIEW_PARAMETERS);
  const frameListeners = new Set<() => void>();
  const moveTo = vi.fn();
  const map = createOverviewMap({
    document, sources: [raster], settings, moveTo,
    basemap: () => ({ mode: "google-tiles", source: null }),
    subscribeBasemap: () => () => {},
    view: () => ({ latDeg: 44.97, lonDeg: -93.23, headingDeg: 20, zoomMeters: 1500 }),
    frames: { subscribe(listener) { frameListeners.add(listener); return () => { frameListeners.delete(listener); }; } },
  });
  document.body.append(map.element);
  const stage = map.element.querySelector<HTMLElement>(".overview-map__view")!;
  const canvas = map.element.querySelector("canvas")!;
  Object.defineProperties(stage, { clientWidth: { value: 400 }, clientHeight: { value: 300 } });
  vi.spyOn(canvas, "getContext").mockReturnValue(null);
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 800, 600));
  return { map, settings, moveTo, canvas, frame: () => { for (const listener of frameListeners) listener(); } };
}

describe("overview map interaction", () => {
  it("moves to the clicked location at the displayed scale and stops navigating without a map or after teardown", () => {
    const h = mountedMap();
    h.frame();
    h.canvas.dispatchEvent(new MouseEvent("click", { clientX: 410, clientY: 320 }));
    expect(h.moveTo).toHaveBeenCalledTimes(1);
    expect(h.moveTo.mock.calls[0][0].latDeg).toBeCloseTo(44.97, 5);
    expect(h.moveTo.mock.calls[0][0].lonDeg).toBeCloseTo(-93.23, 5);
    h.canvas.dispatchEvent(new MouseEvent("click", { clientX: 610, clientY: 170 }));
    expect(h.moveTo.mock.calls[1][0].latDeg).toBeGreaterThan(44.97);
    expect(h.moveTo.mock.calls[1][0].lonDeg).toBeGreaterThan(-93.23);
    h.moveTo.mockClear();
    h.settings.set(OVERVIEW_PROVIDER_ID, OVERVIEW_PROVIDER_CURRENT);
    h.canvas.dispatchEvent(new MouseEvent("click", { clientX: 410, clientY: 320 }));
    expect(h.moveTo).not.toHaveBeenCalled();
    h.settings.set(OVERVIEW_PROVIDER_ID, OVERVIEW_PROVIDER_CHARTS);
    h.map.destroy();
    h.canvas.dispatchEvent(new MouseEvent("click", { clientX: 410, clientY: 320 }));
    expect(h.moveTo).not.toHaveBeenCalled();
  });

  it("requests each tile once while earlier tiles are still loading", () => {
    const requests: { image: HTMLImageElement; url: string }[] = [];
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (this: HTMLImageElement, url: string) {
      requests.push({ image: this, url });
    });
    const h = mountedMap();
    h.frame();
    expect(requests).toHaveLength(4);
    h.frame();
    h.frame();
    // Let queued tiles start while the first three requests remain pending.
    for (let index = 3; index < requests.length && index < 64; index += 1) requests[index].image.dispatchEvent(new Event("load"));
    h.frame();
    expect(requests.length).toBeGreaterThan(4);
    expect(new Set(requests.map(request => request.url)).size).toBe(requests.length);
    h.map.destroy();
  });
});

describe("overview map projection", () => {
  it("builds the Minneapolis sectional tile the FAA service serves", () => {
    expect(Math.floor(mercatorX(-93.2277, 11))).toBe(493);
    expect(Math.floor(mercatorY(44.9738, 11))).toBe(736);
    expect(tileUrl(AERONAUTICAL_CHART.urlTemplate, 11, 493, 736)).toBe(
      "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/11/736/493",
    );
  });

  it("keeps the camera at the center of the planned frame", () => {
    const frame = planOverview({
      latDeg: 44.975, lonDeg: -93.234, widthPx: 400, heightPx: 300,
      zoomMeters: 1500, zoomOffset: 0, minZoom: 0, maxZoom: 18,
    });
    const center = overviewPointToLatLon(frame, 200, 150);
    expect(center.latDeg).toBeCloseTo(44.975, 5);
    expect(center.lonDeg).toBeCloseTo(-93.234, 5);
    expect(frame.tiles.length).toBeGreaterThan(0);
  });

  it("scales sectional tiles instead of asking for a zoom the charts do not publish", () => {
    const close = planOverview({
      latDeg: 44.975, lonDeg: -93.234, widthPx: 400, heightPx: 300,
      zoomMeters: 800, zoomOffset: 0, minZoom: AERONAUTICAL_CHART.minZoom, maxZoom: AERONAUTICAL_CHART.maxZoom,
    });
    expect(close.zoom).toBe(AERONAUTICAL_CHART.maxZoom);
    expect(close.scale).toBeGreaterThan(1);
    const readable = planOverview({
      latDeg: 44.975, lonDeg: -93.234, widthPx: 400, heightPx: 300,
      zoomMeters: 800, zoomOffset: 0, minZoom: AERONAUTICAL_CHART.minZoom, maxZoom: AERONAUTICAL_CHART.maxZoom,
      maxScale: 1,
    });
    expect(readable.scale).toBeLessThanOrEqual(1);
    expect(readable.zoom).toBe(AERONAUTICAL_CHART.maxZoom);
    const center = overviewPointToLatLon(readable, 200, 150);
    expect(center.latDeg).toBeCloseTo(44.975, 4);
    expect(center.lonDeg).toBeCloseTo(-93.234, 4);
    const far = planOverview({
      latDeg: 44.975, lonDeg: -93.234, widthPx: 800, heightPx: 600,
      zoomMeters: 2_000_000, zoomOffset: 0, minZoom: AERONAUTICAL_CHART.minZoom, maxZoom: AERONAUTICAL_CHART.maxZoom,
    });
    expect(far.zoom).toBe(AERONAUTICAL_CHART.minZoom);
    expect(far.tiles.length).toBeLessThanOrEqual(64);
  });
});

describe("overview map provider", () => {
  it("follows a raster basemap, refuses Google's 3D tiles, and defaults an unknown choice to the charts", () => {
    expect(resolveOverviewSource(OVERVIEW_PROVIDER_CURRENT, { mode: "raster-basemap", source: raster }, [raster]).source?.urlTemplate).toBe(raster.urlTemplate);
    expect(resolveOverviewSource(OVERVIEW_PROVIDER_CURRENT, { mode: "google-tiles", source: null }, [raster])).toMatchObject({
      source: null, note: "Google 3D Tiles has no flat image. Choose a chart or another map.",
    });
    expect(resolveOverviewSource("missing", { mode: "fallback", source: null }, [raster]).source?.id).toBe(OVERVIEW_PROVIDER_CHARTS);
    expect(resolveOverviewSource(raster.id, { mode: "google-tiles", source: null }, [raster]).source?.id).toBe(raster.id);
  });

  it("opens on aeronautical charts and says when the current map is Google 3D Tiles", () => {
    const settings = createSettingsRegistry();
    settings.register(CAMPUS_OVERVIEW_PARAMETERS);
    let basemap: { mode: "google-tiles" | "raster-basemap" | "fallback"; source: RasterBaseMapSource | null } = { mode: "raster-basemap", source: raster };
    const basemapListeners = new Set<() => void>();
    const frameListeners = new Set<() => void>();
    const moveTo = vi.fn();
    const map = createOverviewMap({
      document, sources: [raster], settings, moveTo,
      basemap: () => basemap,
      subscribeBasemap(listener) { basemapListeners.add(listener); return () => { basemapListeners.delete(listener); }; },
      view: () => ({ latDeg: 44.97, lonDeg: -93.23, headingDeg: 20, zoomMeters: 1500 }),
      frames: { subscribe(listener) { frameListeners.add(listener); return () => { frameListeners.delete(listener); }; } },
    });
    document.body.append(map.element);
    const select = map.element.querySelector("select");
    if (!select) throw new Error("The map tab has no provider choice.");
    expect(select.value).toBe(OVERVIEW_PROVIDER_CHARTS);
    expect([...select.options].map(option => option.textContent)).toContain("Aeronautical charts");
    expect(map.element.querySelector("[role='status']")?.hasAttribute("hidden")).toBe(true);
    select.value = OVERVIEW_PROVIDER_CURRENT;
    select.dispatchEvent(new Event("change"));
    expect(settings.get(OVERVIEW_PROVIDER_ID)).toBe(OVERVIEW_PROVIDER_CURRENT);
    expect(map.element.querySelector(".overview-map__credit")?.textContent).toContain("USGS The National Map");
    basemap = { mode: "google-tiles", source: null };
    for (const listener of basemapListeners) listener();
    expect(map.element.querySelector("[role='status']")?.textContent).toBe("Google 3D Tiles has no flat image. Choose a chart or another map.");
    map.destroy();
    expect(frameListeners.size).toBe(0);
    expect(basemapListeners.size).toBe(0);
    expect(map.element.isConnected).toBe(false);
    expect(moveTo).not.toHaveBeenCalled();
  });
});
