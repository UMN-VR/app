/** UMN provenance only. This owner never loads, compiles or renders a scene. */
export const CAMPUS_TOUR_EXTENSION = "umn-vr.tour";
const ROOT_KEYS = ["source", "build", "placements", "positions", "north"];
const MAX_TEXT_BYTES = 16 * 1024;
const encoder = new TextEncoder();

export class CampusTourExtensionError extends Error {
  constructor(code, path, message) {
    super(`${path}: ${message}`);
    this.name = "CampusTourExtensionError";
    this.code = code;
    this.path = path;
  }
}
function fail(code, path, message) { throw new CampusTourExtensionError(code, path, message); }
function object(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("unsupported", path, "requires a plain provenance object");
  if (Reflect.ownKeys(value).some(key => typeof key !== "string" || !Object.getOwnPropertyDescriptor(value, key)?.enumerable ||
      !("value" in Object.getOwnPropertyDescriptor(value, key)))) fail("unsupported", path, "requires enumerable JSON data fields");
  return value;
}
function keys(value, path, required, optional = []) {
  object(value, path);
  for (const key of required) if (!Object.hasOwn(value, key)) fail("unsupported", `${path}.${key}`, "required Campus provenance is absent");
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail("unsupported", `${path}.${key}`, "unsupported Campus semantics");
}
function text(value, path) {
  if (typeof value !== "string" || !value.length || value.length > MAX_TEXT_BYTES || encoder.encode(value).byteLength > MAX_TEXT_BYTES) fail("unsupported", path, "requires nonempty provenance text of at most 16384 UTF-8 bytes");
}
function positive(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) fail("unsupported", path, "requires a positive safe integer");
}
function identifiers(value, path, budget) {
  if (!Array.isArray(value)) fail("unsupported", path, "requires the authored identifier array");
  if (value.length > budget.limits.jsonNodes - budget.nodes) fail("limit", path, "Campus identifier array exceeds the remaining supplied JSON node bound");
  // No sorting or deduplication: authored provenance and its order are retained.
  for (const [index, id] of value.entries()) positive(id, `${path}[${index}]`);
}
function root(value, path) {
  keys(value, path, ROOT_KEYS);
  for (const key of ROOT_KEYS) text(value[key], `${path}.${key}`);
}
function attachment(value, scope, record, path, budget) {
  object(value, path);
  if (scope === "entity") {
    if (record?.type !== "panorama") fail("unsupported", path, "Campus entity provenance is supported only on panorama records");
    keys(value, path, ["youvisit", "capture", "north"]);
    keys(value.youvisit, `${path}.youvisit`, ["panoramas", "stops"], ["retiredStop"]);
    identifiers(value.youvisit.panoramas, `${path}.youvisit.panoramas`, budget);
    identifiers(value.youvisit.stops, `${path}.youvisit.stops`, budget);
    if (Object.hasOwn(value.youvisit, "retiredStop")) positive(value.youvisit.retiredStop, `${path}.youvisit.retiredStop`);
    text(value.capture, `${path}.capture`);
    keys(value.north, `${path}.north`, ["provenance"]);
    text(value.north.provenance, `${path}.north.provenance`);
  } else if (scope === "group") {
    if (Object.hasOwn(value, "youvisitStop") || Object.hasOwn(value, "number")) {
      keys(value, path, ["youvisitStop", "number"]);
      positive(value.youvisitStop, `${path}.youvisitStop`);
      positive(value.number, `${path}.number`);
    } else {
      keys(value, path, ["note", "youvisitStops"]);
      text(value.note, `${path}.note`);
      identifiers(value.youvisitStops, `${path}.youvisitStops`, budget);
    }
  } else fail("unsupported", path, `Campus provenance is not supported on ${scope} records`);
}
function cancelled(signal, path) {
  if (signal?.aborted) fail("cancelled", path, "Campus provenance composition was cancelled");
}
function copy(value, budget, path, depth = 1) {
  cancelled(budget.signal, path);
  if (++budget.nodes > budget.limits.jsonNodes || depth > budget.limits.jsonDepth) fail("limit", path, "Campus provenance exceeds the supplied JSON bounds");
  if (Array.isArray(value)) return value.map((item, at) => copy(item, budget, `${path}[${at}]`, depth + 1));
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) Object.defineProperty(result, key, { value: copy(item, budget, `${path}.${key}`, depth + 1), enumerable: true, writable: true, configurable: true });
    return result;
  }
  return value;
}
function checkedLimits(limits, path) {
  for (const key of ["children", "jsonNodes", "jsonDepth", "manifestBytes"]) {
    if (!Number.isSafeInteger(limits?.[key]) || limits[key] < 0) fail("limit", path, `requires a finite nonnegative ${key} bound`);
  }
  return { children: limits.children, jsonNodes: limits.jsonNodes, jsonDepth: limits.jsonDepth, manifestBytes: limits.manifestBytes };
}

/** @returns {import("@foss-earth/scenes/composition").SceneCompositionExtensionOwner} */
export function createCampusTourCompositionOwner() {
  const states = new WeakSet();
  return {
    name: CAMPUS_TOUR_EXTENSION,
    validation: {
      name: CAMPUS_TOUR_EXTENSION,
      validateDocument(value, { path }) {
        root(value, path);
        return { data: Object.fromEntries(ROOT_KEYS.map(key => [key, value[key]])), warnings: [] };
      },
    },
    composeDocument(entries, { limits, signal }) {
      const path = `$.extensions.${CAMPUS_TOUR_EXTENSION}`;
      cancelled(signal, path);
      const bound = checkedLimits(limits, path);
      if (!Array.isArray(entries) || !entries.length) fail("unsupported", path, "Campus attachments require explicit root provenance");
      if (entries.length > bound.children) fail("limit", path, "Campus root provenance exceeds the supplied child bound");
      const state = { limits: bound, signal, nodes: 0 };
      let document;
      for (const entry of entries) {
        root(entry.value, entry.path);
        const current = copy(entry.value, state, entry.path);
        if (encoder.encode(JSON.stringify(current)).byteLength > bound.manifestBytes) fail("limit", entry.path, "Campus root provenance exceeds the supplied manifest byte bound");
        if (document && ROOT_KEYS.some(key => document[key] !== current[key])) fail("conflict", entry.path, "Campus children declare conflicting root provenance");
        document ??= current;
      }
      states.add(state);
      return { document, state };
    },
    rewrite(value, { scope, path, state, record }) {
      if (!state || !states.has(state)) fail("unsupported", path, "requires this owner's completed root composition state");
      cancelled(state.signal, path);
      attachment(value, scope, record, path, state);
      const result = copy(value, state, path);
      if (encoder.encode(JSON.stringify(result)).byteLength > state.limits.manifestBytes) fail("limit", path, "Campus attachment exceeds the supplied manifest byte bound");
      return result;
    },
  };
}
