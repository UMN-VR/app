# Campus verification tooling

The maintained Campus CI wrapper is
[`tools/verification/verify-ci-consumer.py`](../tools/verification/verify-ci-consumer.py).
It binds the reviewed shared CI artifact to a named Campus consumer and delegates
the nineteen positive and negative cases to the public
`@foss-earth/ci/bin/conformance.mjs` entry. Attribution policy, fixtures, identity
decisions and validation remain owned by `foss-earth/ci`. This wrapper adds Campus
arguments, artifact staging, preservation and bounded process orchestration; it
contains no second policy or attribution validator.

The wrapper and its documentation are authored source under `tools/` and `docs/`.
App's existing package file list includes both directories. The historical ignored
copy remains frozen evidence. Runtime, packages and current verification requests
must use the maintained source file; `.local` holds private receipts, logs, run
inputs, retained installed artifacts and historical copies only.

## Named consumers and inputs

Supply a canonical physical `--owner-root` containing the assigned sibling repos,
and a canonical `--repo` directly beneath it. The permitted repository names are
exactly `app`, `minneapolis`, `st-paul`, `twin-cities`, `tour`, `about`,
`dev_installer`, `UMN-VR.github.io`, `browser-testing` and `.github`. The tool does
not discover targets or accept additional names. Both directory arguments reject
symlinks and noncanonical paths. No machine-specific home path is built into the
maintained tool.

Other required arguments are `--archive`, `--descriptor` and `--run-root`.
The archive remains the exact reviewed shared CI release:

- Source: `1db73d1ddb342e348a2c9e8387f7bbc7ebb3225e`.
- Archive SHA-256: `bd884d925b8a7339b15fa61a477cf652bb73d41cc68addf50a050ab6cb151611`;
  68,164 bytes.
- Trusted descriptor SHA-256:
  `d60ee5067185a768f0890da2ed87d82dbfa08f28282e4d05a35e823c70307122`.

Archive size, digest, sealed file hashes, safe regular member paths, duplicate
members and bounded decoded staging are checked before binding. The authenticated
archive contains a zero-byte directory named exactly `package`. The wrapper
accepts that marker before checking contained `package/` paths. The exception
rejects a regular file, symlink, hard link, device, FIFO, nonzero directory or
foreign root. It does not change either authentication pin or safe member rules.
These checks
establish which artifact is being delegated to; the public shared CI command
still performs the policy and conformance validation.

For example, after a fresh coordinator grant binds these actual paths and hashes,
run from the App checkout:

```sh
python3 tools/verification/verify-ci-consumer.py \
  --owner-root /absolute/UMN-VR \
  --repo /absolute/UMN-VR/minneapolis \
  --archive /absolute/UMN-VR/app/deps/foss-earth-ci-1db73d1ddb342e348a2c9e8387f7bbc7ebb3225e.tgz \
  --descriptor /absolute/UMN-VR/minneapolis/.attribution-release.json \
  --run-root /absolute/UMN-VR/minneapolis/.local/build/independent-scenes/GRANTED_RUN/conformance-binding
```

The example paths are placeholders, not a grant or an executable request. Record
the real paths in a newly frozen request. Python 3.9 or later is required. The
parent of the new run directory must exist; the run directory itself must be
absent. It stays inside the named consumer's `.local/build/independent-scenes/`.
The optional `--inspect-only` performs the exact artifact data intake without
creating the run directory, binding a module or executing shared CI.

## Preservation and evidence

Shared conformance requires a regular installed artifact at the actual consumer's
`node_modules/@foss-earth/ci`, then launches that consumer's configured public
entry point. A separate runner installation alone does not satisfy this contract.
The wrapper retains an existing CI directory or symlink without following it,
temporarily stages the reviewed archive at that location, and restores the
previous entry during cleanup. If none existed, the checked staged artifact moves
to the run evidence directory afterward. Existing root and hidden package locks
must remain byte-identical. There is no npm resolution or App dependency install.

Each run retains the artifact file map, full stdout/stderr, public conformance
result and binding/closure receipt. Shared CI creates its isolated synthetic
positive/negative Git fixtures inside that run; these are not Campus source
commits. A pass requires all nineteen actual cases, complete/clean shared results,
exit zero, unchanged locks and ordinary process completion. Failed cases cannot
be replaced by inferred success. The public process has a ninety-second timeout;
owned cleanup is bounded to ten seconds plus five seconds if necessary. Any
forced cleanup is failure and its logs remain evidence.

Missing shared policy or reusable validation behavior must be requested from the
Platform/CI owner. Do not add a parallel implementation here or edit shared CI.

## Maintained source sealer

[`seal-campus-source.py`](../tools/verification/seal-campus-source.py) replaces
the temporary source-sealing recipe with an explicit metadata-only interface:

```sh
python3 tools/verification/seal-campus-source.py \
  --plan /absolute/ignored-inputs/source-seal-plan.json \
  --output /absolute/existing-evidence/new-source-seal.json
```

The plan has format `campus-source-seal-plan`, status `SOURCE_ONLY`, and exact
`baseline`, `beforeMap` and `sourceGrant` pins. A pin carries the absolute physical
`path`, `sha256`, `sizeBytes` and, when available, `mode`. `allowedPaths` must equal
the complete before-map path set, and `newAuthoredTests` is the author's current
count, not a test result. The before map uses `files` with each exact path and its
`exists` state; existing files also carry their original hash, size and mode.

The sealer verifies the baseline and recorded before pins, rejects every changed
nonleased baseline file, and measures only the baseline files plus explicitly
leased new paths. It creates one new source-seal JSON in an already existing
physical evidence directory. It preserves the complete original repository map
and records the exact before/after delta. It launches no checks, creates no
execution directories, discovers no source targets and writes no handoff or
request. A source-seal plan cannot authorize execution. Public evidence references
use repo-relative evidence IDs; physical paths belong in ignored local input and
receipt files.

## Maintained sequential CPU conductor

[`run-campus-cpu.py`](../tools/verification/run-campus-cpu.py) replaces the
temporary execution recipe. It has no built-in checkout, request, clock or grant:

```sh
python3 tools/verification/run-campus-cpu.py \
  --request /absolute/ignored-inputs/exact-cpu-request.json \
  --grant /absolute/coordinator/exact-cpu-grant.json \
  --grant-sha256 EXACT_COORDINATOR_GRANT_SHA256
```

These are interface examples, not permission to run them. The grant is issued
separately by the coordinator and must have format `campus-cpu-execution-grant`,
status `GRANTED`, owner `Campus`, and `sourceOnly: false`. It binds exact
`request`, `sourceCheckpoint` and `runner` pins, an absolute `executionRoot`, UTC
`issuedAt` and `expiresAt`, `limits`, and `newOutputRoots`. Both the request and
grant must agree on the source checkpoint, execution root, complete output roots
and limits. A source-only assignment, observed slot, old grant or a self-created
source seal cannot substitute for this execution grant.

The request retains the exact `commands` array. Each row names `id`, `cwd`,
`argv`, `timeoutSeconds`, `workers: 1`, `inputs`, new `log` and `receipt` paths
inside the exact execution root. Optional `resultKind` is `exit`, `node-test`,
`python-unittest` or `shared-conformance`; fixture rows can also bind
`expectedTests`. Node test rows require `--test-concurrency=1`. Shared-conformance
rows bind the wrapper's real `--run-root` argument and actual complete nineteen
case receipts. Other owner scratch roots are named individually in
`newOutputRoots`; the main execution root is separate. Their existing parents
must be physical, and every new root must be absent before execution.

Required `limits` include positive `wallSeconds` and `cleanupSeconds`,
`commandConcurrency: 1`, `nodeTestConcurrency: 1`, `servers: 0`, `browsers: 0`,
and `mediaScans: 0`. The conductor does not invoke a shell, increase concurrency,
install dependencies, fabricate a missing command or infer a test pass from an
exit alone. Actual Node TAP and Node 26 text summaries are accepted only when all
cases pass without cancelled, skipped or todo cases. Python unittest rows require
an actual complete `Ran ... tests`/`OK` summary. Shared cases require exact
complete and clean receipts, restored CI installation and unchanged locks.

The first execution creates a permanent start receipt carrying original epoch
and monotonic deadlines. Both clocks constrain each command; expiry never resets
the budget. `--resume` uses the same request, grant, runner, start receipt and
preservation inputs. It can reuse only completed passing rows with sealed logs;
a failed, unfinished or forcibly cleaned row requires a separately sealed
successor attempt. A closed run is never reopened. The process-ownership log,
per-row stdout/stderr and receipts, original start and final closure result stay
in the named execution root. Cleanup is bounded, forced cleanup fails, and final
source/lock/HEAD/index checks remain required. The conductor does not release the
coordinator's slot or write the primary's handoff.

## Provenance and current qualification

The original temporary runner and sealer are retained byte-identically as private
evidence. The runner was 4,949 bytes with SHA-256
`df023b60eae4512d1f556aafb7db14879c9544bbfd527f9099b6714e43af0d88`;
the sealer was 7,026 bytes with SHA-256
`bcba2d3f353e41a8886654ca55cc45cbfda273ba70e16a780a3adcf7044fed3a`.
Their earlier hardcoded requests, implicit execution directories and handoff
writes are historical behavior, not current executable dependencies. Retained
Phase A evidence includes 77 passing assertions and six syntax results. It also
includes the failed archive-intake row; none of these receipts is rewritten or
relabeled after the source repair.

The repaired wrapper, its 18 authored Python cases, maintained sealer and
maintained conductor are **unrun** under the current source-only lease. All 17
Campus hook cases and 190 shared cases across ten consumers remain unrun. Their
successor request must use new source/tool/request seals and output roots while
reusing only unaffected passing receipts. Source fixtures do not establish
compiled tour, real native rendering, worker/update, media, bootstrap, publication
history or remote admission acceptance. Scene layers, bus routes, Gopher tunnels
and image-connection lines stay future planning.
