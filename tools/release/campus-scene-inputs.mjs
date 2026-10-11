/** Campus authored input adapter. No acquisition, image work or generic scene producer. */
import { createHash } from "node:crypto";

export const CAMPUS_SCENE_SOURCE_PINS = Object.freeze({
  minneapolis: Object.freeze({ sha256: "4d6be0d7397a44161817e32f43ced58e94617532d35c398cbc4cf55991242ad1", sizeBytes: 305293 }),
  "st-paul": Object.freeze({ sha256: "59289674b7c4ecd378fecaaead312d8b9ff148621698255043835b2994ab9980", sizeBytes: 77830 }),
  "twin-cities": Object.freeze({ sha256: "356c1c28e6a8d4a8972cdf4066685d50ac14381753610092c999f417d0197449", sizeBytes: 19789 }),
});
export const CAMPUS_SCENE_PRODUCER_PINS = Object.freeze({
  scenes: Object.freeze({ repository: "foss-earth/scenes", revision: "f5daa60273a4b5d89ca62efec94be61bc07f6dfc", archiveSha256: "a3f6c3d5e84906dea2e10c8452f4224a4c896ebca450972b738b147d56c58ccf" }),
  preview: Object.freeze({ repository: "foss-earth/preview-sheets", revision: "4b688d341e8d557f19ef6ab19528fe541cbde1bc", archiveSha256: "254d5e36d447abdd6924d1b020ebd2df6e609f879a88ef5eaf35d6e225e2dc82" }),
  images: Object.freeze({ repository: "foss-earth/images", revision: "02523eae1c8c3acd461bfe13111116fbb8d80f28", archiveSha256: "cca1df6798d4d5eccf347ac995e00816529b84bdda7b6914268ff2998341f1f8" }),
});
const CHILDREN = ["minneapolis", "st-paul"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const encoded = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

export class CampusSceneContractError extends Error {
  constructor(code, path, message, operations = []) {
    super(`${path}: ${message}`);
    this.name = "CampusSceneContractError";
    this.code = code;
    this.path = path;
    this.operations = operations;
  }
}
function fail(code, path, message) { throw new CampusSceneContractError(code, path, message); }
function source(name, bytes) {
  const pin = CAMPUS_SCENE_SOURCE_PINS[name];
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== pin.sizeBytes || sha256(bytes) !== pin.sha256) {
    fail("source-drift", `sources.${name}`, "requires the exact retained Campus authored source bytes");
  }
  return JSON.parse(Buffer.from(bytes).toString("utf8"));
}
function finalUrl(value, path) {
  let parsed;
  try { parsed = new URL(value); } catch { fail("input", path, "requires an explicit absolute final public URL"); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
    fail("input", path, "requires a credential-free final HTTP(S) URL without a fragment");
  }
  return parsed.href;
}
function publication(value, path) {
  if (!value || typeof value.revision !== "string" || !value.revision.length) {
    fail("input", path, "requires the caller's explicit immutable revision");
  }
  return { url: finalUrl(value.url, `${path}.url`), revision: value.revision };
}
function requestChild(key, document, documentBytes, binding, media) {
  return {
    key,
    manifest: { url: binding.url, id: document.id, revision: document.revision, sha256: sha256(documentBytes), sizeBytes: documentBytes.byteLength },
    media: { ...media.index, baseUrl: media.baseUrl },
  };
}

function authoredNavigation(composition, records) {
  return composition.crossCampusNavigation.map(row => {
    const entity = records[row.sourceCampus].entities.find(item => item.id === row.sourceEntityId);
    const index = entity.links.findIndex(link => link.id === row.originalLink.id);
    const { target, ...link } = row.originalLink;
    return {
      from: { child: row.sourceCampus, id: row.sourceEntityId },
      to: { child: row.targetCampus, id: row.targetEntityId }, link,
      insertion: { index, authoredLinkOrder: entity.links.map(item => item.id) },
      standalone: row.standalone,
      // The generic port accepts registered IDs. The host owns the route path.
      destination: { id: row.targetCampus, sceneId: records[row.targetCampus].sceneId, routeId: row.targetCampus },
    };
  });
}

/**
 * Maps only the Campus authored root schema into unpublished v1 producer inputs.
 * Original link fields/order and groups remain untouched. The draft public
 * external-destination field is added only to the four authored crossing links.
 * This source mapping is UNQUALIFIED/NOT_BOUND, never a release output.
 */
export function createCampusSceneInputs({ sources, publication: publications, media }) {
  const records = Object.fromEntries(CHILDREN.map(key => [key, source(key, sources?.[key])]));
  const composition = source("twin-cities", sources?.["twin-cities"]);
  const navigation = authoredNavigation(composition, records);
  if (!(media?.inputs instanceof Map) || !media.index ||
      typeof media.index.id !== "string" || typeof media.index.revision !== "string") {
    fail("input", "media", "requires one measured shared media index and an explicitly acquired finite byte map");
  }
  const mediaIndexURL = finalUrl(media.index.url, "media.index.url");
  const mediaBaseURL = finalUrl(media.baseUrl, "media.baseUrl");
  const indexBytes = media.inputs.get(mediaIndexURL);
  if (!(indexBytes instanceof Uint8Array) || indexBytes.byteLength !== media.index.sizeBytes || sha256(indexBytes) !== media.index.sha256) {
    fail("media-drift", "media.index", "the measured index pin must match the explicit supplied bytes");
  }
  const measuredMedia = { index: { ...media.index, url: mediaIndexURL }, baseUrl: mediaBaseURL };
  const inputs = new Map(media.inputs);
  const children = {};
  for (const key of CHILDREN) {
    const authored = records[key];
    const binding = publication(publications?.[key], `publication.${key}`);
    const inputURL = finalUrl(publications?.[key]?.inputUrl, `publication.${key}.inputUrl`);
    if (inputs.has(inputURL)) fail("input", `publication.${key}.inputUrl`, "authored input URL must not overlap supplied media");
    // A direct authored-schema adapter, not a compiler: every source record is retained.
    const directions = navigation.filter(row => row.from.child === key);
    const destinations = [...new Map(directions.map(row => [row.destination.id, row.destination])).values()];
    const document = {
      format: "foss-earth-scene", version: 1,
      id: authored.sceneId, revision: `authored-${CAMPUS_SCENE_SOURCE_PINS[key].sha256.slice(0, 12)}`,
      title: authored.title, requiredExtensions: authored.requiredExtensions,
      extensions: authored.originalExtensions, assets: authored.assets,
      entities: authored.entities.map(entity => ({
        ...entity,
        links: entity.links.map(link => {
          const direction = directions.find(row => row.from.id === entity.id && row.link.id === link.id);
          return direction ? { ...link, externalDestination: direction.destination.id } : link;
        }),
      })), groups: authored.groups,
      initialPanorama: authored.initialPanorama, markerStyle: authored.markerStyle,
      externalDestinations: destinations,
    };
    const bytes = encoded(document);
    inputs.set(inputURL, bytes);
    const child = requestChild(key, document, bytes, { url: inputURL }, measuredMedia);
    children[key] = {
      authoredDocument: document, authoredInputPin: child.manifest,
      publication: binding,
      request: {
        schemaVersion: 1, id: authored.sceneId, revision: binding.revision, title: authored.title,
        children: [child], entityOrder: authored.entities.map(entity => ({ child: key, id: entity.id })),
        groupOrder: authored.groups.map(group => ({ child: key, id: group.id })),
        initialPanorama: { child: key, id: authored.initialPanorama },
      },
    };
  }
  const aggregatePublication = publication(publications?.["twin-cities"], "publication.twin-cities");
  const mixed = composition.groupOrder.find(row => row.mode === "authored-mixed-group");
  const reference = id => {
    const row = composition.entityOrder.find(item => item.entityId === id);
    if (!row) fail("input", "aggregate.entityOrder", `authored panorama ${id} has no child reference`);
    return { child: row.child, id: row.entityId };
  };
  const { members: mixedMembers, ...mixedMetadata } = mixed.group;
  const requestTemplate = {
    schemaVersion: 1, id: composition.id, revision: aggregatePublication.revision, title: composition.title,
    entityOrder: composition.entityOrder.map(row => ({ child: row.child, id: row.entityId })),
    groupOrder: composition.groupOrder.map(row => row.mode === "exact-child-group"
      ? { child: row.child, id: row.groupId } : { composed: row.group.id }),
    initialPanorama: reference(composition.initialPanorama), overview: composition.overview,
    links: navigation.map(row => ({
      from: row.from, to: row.to, link: row.link,
      consume: row.link.id, insert: { index: row.insertion.index },
    })),
    groupReplacements: [{
      consume: mixed.childProjectionSources.map(row => ({ child: row.child, id: row.groupId })),
      group: mixedMetadata, members: mixedMembers.map(reference), contextChild: "minneapolis",
    }],
  };
  const pendingOwnerBindings = [
    {
      code: "standalone-external-navigation", owner: "foss-earth/scenes", path: "children.entities.links",
      reason: "Declared ExternalDestinationRecord, LinkRecord.externalDestination and SceneExternalNavigationPorts are mapped, but the new producer/runtime archive and qualification are NOT_BOUND.",
      authored: navigation.map(row => ({ from: row.from, to: row.to, link: row.link, insertion: row.insertion, standalone: row.standalone, destination: row.destination })),
    },
    {
      code: "ordered-link-insertion", owner: "foss-earth/scenes", path: "SceneCompositionRequest.links",
      reason: "Declared links.consume and links.insert map each existing crossing link exactly once at its authored index. The new owner archive and qualification are NOT_BOUND.",
      authored: navigation.filter(row => row.link.id === "next-stop"),
    },
    {
      code: "consume-replace-mixed-group", owner: "foss-earth/scenes", path: "SceneCompositionRequest.groupOrder",
      reason: "Declared groupReplacements and groupOrder.composed consume both child projections and retain the original mixed group. The new owner archive and qualification are NOT_BOUND.",
      authored: mixed,
    },
  ];
  return {
    status: "source-prepared-unqualified-not-bound",
    sourcePins: CAMPUS_SCENE_SOURCE_PINS, producerPins: CAMPUS_SCENE_PRODUCER_PINS,
    ownerContractBinding: {
      state: "UNQUALIFIED_NOT_BOUND",
      acceptedArtifactsRetained: true,
      declaredExternalContract: {
        destination: "ExternalDestinationRecord",
        linkField: "LinkRecord.externalDestination",
        runtime: "LoadSceneOptions.externalNavigation.navigate",
      },
      declaredCompositionContract: {
        linkConsumption: "SceneCompositionLink.consume", linkInsertion: "SceneCompositionLink.insert",
        groupReplacement: "SceneCompositionRequest.groupReplacements", groupOrder: "SceneCompositionGroupReference.composed",
      },
    },
    inputs, children, media: measuredMedia,
    aggregate: {
      publication: aggregatePublication, id: composition.id, title: composition.title,
      entityOrder: composition.entityOrder.map(row => ({ child: row.child, id: row.entityId })),
      groupOrder: composition.groupOrder, initialPanorama: composition.initialPanorama,
      overview: composition.overview, markerStyle: composition.markerStyle,
      navigation, mixedGroup: mixed, requestTemplate,
    },
    missingOperations: [], pendingOwnerBindings,
    counts: {
      minneapolisPanoramas: records.minneapolis.entities.length,
      stPaulPanoramas: records["st-paul"].entities.length,
      aggregatePanoramas: composition.entityOrder.length,
      originalLinks: CHILDREN.reduce((sum, child) => sum + records[child].entities.reduce((n, entity) => n + entity.links.length, 0), 0),
      crossCampusDirections: navigation.length, aggregateGroups: composition.groupOrder.length,
    },
  };
}

/** No partial/parity-weakened release is produced under the accepted public API. */
export function requireCampusSceneParity(recipe, { sourcePreparationOnly = false } = {}) {
  if (recipe.missingOperations.length) {
    throw new CampusSceneContractError("shared-contract", "foss-earth/scenes/composition", recipe.missingOperations.map(row => `${row.code}: ${row.reason}`).join(" "), recipe.missingOperations);
  }
  if (!sourcePreparationOnly && recipe.ownerContractBinding.state === "UNQUALIFIED_NOT_BOUND") {
    throw new CampusSceneContractError("shared-contract", "foss-earth/scenes/composition", "All three declared operations are source prepared. New checked owner archives, effective source checkpoints and qualification receipts remain NOT_BOUND; this recipe cannot be accepted or published.", recipe.pendingOwnerBindings);
  }
}

/** Pins actual independently prepared child producer results for the thin aggregate. */
export function createCampusAggregateInputs(recipe, results) {
  requireCampusSceneParity(recipe, { sourcePreparationOnly: true });
  const inputs = new Map(recipe.inputs);
  const children = CHILDREN.map(key => {
    const result = results?.[key], child = recipe.children[key];
    if (!result || typeof result.manifest !== "string" ||
        result.document?.id !== child.authoredDocument.id || result.document.revision !== child.publication.revision) {
      fail("child-drift", `results.${key}`, "requires the actual child producer document with its declared publication ID/revision");
    }
    const bytes = Buffer.from(result.manifest, "utf8");
    if (bytes.byteLength !== result.sizeBytes || sha256(bytes) !== result.sha256 ||
        JSON.stringify(JSON.parse(result.manifest)) !== JSON.stringify(result.document)) {
      fail("child-drift", `results.${key}`, "producer manifest bytes/document/SHA/length must agree exactly");
    }
    if (inputs.has(child.publication.url)) fail("input", `publication.${key}.url`, "published child URL must not overlap another declared input");
    inputs.set(child.publication.url, bytes);
    return requestChild(key, result.document, bytes, child.publication, recipe.media);
  });
  return {
    status: "source-prepared-unqualified-not-bound",
    inputs, request: { ...recipe.aggregate.requestTemplate, children },
    publishedChildPins: children.map(child => child.manifest),
  };
}
