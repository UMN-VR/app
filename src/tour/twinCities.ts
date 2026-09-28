import { mountGlobeApp } from "foss-earth";
import { TWIN_CITIES } from "./scenes";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Expected to find a root element with id "root".');
}

// FOSS Earth's globe as it is, offering this tour's scene and opening it.
mountGlobeApp(rootElement, { scenes: [TWIN_CITIES], initialScene: TWIN_CITIES.id }).catch((error: unknown) => {
  console.error("The tour could not start.", error);
  rootElement.innerHTML = '<div class="boot-error">The tour could not start.</div>';
});
