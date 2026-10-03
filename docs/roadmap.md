# Twin Cities tour: roadmap

The new tour goes at <https://umn-vr.github.io/tour/twin-cities/>. It is built on FOSS Earth
from the backup of the old YouVisit tour, <https://www.youvisit.com/tour/60288/>.
[tools/twin-cities/README.md](../tools/twin-cities/README.md) explains how the scene is built.

Work that needs more than a few lines has a prompt in this folder, `*-prompt.md`, to start a
fresh conversation with. Work that FOSS Earth owns has its prompt there.

## Done

- **Backed up the YouVisit tour** (2026-09-27) into `.local/youvisit-backup/`, before it is
  taken down.
- **Put the 360° photographs into a FOSS Earth scene** (2026-09-27). The scene has:
  - 60 distinct photographs, from 79 YouVisit panorama ids;
  - 23 stops, plus 4 retired ones;
  - YouVisit's hotspot links, and its start views.
- **Made this repository an app on FOSS Earth, like 0SFS:** `npm run dev` runs the tour.
- **Each panorama opens as a tab, at full detail** (2026-09-27). FOSS Earth's part is in its
  `docs/proposals/panorama-scenes.md`, "After the second user trial". Here, the build publishes
  YouVisit's full 6144 px width too: 151 MiB more, 266 MiB in all. Not yet tried by hand.
- **Photographs load as tiles** (2026-10-03). Inside a panorama, each photograph arrives as
  tiles of an equi-angular cube, only those the view needs, over the orb's preview, so it
  sharpens in a second or two rather than after the whole image. 360 image settings →
  Representation switches between equi-angular tiles, ordinary cube tiles and the whole image,
  and the Renderer tab between WebGPU, WebGL2 and WebGL; see the [README](../README.md). FOSS
  Earth's [progressive 360° prototype](https://github.com/foss-earth/foss-earth.github.io/blob/main/benchmarks/eac-progressive-prototype/REPORT.md)
  measured the design and was tried by hand on phones; the production version was checked
  headlessly on all three renderers. Deployed 2026-10-03, the app first and the content ten
  minutes later; on the live site, at a phone's viewport on a desktop connection, Northrop Mall's
  view was covered by its tiles in 0.5 to 1.1 s on WebGPU, WebGL2 and WebGL. Not yet tried by
  hand on a phone in production.

## Next

1. **Review and prioritize low-end 360° performance before wider release.**
   The photographs are the reported main bottleneck; their loading now comes in tiles, which
   leaves drawing and the globe behind them. The
   [WebGL performance review](webgl-performance-review.md) records the findings, expected
   performance and UX tradeoffs, and links the shared FOSS Earth optimization catalogue.
   Implementation choices and device qualification remain open.
2. **Verify responsive loading on the deployed phone tour, and separate content hosting.**
   The first deployment exposed a long deployment and a blank/loading scene on the phone.
   App-only releases now avoid copying scene media locally; Pages still builds the whole site.
   See [content-delivery.md](content-delivery.md) for the format, current commands and the
   remaining independent-content-origin boundary.
3. **Set north and correct the positions of all 60, and place the five that aren't placed.**
   Prompt: [placements-prompt.md](placements-prompt.md).
4. **Put the rest of the tour on the map:** photos, videos, narration and hotspot text. Prompt:
   [tour-media-prompt.md](tour-media-prompt.md).

## Also open

- **Copy `.local/youvisit-backup/` to storage the U keeps,** such as University Google Drive
  or Box. For now it exists only on this laptop, and it is the only copy of the old tour.
- **Ask the U for the Welcome stop's narration script and audio.** YouVisit has the text only in
  Spanish, and that Spanish audio file is missing.
- **The accessible version of the new tour,** like YouVisit's
  <https://www.youvisit.com/tour/ada/umn/80239?tourid=tour3>. The backup has YouVisit's in all
  four languages, in `ada/`.
- **Update the UMN VR landing page** (`index.md`). It dates from when the club started.

## What the tour uses from the backup so far

The backup's own README, `.local/youvisit-backup/README.md`, lists everything in it and what
YouVisit's data is missing.

| In the backup | Count | In the tour |
| --- | ---: | --- |
| Panoramas, 6144 × 3072 | 79 ids, 60 distinct photographs | All 60, at 2048, 4096 and 6144 wide |
| Stops and their order, hotspots, start views | 23 stops, 4 retired | All |
| Descriptions | One per panorama | As plain text |
| Positions | One point per stop | Approximate; see [placements-prompt.md](placements-prompt.md) |
| Photos, as uploaded | 149 | Not yet |
| Narration | 105 files in four languages | Not yet |
| Videos YouVisit hosted | 3, with captions | Not yet |
| YouTube videos, on the U's channels | 45 | Not yet |
| Narration text, the route, labels, action buttons | In `api/` | Not yet |
