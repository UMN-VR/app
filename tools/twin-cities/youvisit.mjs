/**
 * Reading YouVisit's tour data: its HTML text, and its directions in FOSS Earth's terms.
 *
 * The directions were measured against the backup's viewer screenshots (see README.md):
 *   - a hotspot's coordinates {x, y} are YouVisit's spherical angles, phi = x and theta = y.
 *     They give a direction whose azimuth is the image column (u·360°, from the left edge)
 *     and whose elevation is the image row;
 *   - a start view's `start_lon` is that same azimuth less 32.25°, and `start_lat` its elevation;
 *   - FOSS Earth's image-local heading is 0° at the image's centre column, so it is the azimuth
 *     less 180°. An image pose then turns it into the capture's east-north-up frame.
 */

const DEG = Math.PI / 180;
/** YouVisit's start_lon is the image azimuth less this; 21 of the 23 screenshots agree to ±0.25°. */
export const START_LON_OFFSET = 32.25;

const wrap = degrees => ((degrees % 360) + 360) % 360;
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const clamp = value => Math.max(-1, Math.min(1, value));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };

/** YouVisit's HTML fragments as plain text: tags dropped, entities decoded, spaces collapsed. */
export function plain(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
      if (name[0] === "#") return String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** A hotspot's image-local direction: heading clockwise from the image's centre column, pitch up from the horizon. */
export function hotspotDirection({ x, y }) {
  const azimuth = Math.atan2(Math.cos(x), Math.sin(x) * Math.cos(y)) / DEG;
  return { headingDeg: wrap(azimuth - 180), pitchDeg: Math.asin(clamp(Math.sin(x) * Math.sin(y))) / DEG };
}

/** A start view's image-local direction. */
export function startDirection({ lon, lat }) {
  return { headingDeg: wrap(lon + START_LON_OFFSET - 180), pitchDeg: lat };
}

/**
 * An image-local direction in the capture's east-north-up frame, by the scene format's
 * image pose: R = Rz(−heading)·Rx(pitch)·Ry(roll). Rounded to a thousandth of a degree.
 */
export function toWorld(local, pose) {
  const h = local.headingDeg * DEG, p = local.pitchDeg * DEG;
  let v = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
  const r = pose.rollDeg * DEG, t = pose.pitchDeg * DEG, z = -pose.headingDeg * DEG;
  v = [Math.cos(r) * v[0] + Math.sin(r) * v[2], v[1], -Math.sin(r) * v[0] + Math.cos(r) * v[2]];
  v = [v[0], Math.cos(t) * v[1] - Math.sin(t) * v[2], Math.sin(t) * v[1] + Math.cos(t) * v[2]];
  v = [Math.cos(z) * v[0] - Math.sin(z) * v[1], Math.sin(z) * v[0] + Math.cos(z) * v[1], v[2]];
  const heading = round(wrap(Math.atan2(v[0], v[1]) / DEG));
  return { headingDeg: heading === 360 ? 0 : heading, pitchDeg: round(Math.asin(clamp(v[2])) / DEG) };
}
