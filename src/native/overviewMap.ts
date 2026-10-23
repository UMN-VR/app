import type { ParameterSpec, SettingsRegistry } from "@foss-earth/ui/settings";
import { createExternalLinkIcon } from "@foss-earth/ui/browser";
import { RASTER_BASE_MAP_SOURCES, withSourceKey, type RasterBaseMapSource } from "@foss-earth/engine";
import "./overviewMap.css";

/** The flat Map tab's provider. Separate from the basemap the globe is draped with. */
export const OVERVIEW_PROVIDER_ID = "map.overview.provider";
export const OVERVIEW_PROVIDER_CURRENT = "current";
export const OVERVIEW_PROVIDER_CHARTS = "aeronautical";

export const CAMPUS_OVERVIEW_PARAMETERS: readonly ParameterSpec[] = [
  {
    id: OVERVIEW_PROVIDER_ID,
    label: "Overview map",
    description: "The flat map in the Map tab: the current basemap from above, or another provider.",
    unit: "none",
    kind: "choice",
    choices: [
      { id: OVERVIEW_PROVIDER_CURRENT, label: "Current basemap" },
      { id: OVERVIEW_PROVIDER_CHARTS, label: "Aeronautical charts" },
      ...RASTER_BASE_MAP_SOURCES.map(source => ({ id: source.id, label: source.label })),
    ],
    default: OVERVIEW_PROVIDER_CHARTS,
    defaultReason: "The Map tab opens on aeronautical charts. The globe keeps its own basemap.",
    home: { tab: "overview", section: "source", level: "main" },
    appliesLive: true,
    source: "src/native/overviewMap.ts",
  },
];

/** Web Mercator metres per pixel at zoom 0 on the equator. */
const WEB_MERCATOR_MPP = 156543.033928;
const TILE_PX = 256;
/** The longer side of the panel never asks for more tiles than this. */
const MAX_TILES_ACROSS = 8;
const MAX_CACHED_TILES = 96;
const MAX_TILE_REQUESTS = 4;

/**
 * FAA VFR sectional charts. Zooms 8–12 return JPEG tiles; 7 and 13 do not
 * (checked 2026-10-22). Closer and farther views scale those tiles.
 */
export const AERONAUTICAL_CHART = {
  id: OVERVIEW_PROVIDER_CHARTS,
  label: "Aeronautical charts",
  urlTemplate: "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}",
  minZoom: 8,
  maxZoom: 12,
  attribution: "Federal Aviation Administration, Aeronautical Information Services",
  attributionUrl: "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/",
} as const;

export interface OverviewSource {
  id: string;
  label: string;
  urlTemplate: string;
  minZoom: number;
  maxZoom: number;
  attribution: string;
  attributionUrl?: string;
}

export interface OverviewBasemap {
  mode: "google-tiles" | "raster-basemap" | "fallback";
  source: RasterBaseMapSource | null;
}

export interface OverviewView {
  latDeg: number;
  lonDeg: number;
  headingDeg: number;
  zoomMeters: number;
}

export interface OverviewTile {
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
}

export interface OverviewFrame {
  zoom: number;
  scale: number;
  originX: number;
  originY: number;
  tilePx: number;
  tiles: OverviewTile[];
}

const GOOGLE_NOTE = "Google 3D Tiles has no flat image. Choose a chart or another map.";
const WAITING_NOTE = "The current basemap has no flat image yet.";

export function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replaceAll("{z}", String(z)).replaceAll("{x}", String(x)).replaceAll("{y}", String(y));
}

export function mercatorX(lonDeg: number, zoom: number): number {
  return ((lonDeg + 180) / 360) * 2 ** zoom;
}

export function mercatorY(latDeg: number, zoom: number): number {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latDeg)) * Math.PI / 180;
  return (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * 2 ** zoom;
}

export function lonFromMercatorX(x: number, zoom: number): number {
  const lon = (x / 2 ** zoom) * 360 - 180;
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

export function latFromMercatorY(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return Math.atan(Math.sinh(n)) * (180 / Math.PI);
}

/** Zoom whose ground scale matches the camera distance across about half the panel. */
export function overviewZoom(latDeg: number, zoomMeters: number, heightPx: number, offset: number): number {
  const desired = Math.max(zoomMeters, 1) / Math.max(heightPx * 0.45, 1);
  const cosine = Math.cos(Math.min(80, Math.abs(latDeg)) * Math.PI / 180);
  return Math.log2((WEB_MERCATOR_MPP * Math.max(cosine, 0.05)) / desired) + offset;
}

export function planOverview(input: {
  latDeg: number;
  lonDeg: number;
  widthPx: number;
  heightPx: number;
  zoomMeters: number;
  zoomOffset: number;
  minZoom: number;
  maxZoom: number;
  /** Caps how far a coarse chart is magnified. The camera stays centered and more ground shows. */
  maxScale?: number;
}): OverviewFrame {
  const raw = overviewZoom(input.latDeg, input.zoomMeters, input.heightPx, input.zoomOffset);
  const zoom = Math.round(Math.min(input.maxZoom, Math.max(input.minZoom, raw)));
  let scale = 2 ** (raw - zoom);
  if (input.maxScale !== undefined) scale = Math.min(scale, input.maxScale);
  const longer = Math.max(input.widthPx, input.heightPx, 1);
  const span = longer / Math.max(TILE_PX * scale, 1e-6);
  if (span > MAX_TILES_ACROSS) scale *= span / MAX_TILES_ACROSS;
  const tilePx = TILE_PX * scale;
  const n = 2 ** zoom;
  const originX = input.widthPx / 2 - mercatorX(input.lonDeg, zoom) * tilePx;
  const originY = input.heightPx / 2 - mercatorY(input.latDeg, zoom) * tilePx;
  const x0 = Math.floor(-originX / tilePx);
  const x1 = Math.floor((input.widthPx - originX) / tilePx);
  const y0 = Math.max(0, Math.floor(-originY / tilePx));
  const y1 = Math.min(n - 1, Math.floor((input.heightPx - originY) / tilePx));
  const tiles: OverviewTile[] = [];
  for (let x = x0; x <= x1; x += 1) {
    const wrapped = ((x % n) + n) % n;
    for (let y = y0; y <= y1; y += 1) tiles.push({ z: zoom, x: wrapped, y, left: originX + x * tilePx, top: originY + y * tilePx });
  }
  return { zoom, scale, originX, originY, tilePx, tiles };
}

export function overviewPointToLatLon(frame: OverviewFrame, xPx: number, yPx: number): { latDeg: number; lonDeg: number } {
  return {
    latDeg: latFromMercatorY((yPx - frame.originY) / frame.tilePx, frame.zoom),
    lonDeg: lonFromMercatorX((xPx - frame.originX) / frame.tilePx, frame.zoom),
  };
}

function sourceFromRaster(source: RasterBaseMapSource): OverviewSource {
  return {
    id: source.id,
    label: source.label,
    urlTemplate: source.urlTemplate,
    minZoom: source.minZoom ?? 0,
    maxZoom: source.maxZoom ?? 19,
    attribution: source.attribution,
    ...(source.attributionUrl ? { attributionUrl: source.attributionUrl } : {}),
  };
}

/** The tiles to draw for this choice, or a note when the current map has no flat image. */
export function resolveOverviewSource(selection: string, basemap: OverviewBasemap, rasters: readonly RasterBaseMapSource[]): { source: OverviewSource | null; note: string | null } {
  if (selection === OVERVIEW_PROVIDER_CURRENT) {
    if (basemap.mode === "google-tiles") return { source: null, note: GOOGLE_NOTE };
    if (!basemap.source) return { source: null, note: WAITING_NOTE };
    return { source: sourceFromRaster(basemap.source), note: null };
  }
  if (selection === OVERVIEW_PROVIDER_CHARTS) return { source: AERONAUTICAL_CHART, note: null };
  const raster = rasters.find(item => item.id === selection);
  return raster ? { source: sourceFromRaster(raster), note: null } : { source: AERONAUTICAL_CHART, note: null };
}

export interface OverviewMapOptions {
  document: Document;
  /** The same 2D basemaps the globe can drape, offered beside the charts. */
  sources: readonly RasterBaseMapSource[];
  settings: SettingsRegistry;
  basemap(): OverviewBasemap;
  subscribeBasemap(listener: () => void): () => void;
  view(): OverviewView | null;
  moveTo(partial: { latDeg: number; lonDeg: number }): void;
  frames: { subscribe(listener: () => void): () => void };
}

export interface OverviewMapHandle {
  element: HTMLElement;
  destroy(): void;
}

/**
 * A north-up map of where the camera is. It follows the view, and a click
 * moves the camera there. Scroll changes only this map's scale.
 */
export function createOverviewMap(options: OverviewMapOptions): OverviewMapHandle {
  const { document, settings } = options;
  const view = document.defaultView;
  if (!view) throw new Error("The map tab needs its window.");
  const element = document.createElement("div");
  element.className = "overview-map";
  const bar = document.createElement("div");
  bar.className = "overview-map__bar";
  const label = document.createElement("label");
  label.textContent = "Showing";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Map to show");
  const choices = [
    { id: OVERVIEW_PROVIDER_CURRENT, label: "Current basemap" },
    { id: AERONAUTICAL_CHART.id, label: AERONAUTICAL_CHART.label },
    ...options.sources.map(source => ({ id: source.id, label: source.label })),
  ];
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    select.append(option);
  }
  label.append(select);
  bar.append(label);
  const stage = document.createElement("div");
  stage.className = "overview-map__view";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Top-down map of the view. Click to go there. Scroll to zoom this map.");
  const note = document.createElement("p");
  note.className = "overview-map__note";
  note.setAttribute("role", "status");
  note.hidden = true;
  const credit = document.createElement("a");
  credit.className = "overview-map__credit";
  credit.target = "_blank";
  credit.rel = "noopener noreferrer";
  const creditText = document.createElement("span");
  credit.append(creditText, createExternalLinkIcon(document));
  credit.hidden = true;
  credit.addEventListener("click", event => { if (!credit.getAttribute("href")) event.preventDefault(); });
  stage.append(canvas, note, credit);
  element.append(bar, stage);

  const images = new Map<string, HTMLImageElement>();
  const failed = new Set<string>();
  const queued = new Set<string>();
  const loading = new Set<string>();
  const queue: string[] = [];
  let active = 0;
  let disposed = false;
  let zoomOffset = 0;
  let lastFrame: OverviewFrame | null = null;
  let signature = "";

  const keyed = (source: OverviewSource): OverviewSource => {
    const raster = options.sources.find(item => item.id === source.id);
    if (!raster) return source;
    const key = settings.has("map.source.cartoKey") ? settings.get("map.source.cartoKey") : "";
    return sourceFromRaster(withSourceKey(raster, typeof key === "string" ? key : ""));
  };

  const pump = (): void => {
    while (active < MAX_TILE_REQUESTS && queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      queued.delete(url);
      if (images.has(url) || failed.has(url)) continue;
      active += 1;
      loading.add(url);
      const image = document.createElement("img");
      image.decoding = "async";
      image.alt = "";
      image.onload = () => {
        active -= 1;
        loading.delete(url);
        if (!disposed) {
          images.set(url, image);
          while (images.size > MAX_CACHED_TILES) {
            const oldest = images.keys().next().value;
            if (oldest === undefined) break;
            images.delete(oldest);
          }
          signature = "";
          paint();
        }
        pump();
      };
      image.onerror = () => {
        active -= 1;
        loading.delete(url);
        failed.add(url);
        pump();
      };
      image.src = url;
    }
  };

  const enqueue = (url: string): void => {
    if (images.has(url) || failed.has(url) || queued.has(url) || loading.has(url)) return;
    queued.add(url);
    queue.push(url);
    pump();
  };

  const paint = (): void => {
    if (disposed) return;
    const selection = String(settings.get(OVERVIEW_PROVIDER_ID));
    const known = [...select.options].some(option => option.value === selection);
    select.value = known ? selection : OVERVIEW_PROVIDER_CHARTS;
    const resolved = resolveOverviewSource(select.value, options.basemap(), options.sources);
    const source = resolved.source ? keyed(resolved.source) : null;
    note.hidden = resolved.note === null;
    note.textContent = resolved.note ?? "";
    canvas.toggleAttribute("aria-hidden", resolved.note !== null);
    if (source?.attribution) {
      credit.hidden = false;
      creditText.textContent = source.attribution;
      if (source.attributionUrl) {
        credit.href = source.attributionUrl;
        credit.removeAttribute("aria-disabled");
      } else {
        credit.removeAttribute("href");
      }
    } else credit.hidden = true;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const place = options.view();
    if (!source || !place || width < 2 || height < 2) {
      lastFrame = null;
      signature = "";
      return;
    }
    const frame = planOverview({
      latDeg: place.latDeg, lonDeg: place.lonDeg, widthPx: width, heightPx: height,
      zoomMeters: place.zoomMeters, zoomOffset, minZoom: source.minZoom, maxZoom: source.maxZoom,
      ...(source.id === AERONAUTICAL_CHART.id && zoomOffset <= 0 ? { maxScale: 1 } : {}),
    });
    lastFrame = frame;
    let loaded = 0;
    for (const tile of frame.tiles) {
      const url = tileUrl(source.urlTemplate, tile.z, tile.x, tile.y);
      if (images.has(url)) loaded += 1;
      else enqueue(url);
    }
    const next = `${source.urlTemplate}|${place.latDeg.toFixed(5)}|${place.lonDeg.toFixed(5)}|${place.headingDeg.toFixed(1)}|${place.zoomMeters.toFixed(0)}|${zoomOffset}|${width}x${height}|${loaded}|${frame.zoom}`;
    if (next === signature) return;
    signature = next;
    const dpr = Math.min(view.devicePixelRatio || 1, 2);
    const bitmapWidth = Math.max(1, Math.round(width * dpr));
    const bitmapHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#d5deea";
    context.fillRect(0, 0, width, height);
    for (const tile of frame.tiles) {
      const image = images.get(tileUrl(source.urlTemplate, tile.z, tile.x, tile.y));
      if (image) context.drawImage(image, tile.left, tile.top, frame.tilePx, frame.tilePx);
    }
    context.fillStyle = "rgba(15, 23, 42, 0.8)";
    context.font = "700 12px sans-serif";
    context.textAlign = "center";
    context.fillText("N", width / 2, 16);
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(place.headingDeg * Math.PI / 180);
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(7, 9);
    context.lineTo(0, 4);
    context.lineTo(-7, 9);
    context.closePath();
    context.fillStyle = "#f97316";
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2;
    context.stroke();
    context.fill();
    context.restore();
  };

  const onSelect = (): void => {
    settings.set(OVERVIEW_PROVIDER_ID, select.value);
    signature = "";
    paint();
  };
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    zoomOffset = Math.min(6, Math.max(-8, zoomOffset + (event.deltaY > 0 ? -0.5 : 0.5)));
    signature = "";
    paint();
  };
  const onDoubleClick = (event: MouseEvent): void => {
    event.preventDefault();
    zoomOffset = 0;
    signature = "";
    paint();
  };
  const onClick = (event: MouseEvent): void => {
    if (!lastFrame || event.button !== 0) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    options.moveTo(overviewPointToLatLon(lastFrame,
      (event.clientX - bounds.left) * stage.clientWidth / bounds.width,
      (event.clientY - bounds.top) * stage.clientHeight / bounds.height));
  };
  select.addEventListener("change", onSelect);
  stage.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("dblclick", onDoubleClick);
  const stopFrames = options.frames.subscribe(() => { if (element.isConnected) paint(); });
  const stopBasemap = options.subscribeBasemap(() => { signature = ""; paint(); });
  const stopProvider = settings.watch(OVERVIEW_PROVIDER_ID, () => { signature = ""; paint(); });
  const stopKey = settings.has("map.source.cartoKey") ? settings.watch("map.source.cartoKey", () => { signature = ""; paint(); }) : () => {};
  const resize = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(() => { signature = ""; paint(); }) : null;
  resize?.observe(stage);
  paint();

  return {
    element,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      queue.length = 0;
      queued.clear();
      select.removeEventListener("change", onSelect);
      stage.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDoubleClick);
      stopFrames();
      stopBasemap();
      stopProvider();
      stopKey();
      resize?.disconnect();
      element.remove();
    },
  };
}
