import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSceneFiles, validateScene } from "foss-earth/scenes";
import { TWIN_CITIES } from "./scenes";

const site = new URL("../../public/", import.meta.url);
// Validate local generated content even when a build selects a remote release.
const published = new URL("tour/twin-cities/scene.json", "https://umn-vr.github.io/");
/** A published URL's file in public/. */
const fileOf = (url: string) => new URL(`.${new URL(url).pathname}`, site);

describe("the Twin Cities tour's scene", () => {
  const result = validateScene(readFileSync(fileOf(published.href), "utf8"), { baseUrl: published.href });

  it("is a valid generated scene", () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("has every image it declares, as declared", () => {
    if (!result.ok) throw new Error("the scene is not valid");
    const report = checkSceneFiles(result.scene, url => (existsSync(fileOf(url)) ? new Uint8Array(readFileSync(fileOf(url))) : null));
    expect(report.problems).toEqual([]);
    // Six faces for each of three preview cubes, and three whole images.
    expect(report.files).toBe(result.scene.assets.size * 21);
  });

  it("opens on the tour's first stop", () => {
    if (!result.ok) throw new Error("the scene is not valid");
    expect(result.scene.initialPanorama).toBe("northrop-mall");
    expect(result.scene.groups[0].title).toBe("1. Welcome to the UMN Twin Cities (feat. Northrop Mall)");
  });
});

describe("the tour's content location", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("uses the packaged scene by default and can point at a content release", async () => {
    vi.stubEnv("VITE_TOUR_SCENE_URL", "");
    vi.resetModules();
    expect((await import("./scenes")).TWIN_CITIES.url).toBe(published.pathname.slice(1));
    vi.stubEnv("VITE_TOUR_SCENE_URL", " https://content.example.org/twin-cities/r2/scene.json ");
    vi.resetModules();
    const configured = (await import("./scenes")).TWIN_CITIES;
    expect(configured.id).toBe(TWIN_CITIES.id);
    expect(configured.url).toBe("https://content.example.org/twin-cities/r2/scene.json");
  });
});
