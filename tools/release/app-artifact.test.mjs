import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { CAMPUS_ROUTES, sha256, verifyAppRelease, writeAppRelease } from './artifact.mjs';
import { planAppDelivery } from './delivery.mjs';

mkdirSync('.local/checks', { recursive: true });
const root = mkdtempSync(path.resolve('.local/checks/independent-app-release-'));
// Synthetic consumer evidence only; these fixtures do not qualify a real worker producer.
function fixture(mountPath = '/tour/minneapolis/') {
  const folder = mkdtempSync(path.join(root, 'fixture-')), input = path.join(folder, 'app'), output = path.join(folder, 'release');
  mkdirSync(path.join(input, mountPath.slice(1)), { recursive: true }); mkdirSync(path.join(input, 'assets'));
  const source = { commit: 'a'.repeat(40), dirty: false, packageVersion: '0.1.0', builtAt: '2026-10-10T12:00:00Z' };
  const app = { repository: 'UMN-VR/app', revision: source.commit, packageVersion: source.packageVersion, archiveSha256: 'c'.repeat(64) };
  const scene = { repository: CAMPUS_ROUTES[mountPath], source: { ...source, commit: 'd'.repeat(40) } };
  const content = { manifestUrl: `https://content.example.org/${scene.repository.slice(7)}/r1/scene.json`, revision: 'fixture-r1', manifestSha256: 'e'.repeat(64) };
  const workerBytes = '/* synthetic root worker */', sealBytes = 'synthetic opaque seal';
  const worker = { url: '/foss-earth-sw.js', scope: '/', sha256: sha256(workerBytes), buildSealPath: 'worker-build-seal.json', buildSealSha256: sha256(sealBytes), qualificationReceiptSha256: 'f'.repeat(64), producer: { repository: 'foss-earth/example-worker', revision: 'b'.repeat(40), archiveSha256: '1'.repeat(64) } };
  const stamps = {
    'umn-vr-app-source': source.commit, 'umn-vr-app-package-version': source.packageVersion, 'umn-vr-built-at': source.builtAt,
    'umn-vr-app-archive-sha256': app.archiveSha256, 'umn-vr-scene-source': scene.source.commit,
    'umn-vr-scene-package-version': scene.source.packageVersion, 'umn-vr-scene-owner': scene.repository,
    'umn-vr-content-url': content.manifestUrl, 'umn-vr-content-revision': content.revision,
    'umn-vr-content-sha256': content.manifestSha256, 'umn-vr-worker-build-seal-sha256': worker.buildSealSha256,
  };
  const html = Object.entries(stamps).map(([name, value]) => `<meta name="${name}" content="${value}">`).join('') + '<script src="/assets/shared.js"></script>';
  writeFileSync(path.join(input, mountPath.slice(1), 'index.html'), html);
  writeFileSync(path.join(input, 'assets/shared.js'), 'shared App fixture');
  writeFileSync(path.join(input, 'foss-earth-sw.js'), workerBytes); writeFileSync(path.join(input, worker.buildSealPath), sealBytes);
  return { input, output, mountPath, source, app, scene, content, worker };
}

test('independent route artifacts bind their scene, App archive, content, build and root worker', () => {
  for (const mountPath of Object.keys(CAMPUS_ROUTES)) {
    const input = fixture(mountPath), packaged = writeAppRelease(input);
    const verified = verifyAppRelease(input.output, packaged.descriptorSha256);
    assert.equal(verified.release.scene.repository, CAMPUS_ROUTES[mountPath]);
    assert.equal(verified.release.app.archiveSha256, input.app.archiveSha256);
    assert.equal(verified.release.worker.url, '/foss-earth-sw.js'); assert.equal(verified.release.worker.scope, '/');
    assert.equal(verified.release.compatibility.currentTabIds.length, 13);
    assert.equal(packaged.clubPin.sceneRepository, input.scene.repository);
    assert.equal(verified.release.files.some(file => file.path.endsWith('/scene.json')), false);
  }
});
test('rejects wrong scene owner, content and App pins before creating release output', () => {
  for (const field of ['scene', 'content', 'app', 'mountPath']) {
    const input = fixture();
    const altered = field === 'scene' ? { scene: { ...input.scene, repository: 'UMN-VR/st-paul' } }
      : field === 'content' ? { content: { ...input.content, manifestSha256: '0'.repeat(64) } }
      : field === 'app' ? { app: { ...input.app, archiveSha256: '0'.repeat(64) } } : { mountPath: '/tour/other/' };
    assert.throws(() => writeAppRelease({ ...input, ...altered }), /owner|pin|route/); assert.equal(existsSync(input.output), false);
  }
});
test('cannot package without actual worker seal and exact qualification evidence', () => {
  for (const kind of ['missing-seal', 'missing-receipt', 'wrong-worker', 'seal-is-worker']) {
    const input = fixture(), worker = { ...input.worker };
    if (kind === 'missing-seal') worker.buildSealPath = 'missing-seal.json';
    if (kind === 'missing-receipt') delete worker.qualificationReceiptSha256;
    if (kind === 'wrong-worker') worker.sha256 = '0'.repeat(64);
    if (kind === 'seal-is-worker') { worker.buildSealPath = 'foss-earth-sw.js'; worker.buildSealSha256 = worker.sha256; }
    assert.throws(() => writeAppRelease({ ...input, worker }), /seal|qualified|output|worker/); assert.equal(existsSync(input.output), false);
  }
});
test('public verification rejects relabeled scene/content/build stamps even with a new descriptor pin', () => {
  for (const kind of ['scene', 'content', 'time']) {
    const input = fixture(); writeAppRelease(input);
    const file = path.join(input.output, 'app-release.json'), release = JSON.parse(readFileSync(file, 'utf8'));
    if (kind === 'scene') release.scene.source.commit = '2'.repeat(40);
    if (kind === 'content') release.content.manifestSha256 = '0'.repeat(64);
    if (kind === 'time') { release.source.builtAt = '2026-10-10T13:00:00Z'; release.scene.source.builtAt = release.source.builtAt; }
    const bytes = JSON.stringify(release); writeFileSync(file, bytes);
    assert.throws(() => verifyAppRelease(input.output, sha256(bytes)), /pin|build time/);
  }
});
test('rejects another route/media, payload changes and symlink aliases; preserves input/output', () => {
  const media = fixture(); writeFileSync(path.join(media.input, 'tour/minneapolis/scene.json'), '{}');
  assert.throws(() => writeAppRelease(media), /media/); assert.equal(existsSync(media.output), false);
  const corrupt = fixture(), pin = writeAppRelease(corrupt).descriptorSha256;
  writeFileSync(path.join(corrupt.output, 'payload/assets/shared.js'), 'changed'); assert.throws(() => verifyAppRelease(corrupt.output, pin), /mismatch/);
  const linked = fixture(), alias = path.join(path.dirname(linked.input), 'input-alias'); symlinkSync(linked.input, alias);
  assert.throws(() => writeAppRelease({ ...linked, output: path.join(alias, 'nested') }), /outside|regular/); assert.equal(existsSync(path.join(linked.input, 'nested')), false);
  const payload = fixture(), packaged = writeAppRelease(payload); symlinkSync(payload.input, path.join(payload.output, 'payload/assets/link'));
  assert.throws(() => verifyAppRelease(payload.output, packaged.descriptorSha256), /symlink/);
});
test('App dry run retains exact older resources and does not modify supplied releases', () => {
  const old = fixture(), current = fixture(); writeFileSync(path.join(old.input, 'assets/older-hashed.js'), 'retained old resource');
  const previous = writeAppRelease(old), selected = writeAppRelease(current), before = readFileSync(path.join(old.output, 'payload/tour/minneapolis/index.html'));
  const plan = planAppDelivery({ directory: current.output, descriptorSha256: selected.descriptorSha256, retained: [{ kind: 'app', directory: old.output, descriptorSha256: previous.descriptorSha256 }] });
  assert.deepEqual(plan.retainsFromSuppliedReleases, ['assets/older-hashed.js']); assert.deepEqual(plan.deletes, []);
  assert.equal(plan.scene.repository, 'UMN-VR/minneapolis'); assert.deepEqual(readFileSync(path.join(old.output, 'payload/tour/minneapolis/index.html')), before);
});
test('App retention rejects changed immutable resources and untyped retained inputs', () => {
  const old = fixture(), current = fixture(); writeFileSync(path.join(current.input, 'assets/shared.js'), 'changed immutable path');
  const previous = writeAppRelease(old), selected = writeAppRelease(current);
  const input = { directory: current.output, descriptorSha256: selected.descriptorSha256, retained: [{ kind: 'app', directory: old.output, descriptorSha256: previous.descriptorSha256 }] };
  assert.throws(() => planAppDelivery(input), /immutable App path/);
  assert.throws(() => planAppDelivery({ ...input, retained: [{ directory: old.output, descriptorSha256: previous.descriptorSha256 }] }), /kind must be explicit/);
});
