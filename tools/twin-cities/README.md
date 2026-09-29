# Twin Cities campus tour: building the scene

The tour page, <https://umn-vr.github.io/tour/twin-cities/>, shows one
[FOSS Earth](https://github.com/foss-earth/foss-earth.github.io) scene. The scene is a manifest,
[`public/tour/twin-cities/scene.json`](../../public/tour/twin-cities/scene.json), and the
prepared images under `public/tour/twin-cities/media/`. It places the old YouVisit tour's 360°
photographs on the globe. FOSS Earth shows each one as an orb above the campus; entering an orb
opens the photograph, and its links lead to the next one. The format is FOSS Earth's
[`docs/scenes/format.md`](https://github.com/foss-earth/foss-earth.github.io/blob/main/docs/scenes/format.md).

Everything under `public/tour/twin-cities/` is generated. Edit
[`placements.json`](placements.json) or the build, then rebuild.

Only what this tour needs lives here. FOSS Earth owns the scene format, the viewer and the tools
that prepare and check any scene. This build runs those tools from the `foss-earth` package the
repository installs. [AGENTS.md](../../AGENTS.md) sets out the split.

## Rebuilding

```sh
npm run build:scene
```

It needs:

- **The YouVisit backup** in `.local/youvisit-backup/snapshot-*`. It exists only on the
  laptop that made it; see that folder's README.
- **`npm install`,** which links FOSS Earth; see the [README](../../README.md).

What the build does:

1. **Prepares each photograph** with FOSS Earth's `scripts/prepare-panorama.mjs`. The outputs
   are preview cubes of 64, 128 and 256 px for the orbs, and whole images 2048, 4096 and
   6144 px wide for looking around, in JPEG at quality 80. 6144 px is YouVisit's full width.
   - A build of all 60 took 61 s on the laptop that made it, three images at a time.
   - Later builds reuse any image already prepared from the same file with the same options,
     so an edit to `placements.json` rebuilds in seconds.
2. **Writes `scene.json`.**
3. **Checks the result** with FOSS Earth's `scripts/check-scene.mjs`, the way the viewer will
   read it once published: the manifest is valid, and every image file exists with the size
   and byte count it declares. `npm test` repeats this check.

`node tools/twin-cities/build-scene.mjs --help` lists the options. YouVisit's own images are
6144 px wide at quality 75–80. The 6144 px images are 151 MiB of the scene's 263 MiB of file
bytes (266 MiB allocated on disk). `--immersion-widths 2048,4096` leaves them out. These are
separate image files referenced by a 301 KiB manifest, not one download. Routine app deploys
leave this content alone; see [content delivery](../../docs/content-delivery.md) for the folder
layout, loading sequence and separate app/content release commands.

## Where each part comes from

| Part | Source |
| --- | --- |
| The photographs | The backup's `media/panoramas/<id>/6144.jpg`, the largest YouVisit serves |
| Stops, their order, and each stop's panoramas | The backup's `api/v1.2-stops.json` and `api/v2-stops-tours.json`: 23 stops, one group each, in tour order |
| Retired stops | The 4 main views of stops YouVisit's map still shows but its tour no longer visits, in the group "Earlier tour stops" |
| Descriptions | YouVisit's panorama descriptions, as plain text |
| Links with a direction | YouVisit's hotspots that open another panorama; the link points where the hotspot sat |
| Links without a direction | The rest of each stop, from its main view; a way back to the main view from the others; and Next and Previous stop between main views, as YouVisit's buttons did |
| Start views | Each panorama's `start_lon`, `start_lat` and `start_fov`, where someone set them |
| Ids, titles, positions, north | [`placements.json`](placements.json), by hand |

## placements.json

There is one entry per photograph, keyed by its YouVisit panorama id:

```json
"363723": {
  "id": "taylor-center",
  "title": "Taylor Center",
  "capture": { "longitudeDeg": -93.2333836, "latitudeDeg": 44.9745163, "horizontalAccuracyMeters": 50, "source": "…" },
  "pose": { "headingDeg": 0, "pitchDeg": 0, "rollDeg": 0, "aligned": false, "provenance": "…" }
}
```

- **`id`** is the panorama's id in the scene, and the name of its media folder. Changing an
  id breaks links other people have saved, so leave ids alone once the tour is published.
- **`sameImage`** lists the other YouVisit panoramas that are the same photograph.
  - YouVisit often uploaded a photograph again under a new id, sometimes with different
    bytes. The build refuses byte-identical files that are not listed together.
  - Re-encoded copies can't be caught that way. They were found by comparing small
    thumbnails at every rotation and are listed by hand. There are four: Walter Library
    Lobby, RecWell Lobby, RecWell Indoor Track and Huntington Bank Stadium.
  - That leaves 60 distinct photographs among YouVisit's 79 panorama ids.
- **`capture`** is where the photograph was taken. `source` says where the position came
  from, and `horizontalAccuracyMeters` how far off it may be.
- **`pose`** is which way the image faces. `headingDeg` is the compass bearing of the image's
  centre column. `aligned: false` means nobody has set it yet; it goes into the scene's
  `imagePose`, and the panorama's tab says whether north is set. `provenance` says how it was
  set.
- **`marker`** is optional and overrides where the orb floats. It uses the fields of the
  format's marker, such as `offsetM` for the height above the ground.

### Positions: approximate

YouVisit stored one hand-placed point per stop, not per photograph. Every position here is
therefore approximate, and each entry says which kind it is:

| Kind | Count | Accuracy given |
| --- | ---: | ---: |
| A stop's main view, at YouVisit's point for the stop | 24 | 65 m |
| At the stop's point, which lies on the building the photograph shows | 19 | 60 m |
| Moved to the centre of the building or place it names, from OpenStreetMap | 12 | 50–100 m |
| Not placed: somewhere in or near its stop | 5 | 150 m |

- **YouVisit's two positions for a stop disagree.** Its tour point and its map position differ
  by 14 m for a typical stop and 65 m at most.
- **A stop point can miss the photograph by more than that.** Northrop Mall's point is about
  80 m east of where the photograph appears to have been taken, judging by the directions to
  Northrop and down the mall.
- **YouVisit's map misplaced two retired stops.** McNeal Hall and St. Paul Mall sat 3.4 km
  west of the Saint Paul campus. They are now at McNeal Hall and the Saint Paul campus mall.
- **Building centres are from OpenStreetMap,** © OpenStreetMap contributors, ODbL 1.0, as of
  2026-09-28.

Panoramas that share a point have their orbs spread on a 15 m ring around it, so each can be
picked. The ring moves only the orb, not the recorded position.

### North: not set

No panorama has its north set yet. YouVisit re-encoded the images and dropped any orientation
the camera recorded, and its data has no compass headings. Until a heading is set, the photograph
turns with the wrong side toward north:

- **Outside:** an orb shows the wrong part of the photograph from a given side.
- **Inside:** the view is fine, but it doesn't line up with the map.

Links and start views are stored in the scene relative to north, so the build recomputes them
whenever a heading changes.

To set one:

1. Find two or three landmarks in the photograph whose positions are known, such as buildings
   or corners on OpenStreetMap, and read the image heading of each.
2. Solve for the capture position and the heading together. One landmark is not enough,
   because the stop points can be tens of metres off.
3. Write `headingDeg`, set `aligned: true`, and say how it was done in `provenance`.

## How YouVisit's directions were converted

[`youvisit.mjs`](youvisit.mjs) implements these rules, and
[`youvisit.test.mjs`](youvisit.test.mjs) checks them against the measurements. They were
measured against the backup's screenshots of YouVisit's viewer
(`.local/youvisit-backup/snapshot-*/viewer/`). Each screenshot's view was fitted to its
panorama image pixel by pixel.

- **Hotspots.** A hotspot's `coordinates` `{x, y}` are YouVisit's spherical angles `phi = x`
  and `theta = y`, taken from its viewer code.
  - Direction: azimuth `atan2(cos x, sin x · cos y)` and elevation `asin(sin x · sin y)`.
  - The azimuth is the image column, measured from the left edge as `u × 360°`.
  - All 35 hotspots visible in the screenshots landed within 0.61° of azimuth and 0.12° of
    elevation of where YouVisit drew them.
- **Start views.** A start view's `start_lon` is that same azimuth less 32.25°. 21 of the 23
  screenshots agree to ±0.25°. In the other two the view had already moved when the
  screenshot was taken.
  - `start_lat` is the elevation.
  - `start_fov` is the vertical field of view. When it is empty, YouVisit shows 100°.
- **Headings.** FOSS Earth's image heading is 0° at the image's centre column, so it is the
  azimuth less 180°. The scene then turns it by the photograph's `pose`.

## Viewing it

`npm run dev` opens the tour with this scene; see the [README](../../README.md). After a
rebuild, reload the page.
