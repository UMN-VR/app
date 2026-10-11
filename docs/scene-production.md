# Campus authored scene preparation

The App release adapter maps the exact retained Minneapolis and Saint Paul
authored records into unpublished input documents for the public Scenes
producer. `createCampusSceneInputs` takes three explicitly supplied source byte
arrays, per-route immutable publication/input URLs and one measured shared media
index with its already acquired finite byte map. It performs no filesystem or
network read, image work, private backup discovery or runtime construction.
Source bytes are bound to the retained SHA-256 and length before parsing. Media
index bytes must match the caller's measured pin; Scenes owns all media/envelope
validation, image references and derived output.

All 48/12 panorama records, 134 original ordered links, captions, coordinates,
unknown heights, arbitrary north, credits, asset revisions, group projections,
sheet cells and owner attachments are carried unchanged. The thin Twin Cities
recipe retains the original 60-entity order, 24-group plan, overview, initial
panorama and four directed cross-campus navigation intentions. One media index
and base serve both child requests. Relative authored image paths remain input
data; the shared producer and actual Preview owner resolve them using that
declared base. There is no child media copy or independent content validator.

The external-navigation mapping now follows the actual additive owner source:
`ExternalDestinationRecord` contains a destination ID, scene ID and optional
registered route ID. `LinkRecord.externalDestination` names that destination;
the original `target` remains the named destination panorama. Only the four
authored crossing links receive that additive field. Every original link field,
list position and source record stays unchanged. The destination records use
`umn-minneapolis`/`umn-st-paul` for scene identity and `minneapolis`/`st-paul` for
registered route identity. Those route IDs are identifiers, not URLs. Campus
maps them to its existing authored `/tour/minneapolis/` and `/tour/st-paul/`
routes through `LoadSceneOptions.externalNavigation.navigate`, with the exact
named panorama, original link/arrival view, source identity and cancellation
signal. Scenes does not fetch an arbitrary address and Campus invents no query
parameter. The source recipe explicitly records `UNQUALIFIED_NOT_BOUND`; reading
declared owner source does not qualify or bind its forthcoming artifact.

`composeCampusSceneInput` calls actual `composeScenes` from
`@foss-earth/scenes/composition-node`, with actual
`createNodePreviewSheetsCompositionOwner` from
`@foss-earth/preview-sheets/composition-node` and the App
`createCampusTourCompositionOwner` provenance hook. Caller-supplied finite
Scenes and Preview limits/cancellation govern producer work. Any result is the
public producer's result; this helper creates no alternative scene compiler.
An exact installed artifact/qualification receipt is still required before any
result can be accepted or published.

The checked contract inputs are Scenes
`f5daa60273a4b5d89ca62efec94be61bc07f6dfc` / archive
`a3f6c3d5e84906dea2e10c8452f4224a4c896ebca450972b738b147d56c58ccf`,
Preview `4b688d341e8d557f19ef6ab19528fe541cbde1bc` / archive
`254d5e36d447abdd6924d1b020ebd2df6e609f879a88ef5eaf35d6e225e2dc82`,
and Images `02523eae1c8c3acd461bfe13111116fbb8d80f28` / archive
`cca1df6798d4d5eccf347ac995e00816529b84bdda7b6914268ff2998341f1f8`.
The other 62 archive identities in the accepted closure stay unchanged. Reading
these public contracts as data is not Campus compiled adoption.

The complete consumer recipe now follows all three actual additive declarations:

- Standalone inputs carry external destinations and the original four crossing
  links. The shared runtime calls the injected selection port with registered
  destination identity, named panorama, original link and cancellation signal.
- Each aggregate crossing-link request uses `SceneCompositionLink.consume` with
  its original link ID and `insert: { index }` with its original authored list
  position. The producer maps the existing external link into the corresponding
  child panorama once. Regis and Community Connections retain `next-stop` before
  `previous-stop`; none of the four directions is appended as a duplicate.
- `SceneCompositionRequest.groupReplacements` consumes the two named
  `earlier-tour-stops` child projections. It supplies the original group metadata
  and four cross-child member references in order, with an explicit Minneapolis
  context for the Campus provenance owner. `groupOrder` uses one
  `{ composed: "earlier-tour-stops" }` reference in the original 24-group position.
  Folwell Hall, Huntington Bank Stadium, McNeal Hall and St. Paul Mall retain the
  original title, note and retired YouVisit provenance.

`createCampusAggregateInputs` pins independently produced child manifests at
their declared immutable publication URLs. It checks the producer's manifest,
document identity/revision, SHA-256 and length agreement before placing those
exact bytes in the finite supplied input map. The aggregate request consumes
those published child results, rather than the unpublished authored inputs.
It uses the one existing media index/base and copies no media. The actual
`prepareCampusScenes` pipeline calls `composeCampusSceneInput` for Minneapolis
and Saint Paul, binds those two complete results, then calls the same public
producer for Twin Cities. Every call installs the production Preview owner and
the Campus provenance hook; no generic output is patched downstream.

Default `prepareCampusScenes`/`requireCampusSceneParity` acceptance still rejects
the explicit `UNQUALIFIED_NOT_BOUND` state. An explicitly supplied
`sourcePreparationOnly: true` permits future authorized preparation of all three
real producer results together, returned with `publicationAllowed: false`.
There is no partial return if a producer fails and no filesystem write or
publication operation. The retained old archive strictly rejects additive input
it does not support; it is never presented as a successful new implementation.
New checked archive/export/declaration and effective-source/qualification pins
must be bound before the release/build entry may accept these results. The
accepted three historical pins and other 62 dependencies stay unchanged.

All three shared operations are declared and source mapped; missing checked
artifact bindings remain precise release gates. The nine pure authored-adapter
tests are source prepared and UNRUN, including strict original content/order,
external identities, consume/insert/group-replacement requests and exact child
manifest pinning/drift controls. Small authored metadata fixtures do not qualify
the actual producer or the shared 694 MB media corpus. No media was read,
copied, reconstructed or reencoded; no install, import, test, build, pack, server,
browser, commit or publication was performed by this source preparation.
