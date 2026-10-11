/** Campus release binding; upstream owns scene, image and worker production. */
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CURRENT_TAB_IDS, sha256 } from './legacy-artifact.mjs';
export const CAMPUS_ROUTES = Object.freeze({ '/tour/minneapolis/': 'UMN-VR/minneapolis', '/tour/st-paul/': 'UMN-VR/st-paul', '/tour/twin-cities/': 'UMN-VR/twin-cities' });
const SHA = /^[0-9a-f]{64}$/, COMMIT = /^[0-9a-f]{40}$/;
const LANDING = ['index.md', '_config.yml', 'index.html', 'Media '];
const identity = source => `${source.commit}${source.dirty ? '-dirty' : ''}`;
function attributeText(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const numeric = entity.slice(2, -1);
    return String.fromCodePoint(numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric));
  });
}
function pageMeta(html, name) {
  const tags = (html.match(/<meta\b[^>]*>/gi) ?? []).filter(tag => tag.includes(`name="${name}"`));
  if (tags.length !== 1) throw new Error(`App output needs one ${name} stamp`);
  return attributeText(tags[0].match(/\bcontent="([^"]+)"/)?.[1] ?? '');
}
function validateSource(source, label) {
  if (!COMMIT.test(source?.commit ?? '') || typeof source.dirty !== 'boolean' || typeof source.packageVersion !== 'string'
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(source.packageVersion)
    || typeof source.builtAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(source.builtAt)
    || !Number.isFinite(Date.parse(source.builtAt))
    || new Date(source.builtAt).toISOString() !== source.builtAt.replace(/(?<!\.\d{3})Z$/, '.000Z')) throw new Error(`${label} needs exact source identity and actual build time`);
}
/** Read emitted identity; packaging never relabels stale compiled output. */
export function appBuildSource(html, { commit, dirty, packageVersion }) {
  if (!COMMIT.test(commit ?? '') || typeof dirty !== 'boolean' || !packageVersion) throw new Error('Invalid App source identity');
  if (pageMeta(html, 'umn-vr-app-source') !== identity({ commit, dirty })) throw new Error('App output source stamp differs from this checkout');
  if (pageMeta(html, 'umn-vr-app-package-version') !== packageVersion) throw new Error('App output package version stamp differs from this checkout');
  const source = { commit, dirty, packageVersion, builtAt: pageMeta(html, 'umn-vr-built-at') };
  validateSource(source, 'App output');
  return source;
}
function relativeFile(file, mountPath) {
  if (typeof file !== 'string' || !file || file.includes('\\') || file.includes('\0') || path.posix.isAbsolute(file)
    || file.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.') || part.startsWith('_'))) throw new Error(`Unsafe or Jekyll-hidden App file: ${file}`);
  if (file.startsWith('tour/') && file !== `${mountPath.slice(1)}index.html`) throw new Error(`App artifact contains media or another route: ${file}`);
  if (LANDING.some(entry => file === entry || file.startsWith(`${entry}/`))) throw new Error(`App artifact collides with club landing inputs: ${file}`);
  return file;
}
function regularFile(root, file, mountPath) {
  let target = realpathSync(root);
  const parts = relativeFile(file, mountPath).split('/');
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    const stat = lstatSync(target);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error(`App payload contains a symlink or non-file: ${file}`);
  }
  return target;
}
function filesOf(root, mountPath, prefix = '') {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`App payload contains a symlink: ${file}`);
    if (entry.isDirectory()) return filesOf(path.join(root, entry.name), mountPath, file);
    if (!entry.isFile()) throw new Error(`App payload contains a non-file: ${file}`);
    return [relativeFile(file, mountPath)];
  }).sort();
}
function regularDirectory(folder, label) {
  const absolute = path.resolve(folder); let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part); const stat = lstatSync(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a regular directory without symlinks`);
  }
}
function validateDescriptor(release) {
  if (release?.format !== 'umn-vr-app-release' || release.version !== 2 || release.owner !== 'UMN-VR/app') throw new Error('Unsupported Campus App release');
  if (!Object.hasOwn(CAMPUS_ROUTES, release.mountPath) || release.base !== '/') throw new Error('App release has an unapproved route or asset base');
  validateSource(release.source, 'App release');
  if (release.app?.repository !== 'UMN-VR/app' || release.app.revision !== release.source.commit
    || release.app.packageVersion !== release.source.packageVersion || !SHA.test(release.app.archiveSha256 ?? '')) throw new Error('App release needs its exact App package pin');
  if (release.scene?.repository !== CAMPUS_ROUTES[release.mountPath]) throw new Error('Scene owner pin differs from the mounted campus route');
  validateSource(release.scene.source, 'Scene release');
  if (release.scene.source.builtAt !== release.source.builtAt) throw new Error('Scene and App stamps must name the same actual compiled build');
  if (typeof release.content?.manifestUrl !== 'string' || !release.content.manifestUrl.trim()
    || typeof release.content.revision !== 'string' || !release.content.revision || !SHA.test(release.content.manifestSha256 ?? '')) throw new Error('App release needs pinned prepared content');
  const worker = release.worker;
  if (worker?.url !== '/foss-earth-sw.js' || worker.scope !== '/' || !SHA.test(worker.sha256 ?? '') || !SHA.test(worker.buildSealSha256 ?? '')
    || !SHA.test(worker.qualificationReceiptSha256 ?? '') || !/^foss-earth\/[a-z0-9_.-]+$/.test(worker.producer?.repository ?? '')
    || !COMMIT.test(worker.producer.revision ?? '') || !SHA.test(worker.producer.archiveSha256 ?? '')) throw new Error('App release needs an exact qualified public worker producer, worker bytes and build seal');
  relativeFile(worker.buildSealPath, release.mountPath);
  if (worker.buildSealPath === 'foss-earth-sw.js' || worker.buildSealPath.startsWith('tour/')) throw new Error('Worker seal must be a separate non-route file');
  if (JSON.stringify(release.compatibility?.currentTabIds) !== JSON.stringify(CURRENT_TAB_IDS)) throw new Error('Current Campus tab contract changed');
  if (!Array.isArray(release.files) || !release.files.length) throw new Error('App release has no files');
  const seen = new Set();
  for (const file of release.files) {
    relativeFile(file.path, release.mountPath);
    if (seen.has(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !SHA.test(file.sha256 ?? '')) throw new Error(`Invalid or duplicate App file record: ${file.path}`);
    seen.add(file.path);
  }
  for (const required of [`${release.mountPath.slice(1)}index.html`, 'foss-earth-sw.js', worker.buildSealPath]) if (!seen.has(required)) throw new Error(`App release lacks required output: ${required}`);
  if (release.files.find(file => file.path === 'foss-earth-sw.js').sha256 !== worker.sha256
    || release.files.find(file => file.path === worker.buildSealPath).sha256 !== worker.buildSealSha256) throw new Error('App worker or build seal bytes differ from their exact pins');
  return release;
}
function validatePage(html, release) {
  if (appBuildSource(html, release.source).builtAt !== release.source.builtAt) throw new Error('App descriptor relabels the emitted build time');
  for (const [name, value] of [
    ['umn-vr-app-archive-sha256', release.app.archiveSha256], ['umn-vr-scene-source', identity(release.scene.source)],
    ['umn-vr-scene-package-version', release.scene.source.packageVersion], ['umn-vr-scene-owner', release.scene.repository],
    ['umn-vr-content-url', release.content.manifestUrl], ['umn-vr-content-revision', release.content.revision],
    ['umn-vr-content-sha256', release.content.manifestSha256], ['umn-vr-worker-build-seal-sha256', release.worker.buildSealSha256],
  ]) if (pageMeta(html, name) !== value) throw new Error(`App page pin differs from release: ${name}`);
  const page = new URL(release.mountPath, 'https://umn-vr.github.io/');
  const files = new Set(release.files.map(file => file.path));
  for (const tag of html.match(/<(?:script|link|img)\b[^>]*>/gi) ?? []) {
    const attribute = tag.match(/\b(?:src|href)=(?:"([^"]*)"|'([^']*)')/i);
    if (!attribute) continue;
    const target = new URL(attributeText(attribute[1] ?? attribute[2]), page);
    if (target.origin !== page.origin) continue;
    const file = relativeFile(decodeURIComponent(target.pathname.slice(1)), release.mountPath);
    if (!files.has(file)) throw new Error(`App HTML references a missing payload file: ${file}`);
  }
}
/** Caller supplies compiled output and measured pins. No sibling lookup or shared producer copy. */
export function writeAppRelease({ input, output, mountPath, source, app, scene, content, worker }) {
  if (!Object.hasOwn(CAMPUS_ROUTES, mountPath)) throw new Error('App release has an unapproved route');
  regularDirectory(input, 'App input');
  regularDirectory(path.dirname(path.resolve(output)), 'Release output parent');
  const physicalInput = realpathSync(input);
  const physicalOutput = path.join(realpathSync(path.dirname(path.resolve(output))), path.basename(output));
  if (physicalOutput === physicalInput || physicalOutput.startsWith(`${physicalInput}${path.sep}`)) throw new Error('Release output must be outside the App input');
  const files = filesOf(input, mountPath).map(file => {
    const bytes = readFileSync(regularFile(input, file, mountPath));
    return { path: file, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const release = validateDescriptor({ format: 'umn-vr-app-release', version: 2, owner: 'UMN-VR/app', mountPath, base: '/', source, app, scene, content, worker, compatibility: { currentTabIds: [...CURRENT_TAB_IDS] }, files });
  validatePage(readFileSync(regularFile(input, `${mountPath.slice(1)}index.html`, mountPath), 'utf8'), release);
  mkdirSync(output, { recursive: false });
  const payload = path.join(output, 'payload');
  mkdirSync(payload);
  for (const file of files) {
    const destination = path.join(payload, file.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(regularFile(input, file.path, mountPath), destination);
  }
  const descriptor = `${JSON.stringify(release, null, 2)}\n`;
  writeFileSync(path.join(output, 'app-release.json'), descriptor, { flag: 'wx' });
  const descriptorSha256 = sha256(descriptor);
  verifyAppRelease(output, descriptorSha256);
  const clubPin = { schemaVersion: 2, repository: 'UMN-VR/app', sceneRepository: scene.repository, mountPath, descriptorSha256 };
  writeFileSync(path.join(output, 'club-pin.json'), `${JSON.stringify(clubPin, null, 2)}\n`, { flag: 'wx' });
  return { release, descriptorSha256, clubPin };
}
/** Validate descriptor, complete file inventory and emitted stamps before a consumer copies bytes. */
export function verifyAppRelease(folder, expectedDescriptorSha256) {
  regularDirectory(folder, 'App release');
  if (!SHA.test(expectedDescriptorSha256 ?? '')) throw new Error('An exact App descriptor SHA-256 pin is required');
  const descriptorPath = path.join(folder, 'app-release.json'), stat = lstatSync(descriptorPath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Invalid App descriptor file');
  const bytes = readFileSync(descriptorPath);
  if (sha256(bytes) !== expectedDescriptorSha256) throw new Error('App descriptor digest mismatch');
  const release = validateDescriptor(JSON.parse(bytes)), payload = path.join(folder, 'payload');
  regularDirectory(payload, 'App payload');
  const expected = release.files.map(file => file.path).sort();
  if (JSON.stringify(filesOf(payload, release.mountPath)) !== JSON.stringify(expected)) throw new Error('App payload inventory mismatch');
  for (const file of release.files) {
    const actual = readFileSync(regularFile(payload, file.path, release.mountPath));
    if (actual.length !== file.bytes || sha256(actual) !== file.sha256) throw new Error(`App payload digest/size mismatch: ${file.path}`);
  }
  validatePage(readFileSync(regularFile(payload, `${release.mountPath.slice(1)}index.html`, release.mountPath), 'utf8'), release);
  return { release, payload };
}
