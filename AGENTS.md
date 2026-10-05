# Agent instructions

This repository is the UMN VR club's site, <https://umn-vr.github.io/>, and the University of
Minnesota's virtual tour built on FOSS Earth. [README.md](README.md) explains the layout and
commands, and [docs/roadmap.md](docs/roadmap.md) what is left to do.

## Where work belongs

Three repositories, three concerns:

| Repository | Owns |
| --- | --- |
| **This one** | The tour: its pages, its scene and prepared photographs, the build that makes the scene from the YouVisit backup, the placements, its accessible version, and anything else only this tour needs. |
| **FOSS Earth** (`../../foss-earth`) | The globe, a Google Earth clone: the scene format, its loader and panorama viewer, the app shell (`mountGlobeApp`), the tools that prepare and check any scene, the map, camera and input. |
| **0SFS** (`../../0sfs`) | The flight simulator built on FOSS Earth. Nothing of the tour goes there, and nothing here depends on it. |

- **Tour-only work goes here.** Work that names this tour or its content belongs here: its
  photographs, YouVisit, its stops, the U's branding.
- **Globe features go in FOSS Earth.** A feature a globe with no tour in it would want belongs
  in FOSS Earth, even when the tour is its only user today. Write it there, export it, and use
  the export from here.
- **Use FOSS Earth, never copy it.** Consume it through the `foss-earth` package this
  repository installs: its exports, and its documented tools such as
  `scripts/prepare-panorama.mjs` and `scripts/check-scene.mjs`. Never deep-import its internal
  files.

## Rules

- **Scratch goes in the gitignored `.local/`,** never outside the repository.
- **Never delete from `.local/youvisit-backup/`.** It is the only copy of the YouVisit tour.
- **The camera has mass and momentum.** Any camera move the tour adds, such as a guided path
  between stops, follows FOSS Earth's
  [camera motion rules](../../foss-earth/docs/camera-motion.md): it never jumps, cut short it
  glides on from where it got to, and the person's input acts at once and keeps acting. Build
  such moves in FOSS Earth when a globe without the tour would want them.
- **Draw only what changed, and each change once.** Compute something once; compute it twice
  only when that is the cheapest way. The globe draws a frame only when what it shows changes;
  a change the tour makes to something already in the scene calls `requestRender()` once, and
  new content is shown only when all of it can be drawn. FOSS Earth's
  [render on demand](../../foss-earth/docs/render-on-demand.md) says what asks for a frame and
  what never should.
- **Dropdowns fit their text.** A dropdown is as wide as its own text, its longest option, and
  never stretched to its row, column or panel: FOSS Earth's
  [UI layout](../../foss-earth/docs/ui-layout.md#dropdowns-fit-their-own-text).
- **Don't edit the generated tour files.** `public/tour/twin-cities/` is generated. Edit
  `tools/twin-cities/placements.json` or the build, then run `npm run build:scene`; see
  [tools/twin-cities/README.md](tools/twin-cities/README.md).
- **After an edit:** run `npx tsc -b`, `npx vitest related --run <changed files>` and
  `npm run lint`.
- **For finished work:** run `npm run ci`, once. A change to FOSS Earth also needs FOSS Earth's
  own checks.
- **Measure the tour headlessly.** FOSS Earth's
  [scene A/B benchmark](../../foss-earth/benchmarks/scene-ab/README.md) runs this tour's
  build on the machine's real GPU, WebGL 1 and 2 included, with no server: pixel equivalence
  and CPU/GPU time per frame, at a phone's viewport. Start there rather than writing another.
- **Don't start servers or deploy unless asked.** Never start `npm run dev` or `npm run preview`
  unless asked; give the command instead. `npm run deploy` publishes the live site; run it
  only when asked.
