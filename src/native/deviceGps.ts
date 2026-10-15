import { Vector3, type Sprite, type SpriteManager, type TransformNode } from "@babylonjs/core";
import { smoothSurfaceEcef, type EcefCoord } from "@foss-earth/engine";
import { createPointSprite, createPointSpriteManager, disposeSpriteManagers, DEFAULT_DOT_TEXTURE_SIZE } from "@foss-earth/engine/sprites";
import type { GlobeRuntime } from "@foss-earth/engine/babylon";
import type { CanvasTextureDevicePorts } from "@foss-earth/renderer/babylon";

/**
 * The campus app links a sealed engine build whose location panel has no GPS
 * control. This draws the same button, blue dot and accuracy disc on that tab.
 */

const BLUE = "rgb(66, 133, 244)";
const CLOSE_ZOOM_METERS = 8_000;
const ARRIVAL_ZOOM_METERS = 1_500;
const DOT_PX = 18;
const ACCURACY_OPACITY = 0.25;
const ACCURACY_LIFT_M = 2;
const DOT_LIFT_M = 6;
const CELL = DEFAULT_DOT_TEXTURE_SIZE;
const WATCH: PositionOptions = { enableHighAccuracy: true, maximumAge: 1_000, timeout: 20_000 };

export interface CampusDeviceFix {
  latDeg: number;
  lonDeg: number;
  accuracyMeters: number;
}

export interface CampusDeviceView {
  latDeg: number;
  lonDeg: number;
  zoomMeters?: number;
}

export interface CampusGeolocation {
  watchPosition(
    success: (position: { coords: { latitude: number; longitude: number; accuracy: number; altitude?: number | null } }) => void,
    error?: ((error: { code: number }) => void) | null,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

export interface CampusDeviceMarker {
  show(fix: CampusDeviceFix | null): void;
  destroy(): void;
}

export function campusDeviceView(fix: CampusDeviceFix, currentZoomMeters: number | undefined): CampusDeviceView {
  const close = currentZoomMeters !== undefined && currentZoomMeters <= CLOSE_ZOOM_METERS;
  return { latDeg: fix.latDeg, lonDeg: fix.lonDeg, ...(close ? {} : { zoomMeters: ARRIVAL_ZOOM_METERS }) };
}

export function formatCampusAccuracy(accuracyMeters: number): string {
  if (!(accuracyMeters > 0)) return "";
  if (accuracyMeters >= 10_000) return `${Math.round(accuracyMeters / 1000)} km`;
  if (accuracyMeters >= 1_000) return `${(accuracyMeters / 1000).toFixed(1)} km`;
  return `${Math.round(accuracyMeters)} m`;
}

function deviceError(code: number): string {
  if (code === 1) return "Location permission was denied.";
  if (code === 2) return "Device location is unavailable.";
  if (code === 3) return "Device location timed out.";
  return "Device location failed.";
}

function readFix(coords: { latitude: number; longitude: number; accuracy: number }): CampusDeviceFix | null {
  const { latitude: latDeg, longitude: lonDeg, accuracy: accuracyMeters } = coords;
  if (![latDeg, lonDeg, accuracyMeters].every(Number.isFinite)) return null;
  if (Math.abs(latDeg) > 90 || Math.abs(lonDeg) > 180 || accuracyMeters < 0) return null;
  return { latDeg, lonDeg, accuracyMeters };
}

function watchDevice(geolocation: CampusGeolocation | null, onFix: (fix: CampusDeviceFix) => void, onError: (message: string) => void): () => void {
  if (!geolocation) {
    onError("Device location is unavailable.");
    return () => {};
  }
  let stopped = false;
  let id = 0;
  try {
    id = geolocation.watchPosition((position) => {
      if (stopped) return;
      const fix = readFix(position.coords);
      if (fix) onFix(fix);
    }, (error) => {
      if (!stopped) onError(deviceError(error.code));
    }, WATCH);
  } catch {
    onError("Device location is unavailable.");
    return () => {};
  }
  return () => {
    if (stopped) return;
    stopped = true;
    geolocation.clearWatch(id);
  };
}

function gpsIcon(document: Document): SVGSVGElement {
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("aria-hidden", "true");
  const dot = document.createElementNS(svgNs, "circle");
  dot.setAttribute("cx", "12");
  dot.setAttribute("cy", "12");
  dot.setAttribute("r", "3");
  dot.setAttribute("fill", "currentColor");
  dot.setAttribute("stroke", "none");
  const ring = document.createElementNS(svgNs, "circle");
  ring.setAttribute("cx", "12");
  ring.setAttribute("cy", "12");
  ring.setAttribute("r", "7.2");
  const ticks = document.createElementNS(svgNs, "path");
  ticks.setAttribute("d", "M12 2.5v3M12 18.5V22M2.5 12h3M18.5 12H22");
  svg.append(dot, ring, ticks);
  return svg;
}

function setGpsPressed(button: HTMLButtonElement, on: boolean): void {
  const label = on ? "Stop using device location" : "Use device location";
  button.setAttribute("aria-pressed", on ? "true" : "false");
  button.setAttribute("aria-label", label);
  button.title = label;
  button.style.background = on ? "rgba(66, 133, 244, 0.28)" : "";
  button.style.borderColor = on ? "var(--globe-accent, #60a5fa)" : "";
}

export function mountCampusDeviceGps(options: {
  document: Document;
  geolocation: CampusGeolocation | null;
  currentZoom(): number | undefined;
  onMove(view: CampusDeviceView): void;
  onFix(fix: CampusDeviceFix | null): void;
}): { element: HTMLElement; destroy(): void } {
  const { document } = options;
  const element = document.createElement("div");
  element.className = "foss-earth-location-panel";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "foss-earth-location-gps";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.gap = "6px";
  button.style.width = "max-content";
  button.append(gpsIcon(document), document.createTextNode("GPS"));
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  element.append(button, status);
  setGpsPressed(button, false);

  let active = false;
  let centered = false;
  let stop: (() => void) | null = null;
  let destroyed = false;

  const release = (message: string | null): void => {
    if (!active) return;
    active = false;
    const clear = stop;
    stop = null;
    centered = false;
    clear?.();
    setGpsPressed(button, false);
    options.onFix(null);
    status.textContent = message ?? "";
  };
  const start = (): void => {
    active = true;
    centered = false;
    setGpsPressed(button, true);
    status.textContent = "Waiting for device location…";
    let syncFailure: string | null = null;
    const clear = watchDevice(options.geolocation, (fix) => {
      if (!active) return;
      try { options.onFix(fix); }
      catch (error) {
        syncFailure = error instanceof Error ? error.message : "Unable to show device location.";
        if (stop) release(syncFailure);
        return;
      }
      if (!active) return;
      if (!centered) {
        try { options.onMove(campusDeviceView(fix, options.currentZoom())); }
        catch (error) {
          status.textContent = error instanceof Error ? error.message : "Unable to apply location.";
          return;
        }
        centered = true;
      }
      const accuracy = formatCampusAccuracy(fix.accuracyMeters);
      status.textContent = accuracy ? `Showing your position, ±${accuracy}.` : "Showing your position.";
    }, (message) => {
      if (!active) return;
      if (stop) release(message);
      else syncFailure = message;
    });
    if (!active || syncFailure) {
      active = false;
      clear();
      stop = null;
      centered = false;
      setGpsPressed(button, false);
      options.onFix(null);
      if (syncFailure) status.textContent = syncFailure;
      return;
    }
    stop = clear;
  };
  const toggle = (): void => {
    if (destroyed) return;
    if (stop) release(null);
    else start();
  };
  button.addEventListener("click", toggle);

  return {
    element,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      button.removeEventListener("click", toggle);
      if (active) release(null);
    },
  };
}

function finite(value: EcefCoord | undefined): value is EcefCoord {
  return !!value && [value.x, value.y, value.z].every(Number.isFinite);
}

function lift(point: EcefCoord, normal: EcefCoord, meters: number): EcefCoord {
  const length = Math.hypot(normal.x, normal.y, normal.z);
  if (!(length > 0)) return point;
  return {
    x: point.x + normal.x / length * meters,
    y: point.y + normal.y / length * meters,
    z: point.z + normal.z / length * meters,
  };
}

function toScene(ecef: EcefCoord, root: TransformNode | null): Vector3 {
  const point = new Vector3(ecef.x, ecef.y, ecef.z);
  return root ? Vector3.TransformCoordinates(point, root.computeWorldMatrix(true)) : point;
}

function drawCell(ctx: CanvasRenderingContext2D, origin: number, inset: number, fill: string, stroke: string | null, strokeWidth: number): void {
  const radius = CELL / 2;
  ctx.save();
  ctx.translate(origin, 0);
  ctx.clearRect(0, 0, CELL, CELL);
  ctx.beginPath();
  ctx.arc(radius, radius, Math.max(1, radius - inset), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

function accuracyDiameter(accuracyMeters: number): number {
  if (!(accuracyMeters > 0) || !(CELL > 2)) return 0;
  return accuracyMeters * 2 * CELL / (CELL - 2);
}

function screenSize(distance: number, fov: number, height: number): number {
  if (!(distance > 0) || !(fov > 0) || !(height > 0)) return 0;
  return DOT_PX * (2 * distance * Math.tan(fov / 2)) / height;
}

/** Blue screen-constant dot, plus a translucent disc whose diameter is the reported accuracy. */
export function createCampusDeviceMarker(runtime: GlobeRuntime, device: CanvasTextureDevicePorts): CampusDeviceMarker {
  let disposed = false;
  let fix: CampusDeviceFix | null = null;
  let cache: { key: string; accuracy: EcefCoord; dot: EcefCoord } | null = null;
  let manager: SpriteManager | null = null;
  let accuracy: Sprite | null = null;
  let dot: Sprite | null = null;

  const observer = runtime.scene.onBeforeRenderObservable.add(() => { place(); });

  function destroy(): void {
    if (disposed) return;
    disposed = true;
    fix = null;
    cache = null;
    try { runtime.scene.onBeforeRenderObservable.remove(observer); }
    catch { /* The scene can already be gone. */ }
    const owned = manager;
    manager = null;
    accuracy = null;
    dot = null;
    if (owned) disposeSpriteManagers([owned]);
  }

  function ensure(): void {
    if (manager || disposed) return;
    const texture = device.createTexture({ name: "device-location", width: CELL * 2, height: CELL, mipmaps: false });
    try {
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, CELL * 2, CELL);
      drawCell(ctx, 0, 1, BLUE, null, 0);
      drawCell(ctx, CELL, 5, BLUE, "white", 7);
      texture.hasAlpha = true;
      device.updateTexture(texture, false);
      manager = createPointSpriteManager({
        scene: runtime.scene, name: "device-location", capacity: 2, minCapacity: 2, texture, cellSize: CELL, isPickable: false,
      });
      manager.disableDepthWrite = true;
      manager.fogEnabled = false;
      accuracy = createPointSprite({
        manager, name: "device-location-accuracy", position: Vector3.Zero(), size: 1,
        cellIndex: 0, opacity: ACCURACY_OPACITY, isPickable: false,
      });
      dot = createPointSprite({
        manager, name: "device-location", position: Vector3.Zero(), size: 1, cellIndex: 1, isPickable: false,
      });
      accuracy.isVisible = false;
      dot.isVisible = false;
    } catch (error) {
      try { if (manager) disposeSpriteManagers([manager]); else texture.dispose(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], "Device location marker cleanup failed."); }
      manager = null;
      accuracy = null;
      dot = null;
      throw error;
    }
  }

  function placement(): { accuracy: EcefCoord; dot: EcefCoord } | null {
    if (!fix) return null;
    const revision = runtime.surface.revision?.() ?? 0;
    const key = `${fix.latDeg}:${fix.lonDeg}:${fix.accuracyMeters}:${revision}`;
    if (cache?.key === key) return cache;
    let hit: { point: EcefCoord; normal: EcefCoord } | null = null;
    try {
      const sampled = runtime.surface.sample(fix.latDeg, fix.lonDeg);
      if (sampled && finite(sampled.point) && finite(sampled.normal) && Math.hypot(sampled.normal.x, sampled.normal.y, sampled.normal.z) > 0) hit = sampled;
    } catch { hit = null; }
    const point = hit?.point ?? smoothSurfaceEcef(fix.latDeg, fix.lonDeg, 0);
    const normal = hit?.normal ?? point;
    const next = { key, accuracy: lift(point, normal, ACCURACY_LIFT_M), dot: lift(point, normal, DOT_LIFT_M) };
    cache = next;
    return next;
  }

  function place(): void {
    if (disposed || !accuracy || !dot) return;
    const at = placement();
    if (!fix || !at) {
      accuracy.isVisible = false;
      dot.isVisible = false;
      return;
    }
    const root = runtime.getWorldRoot();
    accuracy.position.copyFrom(toScene(at.accuracy, root));
    dot.position.copyFrom(toScene(at.dot, root));
    const diameter = accuracyDiameter(fix.accuracyMeters);
    accuracy.size = diameter;
    accuracy.isVisible = diameter > 0;
    const camera = runtime.scene.activeCamera;
    (camera as { computeWorldMatrix?(force: boolean): void } | null)?.computeWorldMatrix?.(true);
    const distance = camera ? Vector3.Distance(camera.globalPosition, dot.position) : 0;
    const fov = camera && "fov" in camera && typeof camera.fov === "number" ? camera.fov : 0;
    const sized = screenSize(distance, fov, runtime.scene.getEngine().getRenderHeight());
    if (sized > 0) dot.size = sized;
    dot.isVisible = true;
  }

  function show(next: CampusDeviceFix | null): void {
    if (disposed) return;
    const had = fix !== null;
    fix = next;
    cache = null;
    if (!next) {
      if (accuracy) accuracy.isVisible = false;
      if (dot) dot.isVisible = false;
      if (had) runtime.requestRender();
      return;
    }
    ensure();
    place();
    runtime.requestRender();
  }

  return { show, destroy };
}
