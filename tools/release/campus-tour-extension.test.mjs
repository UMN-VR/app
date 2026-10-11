import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_TOUR_EXTENSION, CampusTourExtensionError, createCampusTourCompositionOwner } from "./campus-tour-extension.mjs";

const provenance = () => ({
  source: "YouVisit tour 60288 (location 80239, tour3), backed up 2026-09-27",
  build: "tools/twin-cities/build-scene.mjs",
  placements: "tools/twin-cities/placements.json",
  positions: "Capture positions are approximate; © OpenStreetMap contributors, ODbL 1.0.",
  north: "0 of 60 panoramas have north set; the others face an arbitrary direction.",
});
const entity = () => ({
  youvisit: { panoramas: [363732, 368158], stops: [306400], retiredStop: 306364 },
  capture: "Approximate original authored capture position.",
  north: { provenance: "Not aligned: YouVisit's images carry no orientation, so north is unknown." },
});
const limits = { children: 2, jsonNodes: 1000, jsonDepth: 16, manifestBytes: 4096 };
const child = key => ({ key, baseUrl: `https://campus.example/${key}/scene.json`, resolveId: (_kind, id) => `alias-${id}` });
const entry = (key, value = provenance()) => ({ value, path: `$children.${key}.extensions.umn-vr.tour`, child: child(key) });
function setup(entries = [entry("minneapolis"), entry("st-paul")], options = {}) {
  const owner = createCampusTourCompositionOwner();
  const result = owner.composeDocument(entries, { limits, ...options });
  return { owner, ...result };
}
function rewrite(host, value, scope = "entity", record = { id: "alias-huntington-bank-stadium", type: "panorama" }) {
  return host.owner.rewrite(value, { scope, path: `$.${scope}.extensions.umn-vr.tour`, child: child("minneapolis"), state: host.state, record });
}
function rejects(run, code, pathPart) {
  assert.throws(run, error => error instanceof CampusTourExtensionError && error.code === code && (!pathPart || error.path.includes(pathPart)));
}

test("declared owner methods and identical root provenance emit one independent record", () => {
  const first = entry("minneapolis"), second = entry("st-paul", Object.fromEntries(Object.entries(provenance()).reverse()));
  const before = structuredClone([first.value, second.value]);
  const host = setup([first, second]);
  assert.equal(host.owner.name, CAMPUS_TOUR_EXTENSION);
  assert.equal(host.owner.validation.name, CAMPUS_TOUR_EXTENSION);
  assert.deepEqual(host.document, provenance());
  assert.notEqual(host.document, first.value);
  assert.deepEqual([first.value, second.value], before);
  assert.equal(Object.keys(host.document).length, 5);
});
test("validation returns unchanged provenance and no fabricated warnings", () => {
  const owner = createCampusTourCompositionOwner(), value = provenance();
  const result = owner.validation.validateDocument(value, { path: "$.root", baseUrl: null, maxAssets: 60 });
  assert.deepEqual(result, { data: value, warnings: [] });
  assert.notEqual(result.data, value);
});
test("panorama provenance retains retired identities, unknown north and array order despite envelope aliases", () => {
  const host = setup(), value = entity(), before = structuredClone(value);
  const result = rewrite(host, value);
  assert.deepEqual(result, before);
  assert.notEqual(result, value);
  assert.notEqual(result.youvisit.panoramas, value.youvisit.panoramas);
  value.youvisit.panoramas.reverse();
  assert.deepEqual(result.youvisit.panoramas, [363732, 368158]);
  assert.equal(result.youvisit.retiredStop, 306364);
});
test("empty authored stop list and absent retired identity are preserved", () => {
  const value = entity(); value.youvisit.stops = []; delete value.youvisit.retiredStop;
  assert.deepEqual(rewrite(setup(), value), value);
});
test("numbered group metadata is preserved without interpreting its identifiers as aliases", () => {
  const value = { youvisitStop: 306388, number: 3 };
  assert.deepEqual(rewrite(setup(), value, "group", { id: "alias-research-and-innovation" }), value);
});
test("mixed retired-group provenance preserves original four-stop order verbatim", () => {
  const value = { note: "Main views of stops YouVisit's tour no longer visits; they appear only on its map.", youvisitStops: [306371, 306364, 306366, 306365] };
  assert.deepEqual(rewrite(setup(), value, "group", { id: "earlier-tour-stops" }), value);
});
test("conflicting root provenance fails at the conflicting child", () => {
  const value = provenance(); value.north = "Aligned to north";
  rejects(() => setup([entry("minneapolis"), entry("st-paul", value)]), "conflict", "st-paul");
});
test("unknown and missing root semantics are rejected", () => {
  rejects(() => setup([entry("minneapolis", { ...provenance(), url: "https://invented.example/" })]), "unsupported", ".url");
  const value = provenance(); delete value.positions;
  rejects(() => setup([entry("minneapolis", value)]), "unsupported", ".positions");
  rejects(() => setup([]), "unsupported");
});
test("unknown nested entity fields and invented alignment cannot be silently retained", () => {
  const value = entity(); value.north.headingDeg = 0;
  rejects(() => rewrite(setup(), value), "unsupported", "headingDeg");
  const other = entity(); other.youvisit.url = "https://invented.example/";
  rejects(() => rewrite(setup(), other), "unsupported", ".url");
});
test("invalid provenance identifiers fail rather than normalizing values", () => {
  for (const invalid of [0, -1, 1.5, "306364", Number.MAX_SAFE_INTEGER + 1]) {
    const value = entity(); value.youvisit.retiredStop = invalid;
    rejects(() => rewrite(setup(), value), "unsupported", "retiredStop");
  }
});
test("unsupported attachment scopes and unsupported entity types fail", () => {
  for (const scope of ["asset", "representation", "link"]) rejects(() => rewrite(setup(), entity(), scope), "unsupported");
  rejects(() => rewrite(setup(), entity(), "entity", { type: "future-entity" }), "unsupported");
});
test("ambiguous or invented group metadata fails", () => {
  rejects(() => rewrite(setup(), { youvisitStop: 306388, number: 3, note: "invented" }, "group"), "unsupported", ".note");
  rejects(() => rewrite(setup(), { note: "Original", youvisitStops: [306371], members: ["invented"] }, "group"), "unsupported", ".members");
});
test("foreign or missing composition state cannot rewrite attachments", () => {
  const host = setup(); host.state = {};
  rejects(() => rewrite(host, entity()), "unsupported");
  host.state = setup().state;
  rejects(() => rewrite(host, entity()), "unsupported");
});
test("child, node, depth and byte bounds fail without publishing a candidate", () => {
  for (const bound of [{ children: 1 }, { jsonNodes: 1 }, { jsonDepth: 1 }, { manifestBytes: 1 }]) {
    rejects(() => setup(undefined, { limits: { ...limits, ...bound } }), "limit");
  }
  rejects(() => setup(undefined, { limits: { ...limits, jsonNodes: Infinity } }), "limit");
});
test("remaining node bound rejects oversized provenance arrays before copying", () => {
  const host = setup(undefined, { limits: { ...limits, jsonNodes: 20 } }), value = entity();
  value.youvisit.panoramas = Array(21).fill(1);
  rejects(() => rewrite(host, value), "limit", "panoramas");
});
test("pre-cancellation and cancellation before attachment rewrite fail", () => {
  const controller = new AbortController(); controller.abort();
  rejects(() => setup(undefined, { signal: controller.signal }), "cancelled");
  const later = new AbortController(), host = setup(undefined, { signal: later.signal }); later.abort();
  rejects(() => rewrite(host, entity()), "cancelled");
});
test("non-JSON objects, accessors and oversized text are rejected", () => {
  rejects(() => setup([entry("minneapolis", new Date())]), "unsupported");
  const accessor = provenance(); Object.defineProperty(accessor, "source", { get() { throw Error("getter must not execute"); }, enumerable: true });
  rejects(() => setup([entry("minneapolis", accessor)]), "unsupported");
  const large = provenance(); large.source = "x".repeat(16385);
  rejects(() => setup([entry("minneapolis", large)]), "unsupported");
});
