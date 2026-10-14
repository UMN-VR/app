import type { SettingsRegistry } from "@foss-earth/ui/settings";
import type { ImageRepresentation } from "@foss-earth/images";
import type { BuiltInRepresentation, ViewerRepresentation } from "@foss-earth/image-viewer";

/** Own a contiguous ArrayBuffer before passing a possibly shared/subarray view to Blob. */
export function copyCampusCodecInput(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/** The representation owner validates its own spatial fields before estimating their cost. */
export function estimateCampusImage(record: ImageRepresentation,
  representations: readonly ViewerRepresentation<BuiltInRepresentation>[], maxTextureSide: number, baseUrl: string) {
  const owner = representations.find(candidate => candidate.hooks.projection === record.projection);
  if (!owner) throw new Error(`No representation owner for ${record.projection}.`);
  const checked = owner.hooks.validate(record, { path: `Campus image ${record.id}`, baseUrl });
  if (!checked.ok) throw new Error(`Invalid Campus image representation: ${checked.errors.map(error => `${error.path}: ${error.message}`).join("; ")}`);
  return owner.hooks.estimate(checked.representation, { maxTextureSide });
}

/** Registry changes are a ReadonlySet; coalesce owner updates once per notification. */
export function subscribeCampusResourceSettings(settings: Pick<SettingsRegistry, "subscribe">,
  resourceParameterIds: readonly string[], ports: { updateResources(): void; updateSavedImages(): void }) {
  return settings.subscribe(changed => {
    if (resourceParameterIds.some(id => changed.has(id))) ports.updateResources();
    if (changed.has("scene.panorama.savedMiB")) ports.updateSavedImages();
  });
}
