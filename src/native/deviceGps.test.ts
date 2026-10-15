// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { campusDeviceView, mountCampusDeviceGps, type CampusGeolocation } from "./deviceGps";

function port() {
  const handlers: {
    success: ((position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | null;
    failure: ((error: { code: number }) => void) | null;
  } = { success: null, failure: null };
  const clearWatch = vi.fn();
  const geolocation: CampusGeolocation = {
    watchPosition(success, failure) {
      handlers.success = success;
      handlers.failure = failure ?? null;
      return 7;
    },
    clearWatch,
  };
  return { geolocation, handlers, clearWatch };
}

function mounted(geolocation: CampusGeolocation | null, zoom: number | undefined = 20_000) {
  const onMove = vi.fn();
  const onFix = vi.fn();
  const gps = mountCampusDeviceGps({
    document, geolocation, currentZoom: () => zoom, onMove, onFix,
  });
  document.body.append(gps.element);
  const button = gps.element.querySelector("button");
  const status = gps.element.querySelector("[role='status']");
  if (!button || !status) throw new Error("GPS controls were not created.");
  return { gps, button, status, onMove, onFix };
}

describe("campus device location", () => {
  it("keeps a close view's distance and recenters only on the first fix", () => {
    expect(campusDeviceView({ latDeg: 45, lonDeg: -93, accuracyMeters: 12 }, 400)).toEqual({ latDeg: 45, lonDeg: -93 });
    expect(campusDeviceView({ latDeg: 45, lonDeg: -93, accuracyMeters: 12 }, undefined).zoomMeters).toBe(1_500);
    const { geolocation, handlers, clearWatch } = port();
    const { gps, button, status, onMove, onFix } = mounted(geolocation, 400);
    try {
      button.click();
      expect(button.getAttribute("aria-pressed")).toBe("true");
      handlers.success?.({ coords: { latitude: 44.97, longitude: -93.23, accuracy: 12.2 } });
      expect(onMove).toHaveBeenCalledExactlyOnceWith({ latDeg: 44.97, lonDeg: -93.23 });
      expect(onFix).toHaveBeenCalledExactlyOnceWith({ latDeg: 44.97, lonDeg: -93.23, accuracyMeters: 12.2 });
      expect(status.textContent).toBe("Showing your position, ±12 m.");
      handlers.success?.({ coords: { latitude: 44.98, longitude: -93.22, accuracy: 8 } });
      expect(onMove).toHaveBeenCalledOnce();
      expect(onFix).toHaveBeenLastCalledWith({ latDeg: 44.98, lonDeg: -93.22, accuracyMeters: 8 });
      button.click();
      expect(clearWatch).toHaveBeenCalledExactlyOnceWith(7);
      expect(onFix).toHaveBeenLastCalledWith(null);
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(status.textContent).toBe("");
    } finally { gps.destroy(); }
  });

  it("brings a distant view in, then stops when permission is denied", () => {
    const { geolocation, handlers } = port();
    const { gps, button, status, onMove, onFix } = mounted(geolocation);
    try {
      button.click();
      handlers.success?.({ coords: { latitude: 10, longitude: 20, accuracy: 20_400 } });
      expect(onMove).toHaveBeenCalledExactlyOnceWith({ latDeg: 10, lonDeg: 20, zoomMeters: 1_500 });
      expect(status.textContent).toBe("Showing your position, ±20 km.");
      handlers.failure?.({ code: 1 });
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(status.textContent).toBe("Location permission was denied.");
      expect(onFix).toHaveBeenLastCalledWith(null);
    } finally { gps.destroy(); }
  });

  it("says device location is unavailable when the browser has none", () => {
    const { gps, button, status, onMove, onFix } = mounted(null);
    try {
      button.click();
      expect(onMove).not.toHaveBeenCalled();
      expect(onFix).toHaveBeenCalledExactlyOnceWith(null);
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(status.textContent).toBe("Device location is unavailable.");
    } finally { gps.destroy(); }
  });
});
