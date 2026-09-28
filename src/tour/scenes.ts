import type { SceneExample } from "foss-earth/scenes";

/**
 * The Twin Cities campus tour. tools/twin-cities/build-scene.mjs writes it into
 * public/, and its URL resolves against the site's base URL.
 */
export const TWIN_CITIES: SceneExample = {
  id: "twin-cities",
  title: "Twin Cities campus",
  description: "The University of Minnesota Twin Cities campus tour: 60 panoramas in 23 stops, from Northrop Mall to the Saint Paul campus.",
  url: "tour/twin-cities/scene.json",
};
