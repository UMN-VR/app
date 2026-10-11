#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { appBuildSource, CAMPUS_ROUTES, sha256, writeAppRelease } from './artifact.mjs';

const [input, output, inputsFile] = process.argv.slice(2);
if (!input || !output || !inputsFile || process.argv.length !== 5) {
  throw new Error('Usage: node tools/release/package.mjs COMPILED_SCENE_DIR NEW_RELEASE_DIR EXACT_RELEASE_INPUTS_JSON');
}
const inputs = JSON.parse(readFileSync(inputsFile, 'utf8'));
if (!inputs.appSourceRoot || !inputs.sceneSourceRoot || !inputs.content?.manifestFile) throw new Error('Explicit App/scene source roots and checked manifest file are required');
if (!Object.hasOwn(CAMPUS_ROUTES, inputs.mountPath) || inputs.scene?.repository !== CAMPUS_ROUTES[inputs.mountPath]) throw new Error('Explicit scene owner must match the mounted route');
function sourceIdentity(root, expectedPackage) {
  const git = (...args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8' }).trim();
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest.name !== expectedPackage) throw new Error('Measured source checkout package differs from the explicit owner');
  return { commit: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')), packageVersion: manifest.version };
}
const html = readFileSync(path.join(input, inputs.mountPath.slice(1), 'index.html'), 'utf8');
const source = appBuildSource(html, sourceIdentity(inputs.appSourceRoot, '@umn-vr/app'));
const manifestBytes = readFileSync(inputs.content.manifestFile);
if (sha256(manifestBytes) !== inputs.content.manifestSha256 || JSON.parse(manifestBytes).revision !== inputs.content.revision) {
  throw new Error('Checked prepared content differs from the explicit release pins');
}
const result = writeAppRelease({
  input: path.resolve(input), output: path.resolve(output), mountPath: inputs.mountPath,
  source, app: inputs.app,
  scene: { repository: inputs.scene.repository, source: { ...sourceIdentity(inputs.sceneSourceRoot, `@umn-vr/${inputs.scene.repository.slice('UMN-VR/'.length)}`), builtAt: source.builtAt } },
  content: { manifestUrl: inputs.content.manifestUrl, revision: inputs.content.revision, manifestSha256: inputs.content.manifestSha256 },
  worker: inputs.worker,
});
console.log(JSON.stringify({ descriptorSha256: result.descriptorSha256, clubPin: path.join(output, 'club-pin.json'), files: result.release.files.length, bytes: result.release.files.reduce((sum, file) => sum + file.bytes, 0) }, null, 2));
