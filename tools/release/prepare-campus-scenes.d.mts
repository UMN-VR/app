import type { SceneArtifactPin, SceneCompositionLimits, SceneCompositionRequest, SceneCompositionResult } from "@foss-earth/scenes/composition";
import type { NodePreviewSheetsCompositionOptions } from "@foss-earth/preview-sheets/composition-node";
export type CampusChild = "minneapolis" | "st-paul";
export type CampusScene = CampusChild | "twin-cities";
export interface CampusSceneProductionInput {
  sources: Readonly<Record<CampusScene, Uint8Array>>;
  publication: Readonly<Record<CampusScene, { url: string; revision: string; inputUrl?: string }>>;
  media: {
    index: SceneArtifactPin & { id: string; revision: string };
    baseUrl: string;
    inputs: ReadonlyMap<string, Uint8Array>;
  };
  limits?: Partial<SceneCompositionLimits>;
  previewSheets?: NodePreviewSheetsCompositionOptions;
  signal?: AbortSignal;
  /** Explicit unqualified preparation only; default invocation rejects NOT_BOUND. */
  sourcePreparationOnly?: true;
}
export interface CampusSceneMissingOperation {
  code: "standalone-external-navigation" | "ordered-link-insertion" | "consume-replace-mixed-group";
  owner: "foss-earth/scenes";
  path: string;
  reason: string;
  authored: unknown;
}
export interface CampusSceneInputRecipe {
  status: "source-prepared-unqualified-not-bound";
  sourcePins: Readonly<Record<CampusScene, { sha256: string; sizeBytes: number }>>;
  producerPins: typeof CAMPUS_SCENE_PRODUCER_PINS;
  ownerContractBinding: {
    state: "UNQUALIFIED_NOT_BOUND";
    acceptedArtifactsRetained: true;
    declaredExternalContract: {
      destination: "ExternalDestinationRecord";
      linkField: "LinkRecord.externalDestination";
      runtime: "LoadSceneOptions.externalNavigation.navigate";
    };
    declaredCompositionContract: {
      linkConsumption: "SceneCompositionLink.consume";
      linkInsertion: "SceneCompositionLink.insert";
      groupReplacement: "SceneCompositionRequest.groupReplacements";
      groupOrder: "SceneCompositionGroupReference.composed";
    };
  };
  inputs: ReadonlyMap<string, Uint8Array>;
  children: Readonly<Record<CampusChild, {
    authoredDocument: unknown;
    authoredInputPin: SceneArtifactPin & { id: string; revision: string };
    publication: { url: string; revision: string };
    request: SceneCompositionRequest;
  }>>;
  media: { index: SceneArtifactPin & { id: string; revision: string }; baseUrl: string };
  aggregate: {
    publication: { url: string; revision: string };
    id: string; title: string;
    entityOrder: SceneCompositionRequest["entityOrder"];
    groupOrder: readonly unknown[];
    initialPanorama: string;
    overview: SceneCompositionRequest["overview"];
    markerStyle: unknown;
    navigation: readonly unknown[];
    mixedGroup: unknown;
    requestTemplate: Omit<SceneCompositionRequest, "children">;
  };
  missingOperations: readonly CampusSceneMissingOperation[];
  pendingOwnerBindings: readonly CampusSceneMissingOperation[];
  counts: { minneapolisPanoramas: number; stPaulPanoramas: number; aggregatePanoramas: number; originalLinks: number; crossCampusDirections: number; aggregateGroups: number };
}
export const CAMPUS_SCENE_PRODUCER_PINS: Readonly<Record<"scenes" | "preview" | "images", { repository: string; revision: string; archiveSha256: string }>>;
export function createCampusSceneInputs(options: CampusSceneProductionInput): CampusSceneInputRecipe;
export function requireCampusSceneParity(recipe: CampusSceneInputRecipe, options?: { sourcePreparationOnly?: true }): void;
export type CampusSceneProducedChild = Pick<SceneCompositionResult, "document" | "manifest" | "sha256" | "sizeBytes">;
export function createCampusAggregateInputs(recipe: CampusSceneInputRecipe, children: Readonly<Record<CampusChild, CampusSceneProducedChild>>): {
  status: "source-prepared-unqualified-not-bound";
  inputs: ReadonlyMap<string, Uint8Array>;
  request: SceneCompositionRequest;
  publishedChildPins: readonly (SceneArtifactPin & { id: string; revision: string })[];
};
export function composeCampusSceneInput(request: SceneCompositionRequest, options: {
  inputs: ReadonlyMap<string, Uint8Array>; limits?: Partial<SceneCompositionLimits>;
  previewSheets?: NodePreviewSheetsCompositionOptions; signal?: AbortSignal;
}): SceneCompositionResult;
export interface CampusScenePreparationResult {
  status: "source-prepared-unqualified-not-bound";
  publicationAllowed: false;
  ownerContractBinding: CampusSceneInputRecipe["ownerContractBinding"];
  producerPins: typeof CAMPUS_SCENE_PRODUCER_PINS;
  children: Readonly<Record<CampusChild, SceneCompositionResult>>;
  aggregate: SceneCompositionResult;
  aggregateRequest: SceneCompositionRequest;
  publishedChildPins: readonly (SceneArtifactPin & { id: string; revision: string })[];
  authoredCounts: CampusSceneInputRecipe["counts"];
}
/** Default rejects NOT_BOUND; explicit source preparation returns three complete real producer results only. */
export function prepareCampusScenes(options: CampusSceneProductionInput): CampusScenePreparationResult;

export interface CampusQualifiedProducerBinding {
  schemaVersion:1; state:'QUALIFIED_LOCAL_CANDIDATE';
  operations:readonly ['standalone-external-navigation','ordered-link-insertion','consume-replace-mixed-group'];
  providers:readonly {repository:string;sourceIdentity:string;archiveSha256:string;qualificationReceiptSha256:string}[];
}
export function prepareQualifiedCampusScenes(options:CampusSceneProductionInput & {producerBinding:CampusQualifiedProducerBinding}):
  Omit<CampusScenePreparationResult,'status'|'publicationAllowed'|'ownerContractBinding'|'producerPins'> & {
    status:'prepared-qualified-local-candidate'; publicationAllowed:true;
    ownerContractBinding:CampusQualifiedProducerBinding;producerPins:CampusQualifiedProducerBinding['providers'];
  };
