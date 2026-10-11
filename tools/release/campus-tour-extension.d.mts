import type { SceneCompositionExtensionOwner } from "@foss-earth/scenes/composition";
export const CAMPUS_TOUR_EXTENSION: "umn-vr.tour";
export class CampusTourExtensionError extends Error {
  readonly code: "unsupported" | "conflict" | "cancelled" | "limit";
  readonly path: string;
  constructor(code: CampusTourExtensionError["code"], path: string, message: string);
}
/** Pure UMN provenance owner; no acquisition, generic scene validation or runtime resources. */
export function createCampusTourCompositionOwner(): SceneCompositionExtensionOwner;
