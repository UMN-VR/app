#!/usr/bin/env node
/** Finite Campus stage inputs and seals. Root owns every command, clock and process group. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, lstatSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ids = ['minneapolis', 'st-paul', 'twin-cities'], sha = bytes => createHash('sha256').update(bytes).digest('hex');
const [stage, inputFile] = process.argv.slice(2);
assert.equal(process.argv.length, 4, 'Usage: node campus-compiled-stages.mjs NAMED_STAGE SEALED_INPUT_JSON');
const stages = ['init', 'production-input', 'build-inputs', 'selector-release', 'finalizer-input', 'package-input', 'verify-assembly', 'second-finalizer-input', 'native-binding'];
assert.ok(stages.includes(stage));
function regular(file, maximum = 32 * 1024 * 1024) {
  const absolute = path.resolve(file); let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) { cursor = path.join(cursor, part); assert.equal(lstatSync(cursor).isSymbolicLink(), false); }
  const stat = lstatSync(absolute); assert.ok(stat.isFile() && stat.size <= maximum); return readFileSync(absolute);
}
function pin(file, maximum) { const bytes = regular(file, maximum); return { path: path.resolve(file), sizeBytes: bytes.length, sha256: sha(bytes) }; }
function pinned(value, maximum) { assert.match(value.sha256 ?? '', /^[a-f0-9]{64}$/); const bytes = regular(value.path, maximum); assert.equal(bytes.length, value.sizeBytes); assert.equal(sha(bytes), value.sha256); return bytes; }
function json(file, maximum) { return JSON.parse(regular(file, maximum)); }
function write(file, value) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
function safeRelative(value) { assert.ok(typeof value === 'string' && value && !value.includes('\\') && !/[\0\r\n]/.test(value) && !path.posix.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..')); return value; }
const input = json(inputFile); assert.equal(input.format, 'umn-sealed-campus-compiled-stages'); assert.equal(input.version, 1);
assert.equal(input.origin, 'http://localhost:4176/'); assert.equal(input.media.mediaBaseUrl, input.origin + 'tour/twin-cities/');
assert.equal(input.localPort, 4176); assert.equal(input.bindAddress, '127.0.0.1');
const root = path.resolve(input.outputRoot), assembly = path.resolve(input.assemblyRoot), inputs = path.join(root, 'inputs');
for (const output of [root, assembly]) {
  assert.ok(output.includes('/.local/build/'));
  let ancestor = path.dirname(output); while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  assert.equal(realpathSync(ancestor), ancestor); assert.ok(lstatSync(ancestor).isDirectory());
}
assert.notEqual(root, assembly); assert.ok(!assembly.startsWith(root + path.sep) && !root.startsWith(assembly + path.sep));
const node = input.executables.node, npm = input.executables.npm;
assert.ok(path.isAbsolute(node) && path.isAbsolute(npm)); assert.ok(lstatSync(realpathSync(node)).isFile() && lstatSync(realpathSync(npm)).isFile());
const packageRoot = path.resolve(input.executionPackageRoot); assert.ok(packageRoot.includes('/node_modules/@umn-vr/app'));
assert.equal(realpathSync(packageRoot), packageRoot); assert.equal(fileURLToPath(import.meta.url), path.join(packageRoot, 'tools/release/campus-compiled-stages.mjs'));
const appTools = path.join(packageRoot, 'tools/release'), ownCommand = [node, path.join(appTools, 'campus-compiled-stages.mjs')];
const source = owner => {
  assert.equal(realpathSync(owner.root), owner.root); const manifest = json(path.join(owner.root, 'package.json')); assert.equal(manifest.name, owner.package);
  const git = (...args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: owner.root, timeout: 5000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }).trim();
  const actual = { commit: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')), packageVersion: manifest.version };
  assert.deepEqual(actual, owner.source); assert.match(actual.commit, /^[a-f0-9]{40}$/); return actual;
};
assert.deepEqual(Object.keys(input.owners).sort(), ['app', 'club', 'minneapolis', 'st-paul', 'tour', 'twin-cities'].sort());
for (const owner of Object.values(input.owners)) source(owner);
if (stage !== 'init') { const prepared = json(path.join(root, 'stage-plan.json')); assert.equal(prepared.inputSha256, sha(regular(inputFile))); assert.equal(prepared.origin, input.origin); }
function production() { const receipt = json(path.join(root, 'produced-scenes/production-receipt.json')); assert.equal(receipt.status, 'PASS'); assert.equal(receipt.mediaCopiesPerformed, 0); assert.deepEqual(receipt.scenes.map(row => row.id), ids); return receipt; }
function meta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [], matches = tags.filter(tag => new RegExp('\\bname=["\x27]' + name + '["\x27]').test(tag));
  assert.equal(matches.length, 1, 'One measured actual HTML stamp: ' + name); const content = matches[0].match(/\bcontent=["']([^"']*)["']/); assert.ok(content); return content[1];
}
function collect(directory, prefix = '') {
  assert.equal(realpathSync(directory), path.resolve(directory)); const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    assert.ok(!entry.isSymbolicLink() && (entry.isFile() || entry.isDirectory())); const relative = safeRelative(prefix + entry.name), target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...collect(target, relative + '/')); else result.push({ path: relative, source: target });
    assert.ok(result.length <= 70000);
  }
  return result;
}
function row(id, cwd, argv, seconds, outputs, environment = {}) { return { id, cwd, argv, timeoutSeconds: seconds, workers: 1, environment: { GIT_OPTIONAL_LOCKS: '0', ...environment }, outputs, state: 'UNRUN_ROOT_GRANT_REQUIRED', gate: 'Actual exit0 plus complete closed log, exact output seals and positively absent owned group. Stop on failure; no network, implicit retry or grant renewal.' }; }
function namedStage(name, seconds = 60) { return row(name, input.owners.club.root, [...ownCommand, name, path.resolve(inputFile)], seconds, [root]); }
function finalizeInput(second) {
  const retained = [...input.retainedWorkerFiles];
  if (second) {
    const first = json(path.join(root, 'finalized-first/worker-binding.json'));
    const seal = json(path.join(root, 'finalized-first/twin-cities', first.buildSealPath)); assert.equal(seal.mediaIncluded, false);
    for (const route of seal.rawRoutes) for (const file of route.files.filter(item => item.path.startsWith('assets/'))) {
      const value = { url: '/' + file.path, sha256: file.sha256, sizeBytes: file.sizeBytes }, old = retained.find(item => item.url === value.url);
      if (old) assert.deepEqual(old, value); else retained.push(value);
    }
  }
  assert.ok(retained.length > 0 && retained.length <= 4096);
  write(path.join(inputs, second ? 'second-finalizer.json' : 'first-finalizer.json'), { schemaVersion: 1, producer: input.uiProducer,
    routes: ids.map(id => ({ id, directory: path.join(root, 'raw', second && id === 'twin-cities' ? 'twin-cities-second' : id) })),
    retainedFiles: retained, cacheNamespace: input.cacheNamespace, messageIdentity: input.messageIdentity });
}
if (stage === 'init') {
  assert.equal(existsSync(root), false); assert.equal(existsSync(assembly), false);
  assert.ok(Array.isArray(input.sourceFreePackages) && input.sourceFreePackages.length >= 10 && input.sourceFreePackages.length <= 32);
  let checkedBytes = 0;
  for (const provider of input.sourceFreePackages) {
    assert.ok(provider.root.includes('/node_modules/') && realpathSync(provider.root) === provider.root);
    assert.equal(json(path.join(provider.root, 'package.json')).name, provider.package);
    pinned(provider.archive, 100 * 1024 * 1024); pinned(provider.qualificationReceipt, 32 * 1024 * 1024);
    assert.ok(Array.isArray(provider.files) && provider.files.length > 0 && provider.files.length <= 8192);
    for (const file of provider.files) { checkedBytes += pinned({ ...file, path: path.join(provider.root, safeRelative(file.path)) }, 100 * 1024 * 1024).length; assert.ok(checkedBytes <= 512 * 1024 * 1024); }
  }
  assert.ok(input.nativeProviders.length === 6 && input.installedSources.length >= 4); pinned(input.app.archive, 32 * 1024 * 1024); pinned(input.app.qualificationReceipt, 32 * 1024 * 1024);
  assert.deepEqual(Object.keys(input.nativeOptionsByRoute).sort(), [...ids].sort()); assert.deepEqual(Object.keys(input.routeArtifacts).sort(), [...ids].sort());
  for (const id of ids) {
    const options = input.nativeOptionsByRoute[id], artifacts = input.routeArtifacts[id], owner = input.owners[id];
    pinned(artifacts.archive, 32 * 1024 * 1024); pinned(artifacts.qualificationReceipt, 32 * 1024 * 1024);
    assert.equal(options.about.release.host, 'UMN-VR/' + id);
    const hosts = options.about.release.artifacts.filter(item => item.package === owner.package && item.role === 'runtime' && item.availability === 'available');
    assert.equal(hosts.length, 1); assert.equal(hosts[0].revision, owner.source.commit); assert.equal(hosts[0].version, owner.source.packageVersion); assert.equal(hosts[0].sha256, artifacts.archive.sha256);
    const published = new URL(options.deployment.publishedVersionUrl, input.origin); assert.equal(published.origin, new URL(input.origin).origin); assert.equal(published.pathname, '/tour/' + id + '/'); assert.equal(published.search, ''); assert.equal(published.hash, '');
    assert.equal(options.deployment.workerUrl, '/foss-earth-sw.js'); assert.equal(options.deployment.workerScope, '/'); assert.equal(options.deployment.cacheNamespace, input.cacheNamespace);
    assert.ok(!/\/Users\/|\/\.local\/|node_modules\/|file:/.test(JSON.stringify(options)), 'Compiled public native options must not expose private machine paths');
  }
  assert.equal(new Set(input.installedSources.map(item => item.package)).size, input.installedSources.length);
  for (const provider of input.nativeProviders) {
    assert.match(provider.revision, /^[a-f0-9]{40}$/); const installed = input.sourceFreePackages.find(item => item.package === '@' + provider.repository); assert.ok(installed);
    assert.equal(installed.archive.sha256, provider.archiveSha256); assert.equal(installed.qualificationReceipt.sha256, provider.qualificationReceiptSha256);
    assert.equal(input.installedSources.find(item => item.package === installed.package)?.sourceIdentity, provider.revision);
  }
  pinned(input.uiProducer.archive, 32 * 1024 * 1024); pinned(input.uiProducer.qualificationReceipt, 32 * 1024 * 1024);
  assert.equal(input.uiProducer.archiveSha256, input.uiProducer.archive.sha256); assert.equal(input.uiProducer.qualificationReceiptSha256, input.uiProducer.qualificationReceipt.sha256);
  assert.equal(input.uiProducer.repository, 'foss-earth/ui'); assert.match(input.uiProducer.sourceIdentity, /^[a-f0-9]{40}$/);
  pinned(input.media.inventory); for (const value of Object.values(input.production.sources)) pinned(value);
  assert.ok(input.retained.length > 0); for (const file of input.retainedWorkerFiles) { assert.ok(file.url.startsWith('/assets/')); assert.match(file.sha256, /^[a-f0-9]{64}$/); }
  mkdirSync(path.dirname(root), { recursive: true }); mkdirSync(path.dirname(assembly), { recursive: true });
  mkdirSync(root); for (const dir of ['inputs', 'raw', 'logs', 'receipts']) mkdirSync(path.join(root, dir));
  write(path.join(inputs, 'media.json'), input.media);
  const commands = [row('hash-one-media-release', input.owners.club.root, [node, path.join(appTools, 'hash-named-media.mjs'), path.join(inputs, 'media.json'), path.join(root, 'measured-media')], 900, [path.join(root, 'measured-media')]), namedStage('production-input'),
    row('produce-three-scenes', input.owners.club.root, [node, path.join(appTools, 'produce-campus-scenes.mjs'), path.join(inputs, 'production.json'), path.join(root, 'produced-scenes')], 600, [path.join(root, 'produced-scenes')]), namedStage('build-inputs'),
    row('build-selector', input.owners.tour.root, [npm, 'run', 'build', '--', '--outDir', path.join(root, 'raw/selector')], 120, [path.join(root, 'raw/selector')]), namedStage('selector-release')];
  for (const id of ids) commands.push(row('build-' + id, input.owners[id].root, [npm, 'run', 'build', '--', '--outDir', path.join(root, 'raw', id)], 180, [path.join(root, 'raw', id)], { UMN_CAMPUS_BUILD_INPUT: path.join(inputs, id + '-build.json') }));
  commands.push(namedStage('finalizer-input'), row('finalize-first-worker', input.owners.club.root, [node, path.join(appTools, 'finalize-route-bundles.mjs'), path.join(inputs, 'first-finalizer.json'), path.join(root, 'finalized-first')], 180, [path.join(root, 'finalized-first')]), namedStage('package-input'),
    row('package-three-routes', input.owners.club.root, [node, path.join(appTools, 'package-campus-routes.mjs'), path.join(inputs, 'route-packages.json'), path.join(root, 'route-packages')], 180, [path.join(root, 'route-packages')]),
    row('assemble-canonical-four-routes', input.owners.club.root, [node, path.join(input.owners.club.root, 'tools/build.mjs'), path.join(root, 'route-packages/assembly-input.json'), assembly], 900, [assembly]), namedStage('verify-assembly', 900),
    row('build-second-twin-cities', input.owners['twin-cities'].root, [npm, 'run', 'build', '--', '--outDir', path.join(root, 'raw/twin-cities-second')], 180, [path.join(root, 'raw/twin-cities-second')], { UMN_CAMPUS_BUILD_INPUT: path.join(inputs, 'twin-cities-build.json') }), namedStage('second-finalizer-input'),
    row('finalize-second-worker', input.owners.club.root, [node, path.join(appTools, 'finalize-route-bundles.mjs'), path.join(inputs, 'second-finalizer.json'), path.join(root, 'finalized-second')], 180, [path.join(root, 'finalized-second')]), namedStage('native-binding'));
  write(path.join(root, 'stage-plan.json'), { format: 'umn-finite-compiled-stage-plan', version: 1, inputSha256: sha(regular(inputFile)), origin: input.origin, localPort: input.localPort, bindAddress: input.bindAddress,
    prerequisite: 'Exact qualified source-free packages already installed; actual source identities and artifact/provenance receipts preflighted. All install/build/pack/adoption prerequisite qualifications have separate retained scope receipts.',
    commands, maximumQualificationSeconds: 60 + commands.reduce((sum, command) => sum + command.timeoutSeconds, 0), singleCleanupReserveSeconds: 55, sourceFreeInstalledBytesChecked: checkedBytes,
    humanPreview: { directory: assembly, argv: [input.executables.python, '-m', 'http.server', '4176', '--bind', '127.0.0.1'], cwd: assembly, urls: ['/', '/tour/', ...ids.map(id => '/tour/' + id + '/')].map(value => new URL(value, input.origin).href), state: 'UNTESTED_REQUIRES_ROOT_NATIVE_AND_START_COMMAND_RECEIPTS' } });
} else if (stage === 'production-input') {
  const receipt = json(path.join(root, 'measured-media/hash-receipt.json')); assert.equal(receipt.status, 'PASS'); assert.equal(receipt.filesHashed, 62582); assert.equal(receipt.bytesRead, 694126088); assert.equal(receipt.independentVerificationBytes, 694126088);
  const directory = path.join(root, 'measured-media/release'), descriptor = pin(path.join(directory, 'prepared-media-release.json'));
  assert.equal(descriptor.sha256, receipt.descriptor.sha256);
  write(path.join(inputs, 'production.json'), { ...input.production, baseline: input.media.baseline, media: { descriptor, directory, sourceRoot: input.media.sourceRoot, baseUrl: input.media.mediaBaseUrl, indexUrl: input.origin + 'tour/twin-cities/media-index.json' } });
} else if (stage === 'build-inputs') {
  const receipt = production();
  for (const id of ids) {
    const scene = receipt.scenes.find(row => row.id === id); assert.equal(pin(scene.path).sha256, scene.sha256); const manifest = new URL(scene.url); assert.equal(manifest.origin, 'https://umn-vr.github.io');
    write(path.join(inputs, id + '-build.json'), { mountPath: '/tour/' + id + '/', app: { ...input.owners.app.source, archiveSha256: input.app.archive.sha256 },
      content: { manifestUrl: manifest.pathname, revision: scene.revision, manifestSha256: scene.sha256 },
      nativeHost: { repository: 'UMN-VR/app', revision: input.owners.app.source.commit, publicModule: '@umn-vr/app/native', exportName: 'createCampusNativeHostFactory', archiveSha256: input.app.archive.sha256,
        qualificationReceiptSha256: input.app.qualificationReceipt.sha256, options: input.nativeOptionsByRoute[id], providers: input.nativeProviders }, installedSources: input.installedSources,
      worker: { stage: 'PREPARED_FOR_SHARED_ASSEMBLY', url: '/foss-earth-sw.js', scope: '/', buildSealPath: 'assets/pending-shared-worker-seal.json', qualificationReceiptSha256: input.uiProducer.qualificationReceiptSha256,
        producer: { repository: 'foss-earth/ui', revision: input.uiProducer.sourceIdentity, archiveSha256: input.uiProducer.archiveSha256 } }, workerPlugin: { publicModule: '@foss-earth/ui/vite', exportName: 'appFiles' } });
  }
} else if (stage === 'selector-release') {
  const { writeSelectorRelease } = await import('@umn-vr/tour/release');
  const html = regular(path.join(root, 'raw/selector/index.html')).toString('utf8'), builtAt = meta(html, 'umn-vr-selector-build');
  const result = writeSelectorRelease({ input: path.join(root, 'raw/selector'), output: path.join(root, 'selector-release'), source: { ...input.owners.tour.source, builtAt } });
  write(path.join(root, 'selector-pin.json'), { schemaVersion: 1, repository: 'UMN-VR/tour', mountPath: '/tour/', descriptorSha256: result.descriptorSha256 });
} else if (stage === 'finalizer-input' || stage === 'second-finalizer-input') finalizeInput(stage === 'second-finalizer-input');
else if (stage === 'package-input') {
  production(); write(path.join(inputs, 'route-packages.json'), { format: 'umn-three-route-release-predecessors', version: 1, app: { ...input.app, sourceRoot: input.owners.app.root, source: input.owners.app.source },
    production: { receipt: pin(path.join(root, 'produced-scenes/production-receipt.json')) }, finalizedDirectory: path.join(root, 'finalized-first'),
    routes: ids.map(id => ({ id, repository: 'UMN-VR/' + id, sourceRoot: input.owners[id].root, source: input.owners[id].source })),
    selector: { directory: path.join(root, 'selector-release'), pin: json(path.join(root, 'selector-pin.json')) },
    media: { directory: path.join(root, 'measured-media/release'), descriptorSha256: pin(path.join(root, 'measured-media/release/prepared-media-release.json')).sha256, publicRoot: input.media.publicRoot }, retained: input.retained });
} else if (stage === 'verify-assembly') {
  const receiptFile = path.join(assembly, 'club-tour-assembly.json'), receipt = json(receiptFile); assert.equal(receipt.schemaVersion, 2); assert.equal(receipt.owner, 'UMN-VR/UMN-VR.github.io'); assert.equal(receipt.routes.length, 4);
  let total = 0; const files = collect(assembly).map(file => { const measured = pin(file.source, 100 * 1024 * 1024); total += measured.sizeBytes; assert.ok(total <= 900 * 1024 * 1024); return { path: file.path, bytes: measured.sizeBytes, sha256: measured.sha256 }; }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const payload = files.filter(file => file.path !== 'club-tour-assembly.json'); assert.equal(payload.length, receipt.files); assert.equal(payload.reduce((sum, file) => sum + file.bytes, 0), receipt.bytes); assert.equal(sha(JSON.stringify(payload)), receipt.inventorySha256);
  const mapFile = path.join(root, 'assembly-full-file-map.json'); write(mapFile, { format: 'umn-actual-compiled-assembly-full-file-map', version: 1, files });
  write(path.join(root, 'assembly-verification.json'), { format: 'umn-actual-compiled-assembly-verification', version: 1, status: 'PASS', origin: input.origin, assemblyRoot: assembly,
    assemblyReceipt: pin(receiptFile), fullFileMap: pin(mapFile), files: files.length, bytes: total, actualWorker: pin(path.join(assembly, 'foss-earth-sw.js')),
    claim: 'Actual compiled file bytes and Club receipt map match; native browser/backend and tested human start command remain separate required gates.' });
} else if (stage === 'native-binding') {
  const verified = json(path.join(root, 'assembly-verification.json')); assert.equal(verified.status, 'PASS'); pinned(verified.assemblyReceipt); pinned(verified.fullFileMap);
  const first = json(path.join(root, 'finalized-first/worker-binding.json')), second = json(path.join(root, 'finalized-second/worker-binding.json'));
  const beforeHTML = pin(path.join(assembly, 'tour/twin-cities/index.html')), candidateRoot = path.join(root, 'finalized-second/twin-cities'), afterHTML = pin(path.join(candidateRoot, 'tour/twin-cities/index.html'));
  const beforeStamp = meta(regular(beforeHTML.path).toString('utf8'), 'foss-earth-build'), afterText = regular(afterHTML.path).toString('utf8'), afterStamp = meta(afterText, 'foss-earth-build'); assert.notEqual(beforeStamp, afterStamp);
  assert.notEqual(beforeHTML.sha256, afterHTML.sha256); assert.notEqual(first.sha256, second.sha256);
  const files = collect(candidateRoot).map(file => { assert.ok(file.path === 'tour/twin-cities/index.html' || file.path === 'foss-earth-sw.js' || /^assets\/[A-Za-z0-9_.-]+$/.test(file.path)); const target = path.join(assembly, file.path), after = pin(file.source, 100 * 1024 * 1024); return { path: file.path, before: existsSync(target) ? pin(target, 100 * 1024 * 1024) : { absent: true }, after }; });
  const scripts = [...afterText.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  const bundles = files.filter(file => file.before.absent === true && scripts.includes('/' + file.path)); assert.equal(bundles.length, 1, 'One actual new immutable JS entry is required');
  const seal = json(path.join(candidateRoot, second.buildSealPath)); assert.equal(seal.mediaIncluded, false); assert.equal(seal.manifest.cacheNamespace, input.cacheNamespace);
  assert.equal(pin(path.join(assembly, 'foss-earth-sw.js')).sha256, first.sha256); assert.equal(pin(path.join(candidateRoot, 'foss-earth-sw.js')).sha256, second.sha256);
  assert.equal(pin(path.join(candidateRoot, second.buildSealPath)).sha256, second.buildSealSha256); assert.equal(meta(afterText, 'umn-vr-worker-build-seal-sha256'), second.buildSealSha256);
  const { keptFilesCacheName } = await import('@foss-earth/ui/browser');
  const updateVerification = path.join(root, 'actual-second-build-verification.json');
  write(updateVerification, { format: 'umn-actual-second-compiled-build-verification', version: 1, status: 'PASS', beforeBuildStamp: beforeStamp, afterBuildStamp: afterStamp, beforeWorker: first, afterWorker: second, files,
    claim: 'Separately executed Vite build and qualified public UI finalization; notification, no automatic reload, explicit reload and new worker activation must be observed by native qualification.' });
  const compiled = { assemblyReceiptSha256: verified.assemblyReceipt.sha256, fullFileMapSha256: verified.fullFileMap.sha256, verificationReceiptSha256: pin(path.join(root, 'assembly-verification.json')).sha256,
    appArchiveSha256: input.app.archive.sha256, workerBuildSealSha256: first.buildSealSha256, buildStamp: beforeStamp };
  const routes = json(path.join(root, 'route-packages/route-package-receipt.json')).scenes;
  const produced = production(), selectorPin = json(path.join(root, 'selector-pin.json'));
  const installedArtifactPins = [];
  for (const source of input.installedSources) {
    const matches = ids.map(id => input.nativeOptionsByRoute[id].about.release.artifacts.filter(item => item.package === source.package && item.role === 'runtime' && item.availability === 'available'));
    if (!matches.every(items => items.length === 1)) continue;
    assert.deepEqual(matches[0][0], matches[1][0]); assert.deepEqual(matches[0][0], matches[2][0]);
    const artifact = matches[0][0]; assert.equal(artifact.revision, source.sourceIdentity); assert.equal(typeof source.dirty, 'boolean');
    installedArtifactPins.push({ package: source.package, version: artifact.version, sourceIdentity: source.sourceIdentity, dirty: source.dirty, archiveSha256: artifact.sha256 });
  }
  assert.ok(installedArtifactPins.length >= 4, 'Observe at least four actual common installed runtime artifacts, not route-specific or reference artifacts');
  write(path.join(root, 'native-compiled-bindings.json'), { format: 'umn-actual-native-compiled-bindings', version: 1, origin: input.origin, localPort: 4176, assemblyRoot: assembly, compiled,
    updateCandidate: { htmlSha256: afterHTML.sha256, verificationReceiptSha256: pin(updateVerification).sha256, buildStamp: afterStamp, workerSha256: second.sha256,
      currentBundleURL: '/' + bundles[0].path, currentBundleSha256: bundles[0].after.sha256, cacheName: keptFilesCacheName(input.origin + 'foss-earth-sw.js', input.cacheNamespace) },
    update: { assemblyRoot: assembly, files, cleanupCreatedFiles: files.filter(file => file.before.absent === true).map(file => file.path) },
    nativeHost: { qualificationReceiptSha256: input.app.qualificationReceipt.sha256 }, installedArtifactPins,
    contentProducer: input.browserContentProducer, observationSourceSha256: input.observationSourceSha256, helper: input.browserHelper,
    routes: [{ id: 'selector', entryURL: input.origin + 'tour/', htmlSha256: pin(path.join(assembly, 'tour/index.html')).sha256, releaseDescriptorSha256: selectorPin.descriptorSha256 }, ...ids.map(id => {
      const release = routes.find(route => route.id === id), scene = produced.scenes.find(row => row.id === id); return { id, entryURL: input.origin + 'tour/' + id + '/', htmlSha256: pin(path.join(assembly, 'tour', id, 'index.html')).sha256,
        releaseDescriptorSha256: release.descriptorSha256, sceneId: scene.sceneId, contentURL: new URL(scene.url).pathname, contentSha256: scene.sha256, contentSizeBytes: scene.sizeBytes, navigationReceiptSha256: pin(path.join(root, 'produced-scenes/production-receipt.json')).sha256 };
    })], exactCreatedFixtureCleanup: 'Root must seal and explicitly authorize this exact list before native fixtures publish. Original canonical assembly is unmodified by this conductor; each native fixture must restore baseline under the one remaining cleanup reserve.',
    qualification: 'Four compiled routes and actual second build bound. Six real browser/backend cells, feature observations, shared input-helper qualification, and tested human start command remain root-owned required work.' });
}
console.log(JSON.stringify({ state: 'STAGE_INPUTS_OR_ACTUAL_BYTES_SEALED', stage, outputRoot: root, assemblyRoot: assembly, origin: input.origin, noExecutionGrantCreated: true }));
