# Agent instructions

This repository is the UMN VR club's site, <https://umn-vr.github.io/>, and the University of
Minnesota's virtual tour built on FOSS Earth. [README.md](README.md) explains the layout and
commands.

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
- **Don't edit the generated tour files.** `public/tour/twin-cities/` is generated. Edit
  `tools/twin-cities/placements.json` or the build, then run `npm run build:scene`; see
  [tools/twin-cities/README.md](tools/twin-cities/README.md).
- **After an edit:** run `npx tsc -b`, `npx vitest related --run <changed files>` and
  `npm run lint`.
- **For finished work:** run `npm run ci`, once. A change to FOSS Earth also needs FOSS Earth's
  own checks.
- **Don't start servers or deploy unless asked.** Never start `npm run dev` or `npm run preview`
  unless asked; give the command instead. `npm run deploy` publishes the live site; run it
  only when asked.
