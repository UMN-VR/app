/** Actual public producers only; no media acquisition or local generic composition. */
import { composeScenes } from "@foss-earth/scenes/composition-node";
import { createNodePreviewSheetsCompositionOwner } from "@foss-earth/preview-sheets/composition-node";
import { createCampusTourCompositionOwner } from "./campus-tour-extension.mjs";
import { createCampusSceneInputs, createCampusAggregateInputs, requireCampusSceneParity, CAMPUS_SCENE_PRODUCER_PINS } from "./campus-scene-inputs.mjs";

/**
 * Real public request producer. Its output is solely the Scenes result, with the
 * production Preview verifier and Campus provenance owner explicitly installed.
 * Caller owns artifact qualification, finite acquired bytes, limits and cleanup.
 */
export function composeCampusSceneInput(request, { inputs, limits, previewSheets, signal }) {
  return composeScenes(request, {
    inputs, limits, signal,
    extensions: [
      createNodePreviewSheetsCompositionOwner(previewSheets),
      createCampusTourCompositionOwner(),
    ],
  });
}

/**
 * Full preparation uses only actual producer results. The caller must explicitly
 * request unqualified source preparation; the default path rejects NOT_BOUND.
 * This returns no partial result, writes nothing and never publishes a release.
 * No unchecked/partial output or workaround is substituted for a producer result.
 */
export function prepareCampusScenes(options) {
  const recipe = createCampusSceneInputs(options);
  requireCampusSceneParity(recipe, { sourcePreparationOnly: options.sourcePreparationOnly === true });
  const producerOptions = { inputs: recipe.inputs, limits: options.limits, previewSheets: options.previewSheets, signal: options.signal };
  const children = {
    minneapolis: composeCampusSceneInput(recipe.children.minneapolis.request, producerOptions),
    "st-paul": composeCampusSceneInput(recipe.children["st-paul"].request, producerOptions),
  };
  const aggregateInputs = createCampusAggregateInputs(recipe, children);
  const aggregate = composeCampusSceneInput(aggregateInputs.request, { ...producerOptions, inputs: aggregateInputs.inputs });
  return {
    status: "source-prepared-unqualified-not-bound", publicationAllowed: false,
    ownerContractBinding: recipe.ownerContractBinding, producerPins: CAMPUS_SCENE_PRODUCER_PINS,
    children, aggregate, aggregateRequest: aggregateInputs.request,
    publishedChildPins: aggregateInputs.publishedChildPins, authoredCounts: recipe.counts,
  };
}

/** The maintained caller authenticates actual provider archives/receipts and installed
 * files before supplying this explicit binding; source preparation stays separate. */
export function prepareQualifiedCampusScenes(options) {
  const binding = options.producerBinding;
  const operations = ['standalone-external-navigation', 'ordered-link-insertion', 'consume-replace-mixed-group'];
  if (binding?.schemaVersion !== 1 || binding.state !== 'QUALIFIED_LOCAL_CANDIDATE'
    || JSON.stringify(binding.operations) !== JSON.stringify(operations)
    || !Array.isArray(binding.providers) || binding.providers.length !== 3
    || ['scenes','preview-sheets','images'].some(owner => binding.providers.filter(pin => pin.repository === `foss-earth/${owner}`).length !== 1)
    || binding.providers.some(pin => !/^[a-f0-9]{40}$/.test(pin.sourceIdentity)
      || !/^[a-f0-9]{64}$/.test(pin.archiveSha256) || !/^[a-f0-9]{64}$/.test(pin.qualificationReceiptSha256))) {
    throw new Error('Three exact qualified public producer bindings and all required operations are needed');
  }
  const produced = prepareCampusScenes({ ...options, sourcePreparationOnly:true });
  return { ...produced, status:'prepared-qualified-local-candidate', publicationAllowed:true,
    ownerContractBinding:binding, producerPins:binding.providers };
}
export { createCampusSceneInputs, createCampusAggregateInputs, requireCampusSceneParity, CAMPUS_SCENE_PRODUCER_PINS };
