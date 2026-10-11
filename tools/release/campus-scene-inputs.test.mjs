// Authored adapter assertions only. SOURCE PREPARED; these new cases are UNRUN.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCampusSceneInputs, createCampusAggregateInputs, requireCampusSceneParity, CampusSceneContractError } from "./campus-scene-inputs.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const source = (repo, name) => readFileSync(new URL(`../../../${repo}/content/${name}`, import.meta.url));
const sources = {
  minneapolis: source("minneapolis", "scene-records.json"),
  "st-paul": source("st-paul", "scene-records.json"),
  "twin-cities": source("twin-cities", "composition.json"),
};
const sourcesBefore = Object.fromEntries(Object.entries(sources).map(([key, bytes]) => [key, sha(bytes)]));
function input() {
  // Deliberately tiny declared input, not a qualified Campus media release or oracle.
  const bytes = Buffer.from('{"format":"foss-earth-scene-media","version":1,"id":"test-only","revision":"test-only","files":[]}\n');
  return {
    sources,
    publication: Object.fromEntries(["minneapolis", "st-paul", "twin-cities"].map(key => [key, {
      url: `https://example.invalid/${key}/scene.json`, revision: "test-only-unpublished",
      inputUrl: `https://example.invalid/authoring/${key}.json`,
    }])),
    media: {
      index: { url: "https://example.invalid/media/index.json", id: "test-only", revision: "test-only", sha256: sha(bytes), sizeBytes: bytes.length },
      baseUrl: "https://example.invalid/media/", inputs: new Map([["https://example.invalid/media/index.json", bytes]]),
    },
  };
}

test("retains 48/12 authored panoramas, every one of 134 links and the 24-group aggregate plan", () => {
  const recipe = createCampusSceneInputs(input());
  assert.deepEqual(recipe.counts, { minneapolisPanoramas: 48, stPaulPanoramas: 12, aggregatePanoramas: 60, originalLinks: 134, crossCampusDirections: 4, aggregateGroups: 24 });
  for (const child of ["minneapolis", "st-paul"]) {
    const authored = JSON.parse(sources[child]);
    const actual = recipe.children[child].authoredDocument;
    assert.deepEqual(actual.assets, authored.assets);
    assert.deepEqual(actual.entities.map(entity => ({ ...entity, links: entity.links.map(link => { const authoredLink = { ...link }; delete authoredLink.externalDestination; return authoredLink; }) })), authored.entities);
    assert.deepEqual(actual.groups, authored.groups);
    assert.deepEqual(actual.extensions, authored.originalExtensions);
    assert.deepEqual(actual.markerStyle, authored.markerStyle);
  }
});

test("maps only the four authored crossing links to declared external identities with registered route IDs", () => {
  const recipe = createCampusSceneInputs(input());
  assert.deepEqual(recipe.children.minneapolis.authoredDocument.externalDestinations,
    [{ id: "st-paul", sceneId: "umn-st-paul", routeId: "st-paul" }]);
  assert.deepEqual(recipe.children["st-paul"].authoredDocument.externalDestinations,
    [{ id: "minneapolis", sceneId: "umn-minneapolis", routeId: "minneapolis" }]);
  const external = Object.entries(recipe.children).flatMap(([child, record]) => record.authoredDocument.entities.flatMap(entity =>
    entity.links.filter(link => link.externalDestination).map(link => [child, entity.id, link.id, link.target, link.externalDestination])));
  assert.deepEqual(external, [
    ["minneapolis", "regis-center-for-art-gallery", "next-stop", "saint-paul-campus", "st-paul"],
    ["minneapolis", "recreation-and-wellness-center", "previous-stop", "community-connections", "st-paul"],
    ["st-paul", "saint-paul-campus", "previous-stop", "regis-center-for-art-gallery", "minneapolis"],
    ["st-paul", "community-connections", "next-stop", "recreation-and-wellness-center", "minneapolis"],
  ]);
  for (const record of Object.values(recipe.children)) {
    for (const destination of record.authoredDocument.externalDestinations) {
      assert.equal(Object.hasOwn(destination, "url"), false);
      assert.match(destination.routeId, /^[a-z-]+$/);
    }
  }
});

test("keeps new declared owner contracts unqualified and accepted artifact pins unchanged", () => {
  const recipe = createCampusSceneInputs(input());
  assert.equal(recipe.status, "source-prepared-unqualified-not-bound");
  assert.equal(recipe.ownerContractBinding.state, "UNQUALIFIED_NOT_BOUND");
  assert.equal(recipe.ownerContractBinding.acceptedArtifactsRetained, true);
  assert.deepEqual(recipe.producerPins.scenes, {
    repository: "foss-earth/scenes", revision: "f5daa60273a4b5d89ca62efec94be61bc07f6dfc",
    archiveSha256: "a3f6c3d5e84906dea2e10c8452f4224a4c896ebca450972b738b147d56c58ccf",
  });
  assert.equal(recipe.ownerContractBinding.declaredExternalContract.runtime, "LoadSceneOptions.externalNavigation.navigate");
  assert.throws(() => requireCampusSceneParity(recipe), error => error.code === "shared-contract");
});

test("retains next-stop before previous-stop, all four external intentions and mixed retired provenance", () => {
  const recipe = createCampusSceneInputs(input());
  const next = recipe.aggregate.navigation.filter(row => row.link.id === "next-stop");
  assert.equal(next.length, 2);
  for (const row of next) {
    assert.equal(row.insertion.authoredLinkOrder[row.insertion.index], "next-stop");
    assert.equal(row.insertion.authoredLinkOrder[row.insertion.index + 1], "previous-stop");
    assert.equal(row.standalone.targetPanoramaId, row.to.id);
    assert.equal(row.standalone.mode, "external-scene-route");
  }
  assert.deepEqual(recipe.aggregate.mixedGroup.group.members, ["folwell-hall", "huntington-bank-stadium", "mcneal-hall", "st-paul-mall"]);
  assert.deepEqual(recipe.aggregate.mixedGroup.group.extensions["umn-vr.tour"].youvisitStops, [306371, 306364, 306366, 306365]);
  assert.deepEqual(recipe.aggregate.mixedGroup.childProjectionSources, [{ child: "minneapolis", groupId: "earlier-tour-stops" }, { child: "st-paul", groupId: "earlier-tour-stops" }]);
});

test("uses one explicit media map and preserves source and acquired bytes unchanged", () => {
  const options = input();
  const indexBefore = sha(options.media.inputs.get(options.media.index.url));
  const recipe = createCampusSceneInputs(options);
  assert.equal(recipe.inputs.size, options.media.inputs.size + 2);
  for (const [child, bytes] of Object.entries(sources)) assert.equal(sha(bytes), sourcesBefore[child]);
  assert.equal(sha(options.media.inputs.get(options.media.index.url)), indexBefore);
  assert.equal(recipe.children.minneapolis.request.children[0].media.url, recipe.children["st-paul"].request.children[0].media.url);
  assert.equal(recipe.children.minneapolis.request.children[0].media.sha256, recipe.children["st-paul"].request.children[0].media.sha256);
});

test("default acceptance rejects NOT_BOUND despite all three declared operations being source prepared", () => {
  const recipe = createCampusSceneInputs(input());
  assert.deepEqual(recipe.missingOperations, []);
  assert.doesNotThrow(() => requireCampusSceneParity(recipe, { sourcePreparationOnly: true }));
  assert.throws(() => requireCampusSceneParity(recipe), error => {
    assert.ok(error instanceof CampusSceneContractError);
    assert.equal(error.code, "shared-contract");
    assert.deepEqual(error.operations.map(row => row.code), ["standalone-external-navigation", "ordered-link-insertion", "consume-replace-mixed-group"]);
    assert.equal(error.operations.every(row => row.owner === "foss-earth/scenes"), true);
    return true;
  });
});

test("actual public request consumes four crossing links and two group projections in authored order", () => {
  const recipe = createCampusSceneInputs(input());
  const request = recipe.aggregate.requestTemplate;
  assert.equal(request.links.length, 4);
  for (const row of request.links) {
    assert.equal(row.consume, row.link.id);
    const original = JSON.parse(sources[row.from.child]).entities.find(entity => entity.id === row.from.id).links;
    assert.equal(original[row.insert.index].id, row.consume);
    if (row.link.id === "next-stop") assert.equal(original[row.insert.index + 1].id, "previous-stop");
    assert.equal(Object.hasOwn(row.link, "externalDestination"), false);
  }
  assert.equal(request.groupOrder.length, 24);
  assert.deepEqual(request.groupOrder.at(-1), { composed: "earlier-tour-stops" });
  assert.equal(request.groupReplacements.length, 1);
  const replacement = request.groupReplacements[0];
  assert.deepEqual(replacement.consume, [
    { child: "minneapolis", id: "earlier-tour-stops" }, { child: "st-paul", id: "earlier-tour-stops" },
  ]);
  assert.deepEqual(replacement.members, [
    { child: "minneapolis", id: "folwell-hall" }, { child: "minneapolis", id: "huntington-bank-stadium" },
    { child: "st-paul", id: "mcneal-hall" }, { child: "st-paul", id: "st-paul-mall" },
  ]);
  const original = JSON.parse(sources["twin-cities"]).groupOrder.at(-1).group;
  assert.deepEqual({ ...replacement.group, members: replacement.members.map(row => row.id) }, original);
  assert.equal(replacement.contextChild, "minneapolis");
  assert.deepEqual(request.initialPanorama, { child: "minneapolis", id: "northrop-mall" });
});

test("thin aggregate binds exact independently produced child manifests and rejects child drift", () => {
  const options = input(), recipe = createCampusSceneInputs(options);
  // Authored metadata fixtures, not a producer/content qualification oracle.
  const fixtureResult = key => {
    const child = recipe.children[key];
    const document = { ...child.authoredDocument, revision: child.publication.revision };
    const manifest = `${JSON.stringify(document, null, 2)}\n`, bytes = Buffer.from(manifest);
    return { document, manifest, sha256: sha(bytes), sizeBytes: bytes.length };
  };
  const children = { minneapolis: fixtureResult("minneapolis"), "st-paul": fixtureResult("st-paul") };
  const aggregate = createCampusAggregateInputs(recipe, children);
  assert.equal(aggregate.status, "source-prepared-unqualified-not-bound");
  assert.equal(aggregate.inputs.size, recipe.inputs.size + 2);
  for (const child of aggregate.request.children) {
    const produced = children[child.key];
    assert.equal(child.manifest.url, options.publication[child.key].url);
    assert.equal(child.manifest.sha256, produced.sha256);
    assert.equal(child.manifest.sizeBytes, produced.sizeBytes);
    assert.equal(child.manifest.revision, options.publication[child.key].revision);
    assert.notEqual(child.manifest.url, recipe.children[child.key].authoredInputPin.url);
    assert.equal(child.media.url, recipe.media.index.url);
    assert.equal(sha(aggregate.inputs.get(child.manifest.url)), produced.sha256);
  }
  assert.equal(recipe.inputs.size, options.media.inputs.size + 2);
  const wrong = { ...children, minneapolis: { ...children.minneapolis, sha256: "0".repeat(64) } };
  assert.throws(() => createCampusAggregateInputs(recipe, wrong), error => error.code === "child-drift");
  const wrongIdentity = { ...children, "st-paul": { ...children["st-paul"], document: { ...children["st-paul"].document, id: "wrong-scene" } } };
  assert.throws(() => createCampusAggregateInputs(recipe, wrongIdentity), error => error.code === "child-drift");
});

test("rejects authored-source byte drift and mismatched measured index before adaptation", () => {
  const options = input();
  options.sources = { ...sources, minneapolis: Buffer.concat([sources.minneapolis, Buffer.from(" ")]) };
  assert.throws(() => createCampusSceneInputs(options), error => error.code === "source-drift");
  const wrongMedia = input();
  wrongMedia.media.index = { ...wrongMedia.media.index, sha256: "0".repeat(64) };
  assert.throws(() => createCampusSceneInputs(wrongMedia), error => error.code === "media-drift");
});
