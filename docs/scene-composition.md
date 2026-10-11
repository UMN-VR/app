# Campus provenance composition

The public `@umn-vr/app/scene-composition` export supplies
`createCampusTourCompositionOwner()`. Its return type is the actual public
`SceneCompositionExtensionOwner` from `@foss-earth/scenes/composition`:
`name`, `validation.validateDocument`, `composeDocument(entries, context)` and
`rewrite(value, context)`. Use the owner alongside the shared Preview owner in
the explicit Scenes `extensions` list; supplying an extension list replaces the
Node adapter's defaults.

This contract was read as data from the checked Scenes release
`f5daa60273a4b5d89ca62efec94be61bc07f6dfc`, archive SHA-256
`a3f6c3d5e84906dea2e10c8452f4224a4c896ebca450972b738b147d56c58ccf`
(296482 bytes). The archive's `dist/composition.d.ts` is 7460 bytes, SHA-256
`b01f7d89bf9a64193bc1086e01ea1f05993877d238d8225f9cf02b1b4267d734`;
`dist/validateScene.d.ts` is 1754 bytes, SHA-256
`8fa859bbbf452de44b77fbd45e41b4050b7b8384027be737de519d3f5365e5ee`.
Reading the contract does not qualify Campus installation or compiled adoption.

The owner handles only `umn-vr.tour`. Every child must supply the same five root
provenance strings (`source`, `build`, `placements`, `positions`, `north`); one
unchanged root record is emitted. Those paths are historical provenance, not
new runtime dependencies. Conflicting roots, missing provenance and unknown
fields fail. Root text and every provenance text field are bounded to 16384
UTF-8 bytes. The owner also honors supplied child, JSON node/depth and manifest
byte bounds and the preparation signal. Private composition state is passed
through Scenes and is never published.

Panorama provenance retains the authored `youvisit` panorama/stop arrays,
optional numeric `retiredStop`, `capture` text and `north.provenance` text.
Group provenance retains either `youvisitStop`/`number` or the retired group's
`note`/`youvisitStops`, including original array order. No YouVisit identifier is
treated as an envelope alias; the owner does not inspect or rewrite links,
group membership, placements or media URLs. Asset, representation, link and
unsupported entity attachments fail rather than acquiring invented semantics.
Returned records are independent snapshots; the input records stay unchanged.

The authored source remains the original document `umn-twin-cities`, revision
`4b89d4e2af09`, 377117 bytes, SHA-256
`61c25d55523be24e4d937e594169c3d5d385f816005bc20bf209201c794686ed`.
This hook neither compiles that document nor reads media or the private backup.
The Node fixtures import only the Campus hook and use small authored provenance
records. Actual shared producer execution and the 48/12/60-panorama media and
browser acceptance remain separate checks.

Generic navigation insertion and group reconstruction stay with Scenes. Regis
and Community Connections preserve next-stop before previous-stop, and the two
child projections of `earlier-tour-stops` must reconstruct the original four
ordered members: Folwell Hall, Huntington Bank Stadium, McNeal Hall and St. Paul
Mall. Campus keeps that authored input intact and requests a reviewed public
operation; this hook does not patch generic composition.
