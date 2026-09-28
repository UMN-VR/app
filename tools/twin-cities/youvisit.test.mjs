import { describe, expect, it } from "vitest";
import { hotspotDirection, plain, startDirection, toWorld } from "./youvisit.mjs";

/**
 * Where YouVisit's viewer drew these, measured by fitting its screenshots to the panorama
 * images: the image azimuth (u·360°, from the left edge) and elevation, in degrees.
 */
const measuredHotspots = [
  { name: "Inside Northrop Auditorium, in Northrop Mall", coordinates: { x: 3.0256167648275403, y: 1.473813011492693 }, azimuth: 270.817, elevation: 6.566 },
  { name: "Value Stats, in Northrop Mall", coordinates: { x: 2.0848045418228374, y: 0.5423813831307147 }, azimuth: 327.211, elevation: 26.706 },
  { name: "One Stop Student Services, in Bruininks Hall", coordinates: { x: 2.0838245355406784, y: 2.8992200557938617 }, azimuth: 210.204, elevation: 12.028 },
  { name: "Pioneer Hall Lobby, in Residence Life & Dining", coordinates: { x: 1.5880823203434817, y: 3.0836882562823207 }, azimuth: 181.136, elevation: 3.309 },
  { name: "a text hotspot below the horizon, in Residence Life & Dining", coordinates: { x: 3.0849494185698414, y: -0.023061052999948223 }, azimuth: 273.457, elevation: -0.16 },
];

/** Start views whose screenshots were taken before the view moved: the fitted image azimuth of the view's centre. */
const measuredStarts = [
  { name: "Recreation and Wellness Center", start: { lon: 198.668, lat: 17.9572 }, azimuth: 230.9 },
  { name: "Impact and Value of a UMN Degree", start: { lon: 210.395, lat: 9.45259 }, azimuth: 242.65 },
];

const angleBetween = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

describe("YouVisit directions", () => {
  for (const hotspot of measuredHotspots) {
    it(`puts the hotspot ${hotspot.name} where YouVisit drew it`, () => {
      const { headingDeg, pitchDeg } = hotspotDirection(hotspot.coordinates);
      // Image-local heading 0° is the image's centre column, at azimuth 180°.
      expect(angleBetween(headingDeg + 180, hotspot.azimuth)).toBeLessThan(0.7);
      expect(Math.abs(pitchDeg - hotspot.elevation)).toBeLessThan(0.2);
    });
  }

  for (const view of measuredStarts) {
    it(`starts ${view.name} where YouVisit's viewer did`, () => {
      const { headingDeg, pitchDeg } = startDirection(view.start);
      expect(angleBetween(headingDeg + 180, view.azimuth)).toBeLessThan(0.3);
      expect(pitchDeg).toBe(view.start.lat);
    });
  }
});

describe("toWorld", () => {
  const level = { headingDeg: 0, pitchDeg: 0, rollDeg: 0 };

  it("leaves a direction as it is at a zero pose", () => {
    expect(toWorld({ headingDeg: 90.6461, pitchDeg: 6.6139 }, level)).toEqual({ headingDeg: 90.646, pitchDeg: 6.614 });
  });

  it("turns image-local headings clockwise by the pose's heading, wrapping at north", () => {
    expect(toWorld({ headingDeg: 0, pitchDeg: 0 }, { ...level, headingDeg: 90 })).toEqual({ headingDeg: 90, pitchDeg: 0 });
    expect(toWorld({ headingDeg: 300, pitchDeg: 10 }, { ...level, headingDeg: 90 })).toEqual({ headingDeg: 30, pitchDeg: 10 });
  });

  it("tips the image's forward up by the pose's pitch, and its right down by the pose's roll", () => {
    expect(toWorld({ headingDeg: 0, pitchDeg: 0 }, { ...level, pitchDeg: 30 }).pitchDeg).toBeCloseTo(30, 3);
    expect(toWorld({ headingDeg: 90, pitchDeg: 0 }, { ...level, rollDeg: 30 }).pitchDeg).toBeCloseTo(-30, 3);
  });
});

describe("plain", () => {
  it("drops tags, decodes entities and collapses spaces", () => {
    expect(plain("<p>300+ majors&nbsp;and minors &amp; more&rsquo;s   <a href=\"x\">here</a>.</p>")).toBe("300+ majors and minors & more’s here .");
    expect(plain("&#8212;&#x2014;")).toBe("——");
    expect(plain(null)).toBe("");
  });
});
