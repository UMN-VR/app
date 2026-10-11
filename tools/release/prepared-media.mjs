/** One named, byte-preserved Campus media release; no discovery or image processing. */
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const SHA = /^[a-f0-9]{64}$/;
function regular(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || /[\0\r\n]/.test(relative)
      || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe named media path');
  let target = root;
  for (const [index, part] of relative.split('/').entries()) {
    target = path.join(target, part); const stat = lstatSync(target);
    if (stat.isSymbolicLink() || (index < relative.split('/').length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error('Named media must be physical regular files');
  }
  return target;
}
/** Validate every source name before reading any media bytes. */
export function namedPreparedMediaSources(input) {
  const root = path.resolve(input.sourceRoot);
  if (root.split(path.sep).includes('.local') || realpathSync(root) !== root || !lstatSync(root).isDirectory()) throw new Error('Prepared public source only; no private/local backup or symlink root');
  const base = new URL(input.mediaBaseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.hash || base.search || !base.pathname.endsWith('/')) throw new Error('Explicit final public media directory URL required');
  if (!Array.isArray(input.files) || !input.files.length || input.files.length > 64000) throw new Error('Named media file count exceeds the finite bound');
  const sorted = [...input.files].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const names = [], seen = new Set(); let bytes = 0;
  for (const file of sorted) {
    if (seen.has(file.path) || !SHA.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 16 * 1024 * 1024) throw new Error('Duplicate, invalid or oversize named media pin');
    seen.add(file.path); bytes += file.bytes;
    if (bytes > 768 * 1024 * 1024) throw new Error('Named media total exceeds the finite 768MiB prepared-input bound');
    names.push(regular(root, file.path));
  }
  if (sha(`${names.join('\n')}\n`) !== input.namedSourcesSha256) throw new Error('Every absolute media source must match the separately reviewed named-source seal');
  return { root, base, files: sorted, names, bytes };
}
/** Execution requires a separate media grant. Source inputs are never copied or reencoded. */
export function measureNamedPreparedMedia(input, outputDirectory) {
  const { root, base, files, names, bytes } = namedPreparedMediaSources(input);
  const output = path.resolve(outputDirectory), parent = path.dirname(output);
  if (realpathSync(parent) !== parent || output === root || output.startsWith(`${root}${path.sep}`)) throw new Error('New physical output must preserve the public source');
  if (lstatSync(parent).isSymbolicLink()) throw new Error('Output parent must be physical');
  const expected = input.baseline;
  if (!expected?.generated || expected.generated.files !== files.length || expected.generated.bytes !== bytes) throw new Error('Named release differs from the frozen Campus baseline totals');
  const tree = createHash('sha256');
  for (const [index, file] of files.entries()) {
    const value = readFileSync(names[index]);
    if (value.length !== file.bytes || sha(value) !== file.sha256) throw new Error(`Named prepared bytes changed: ${file.path}`);
    tree.update(`${file.path}\0${file.bytes}\0${file.sha256}\n`);
  }
  if (tree.digest('hex') !== expected.generated.treeSha256) throw new Error('Exact prepared-media tree differs from the frozen baseline');
  const original = files.find(file => file.path === 'scene.json');
  if (!original || original.bytes !== expected.manifest.bytes || original.sha256 !== expected.manifest.sha256) throw new Error('Original legacy scene bytes must remain in the retained media release');
  const mediaIndex = {
    format: 'foss-earth-scene-media', version: 1, id: 'umn-campus-prepared-media', revision: expected.revision,
    files: files.map(file => ({ url: file.path, sha256: file.sha256, sizeBytes: file.bytes })),
  };
  const indexBytes = Buffer.from(`${JSON.stringify(mediaIndex, null, 2)}\n`);
  const descriptor = {
    schemaVersion: 1, owner: 'UMN-VR/app', artifactIdentity: input.artifactIdentity,
    state: 'MEASURED_LOCAL_NAMED_PREPARED_BYTES; archive/transport/runtime qualification separate',
    sourceRoot: root, namedSourcesSha256: input.namedSourcesSha256,
    mediaBaseUrl: base.href, revision: expected.revision,
    files: files.length, bytes, treeSha256: expected.generated.treeSha256,
    mediaIndex: { path: 'media-index.json', sha256: sha(indexBytes), sizeBytes: indexBytes.length },
    legacyManifest: original, retainedFiles: files,
    consumers: ['UMN-VR/minneapolis','UMN-VR/st-paul','UMN-VR/twin-cities'],
    imageValidation: 'Separate public Scenes/representation/Preview producer checks required; byte preservation alone does not qualify images',
    archive: null, transport: null, mediaCopiesPerformed: 0,
  };
  mkdirSync(output); // Never replace an existing receipt/output.
  writeFileSync(path.join(output, 'named-sources.json'), `${JSON.stringify({ names, namedSourcesSha256: input.namedSourcesSha256 }, null, 2)}\n`, { flag: 'wx' });
  writeFileSync(path.join(output, 'media-index.json'), indexBytes, { flag: 'wx' });
  writeFileSync(path.join(output, 'prepared-media-release.json'), `${JSON.stringify(descriptor, null, 2)}\n`, { flag: 'wx' });
  return descriptor;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [inputFile, outputDirectory] = process.argv.slice(2);
  if (!inputFile || !outputDirectory || process.argv.length !== 4) throw new Error('Usage: node tools/release/prepared-media.mjs EXACT_NAMED_INPUT_JSON NEW_OUTPUT_DIRECTORY');
  console.log(JSON.stringify(measureNamedPreparedMedia(JSON.parse(readFileSync(inputFile, 'utf8')), outputDirectory)));
}
