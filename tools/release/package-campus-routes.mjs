#!/usr/bin/env node
/** Finite three-route release conductor. Hashes are derived from actual predecessor outputs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { appBuildSource, writeAppRelease, CAMPUS_ROUTES } from '@umn-vr/app/release';
import { createFourRouteAssemblyInput } from '@umn-vr/app/compiled-integration';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ids = ['minneapolis', 'st-paul', 'twin-cities'];
const [inputFile, outputDirectory] = process.argv.slice(2);
assert.equal(process.argv.length, 4, 'Usage: node tools/release/package-campus-routes.mjs SEALED_PREDECESSOR_INPUT_JSON NEW_RELEASE_ROOT');
function regular(file, limit = 32 * 1024 * 1024) {
  const absolute = path.resolve(file); let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) { current = path.join(current, part); assert.equal(lstatSync(current).isSymbolicLink(), false); }
  const stat = lstatSync(absolute); assert.ok(stat.isFile() && stat.size <= limit); return readFileSync(absolute);
}
function pinned(pin, limit) { const bytes = regular(pin.path, limit); assert.equal(bytes.length, pin.sizeBytes); assert.equal(sha(bytes), pin.sha256); return bytes; }
function json(file) { return JSON.parse(regular(file).toString('utf8')); }
function source(root, packageName, expected) {
  assert.equal(realpathSync(root), path.resolve(root));
  const manifest = json(path.join(root, 'package.json')); assert.equal(manifest.name, packageName);
  const git = (...args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, timeout: 5000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }).trim();
  const actual = { commit: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')), packageVersion: manifest.version };
  assert.deepEqual(actual, expected, 'Actual current owner source identity must equal reviewed predecessor identity'); return actual;
}
function write(file, value) { writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
const input = json(inputFile); assert.equal(input.format, 'umn-three-route-release-predecessors'); assert.equal(input.version, 1);
assert.deepEqual(input.routes.map(route => route.id), ids);
pinned(input.app.archive, 32 * 1024 * 1024); pinned(input.app.qualificationReceipt, 16 * 1024 * 1024);
const appSource = source(input.app.sourceRoot, '@umn-vr/app', input.app.source);
const productionBytes = pinned(input.production.receipt, 32 * 1024 * 1024), production = JSON.parse(productionBytes);
assert.equal(production.status, 'PASS'); assert.equal(production.mediaCopiesPerformed, 0);
assert.deepEqual(production.scenes.map(scene => scene.id), ids); assert.deepEqual(production.scenes.map(scene => scene.entities), [48, 12, 60]);
assert.equal(production.scenes[2].links, 134); assert.equal(production.scenes[2].groups, 24);
const worker = json(path.join(input.finalizedDirectory, 'worker-binding.json'));
const workerQualification = regular(path.join(input.finalizedDirectory, 'worker-qualification.json'), 16 * 1024 * 1024);
assert.equal(sha(workerQualification), worker.qualificationReceiptSha256); assert.equal(JSON.parse(workerQualification).status, 'PASS');
const output = path.resolve(outputDirectory); assert.equal(realpathSync(path.dirname(output)), path.dirname(output)); mkdirSync(output);
const prepared = path.join(output, 'prepared-content'); mkdirSync(prepared);
const scenes = [], preparedFiles = [], emitted = [];
try {
  for (const route of input.routes) {
    const mountPath = `/tour/${route.id}/`; assert.equal(CAMPUS_ROUTES[mountPath], route.repository);
    const produced = production.scenes.find(scene => scene.id === route.id);
    const manifestBytes = regular(produced.path, 8 * 1024 * 1024); assert.equal(manifestBytes.length, produced.sizeBytes); assert.equal(sha(manifestBytes), produced.sha256);
    const publication = new URL(produced.url); assert.equal(publication.origin, 'https://umn-vr.github.io'); assert.equal(publication.search, ''); assert.equal(publication.hash, '');
    const manifestUrl = publication.pathname; assert.ok(manifestUrl.startsWith(mountPath) && manifestUrl !== '/tour/twin-cities/scene.json');
    const relative = decodeURIComponent(manifestUrl.slice(1)); assert.ok(relative.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes('\\')));
    const preparedPath = path.join(prepared, relative); mkdirSync(path.dirname(preparedPath), { recursive: true }); writeFileSync(preparedPath, manifestBytes, { flag: 'wx' });
    preparedFiles.push({ path: relative, bytes: manifestBytes.length, sha256: produced.sha256 });
    const sceneSource = source(route.sourceRoot, '@umn-vr/' + route.id, route.source);
    const directory = path.join(input.finalizedDirectory, route.id), html = regular(path.join(directory, mountPath.slice(1), 'index.html'), 2 * 1024 * 1024).toString('utf8');
    const sourceStamp = appBuildSource(html, appSource), releaseDirectory = path.join(output, route.id);
    const result = writeAppRelease({ input: directory, output: releaseDirectory, mountPath, source: sourceStamp,
      app: { repository: 'UMN-VR/app', revision: appSource.commit, packageVersion: appSource.packageVersion, archiveSha256: input.app.archive.sha256 },
      scene: { repository: route.repository, source: { ...sceneSource, builtAt: sourceStamp.builtAt } },
      content: { manifestUrl, revision: produced.revision, manifestSha256: produced.sha256 }, worker });
    scenes.push({ directory: releaseDirectory, pin: result.clubPin });
    emitted.push({ id: route.id, directory: releaseDirectory, descriptorSha256: result.descriptorSha256, builtAt: sourceStamp.builtAt,
      content: preparedFiles.at(-1), source: sourceStamp, sceneSource, worker });
  }
  const selectorPin = input.selector.pin;
  const selector = { directory: input.selector.directory, pin: selectorPin };
  const compiled = { schemaVersion: 1, selector, scenes, preparedContent: { directory: prepared, files: preparedFiles }, media: input.media, retained: input.retained };
  const assembly = createFourRouteAssemblyInput(compiled);
  write(path.join(output, 'compiled-predecessors.json'), compiled); write(path.join(output, 'assembly-input.json'), assembly);
  write(path.join(output, 'route-package-receipt.json'), { format: 'umn-three-route-package-receipt', version: 1, status: 'PASS',
    inputSha256: sha(regular(inputFile)), productionReceiptSha256: sha(productionBytes), appArchiveSha256: input.app.archive.sha256,
    mediaCopiesPerformed: 0, scenes: emitted, assemblyInputSha256: sha(regular(path.join(output, 'assembly-input.json'))) });
  console.log(JSON.stringify({ status: 'PASS', output, routes: scenes.map(scene => scene.pin.mountPath), assemblyInput: path.join(output, 'assembly-input.json') }));
} catch (error) {
  write(path.join(output, 'route-package-failure.json'), { status: 'FAIL', inputSha256: sha(regular(inputFile)), emitted, message: String(error.message ?? error) }); throw error;
}
