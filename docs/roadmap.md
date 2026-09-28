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

## Next

1. **Make each panorama a tab, at full detail.** This is FOSS Earth's work, with one change
   here, and it blocks the rest. Prompt: `../foss-earth/docs/panorama-mode-prompt.md`.
   - **Why the images look soft:** YouVisit's photographs are 6144 px wide, but the build
     publishes only 2048 and 4096.
   - **The change here:** publish the 6144 width too. That adds about 250 MB.
2. **Deploy.** Switch GitHub Pages to the `gh-pages` branch, then run `npm run deploy`; see the
   [README](../README.md#deploying).
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
| Panoramas, 6144 × 3072 | 79 ids, 60 distinct photographs | All 60, at 2048 and 4096 wide |
| Stops and their order, hotspots, start views | 23 stops, 4 retired | All |
| Descriptions | One per panorama | As plain text |
| Positions | One point per stop | Approximate; see [placements-prompt.md](placements-prompt.md) |
| Photos, as uploaded | 149 | Not yet |
| Narration | 105 files in four languages | Not yet |
| Videos YouVisit hosted | 3, with captions | Not yet |
| YouTube videos, on the U's channels | 45 | Not yet |
| Narration text, the route, labels, action buttons | In `api/` | Not yet |
