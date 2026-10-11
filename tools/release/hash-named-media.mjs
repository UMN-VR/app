#!/usr/bin/env node
/** Authenticates the frozen public name inventory before hashing one media release. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { measureNamedPreparedMedia } from './prepared-media.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const [inputFile, outputDirectory] = process.argv.slice(2);
if (!inputFile || !outputDirectory || process.argv.length !== 4) throw new Error('Usage: node tools/release/hash-named-media.mjs EXACT_INVENTORY_INPUT_JSON NEW_OUTPUT_DIR');
const input = JSON.parse(readFileSync(inputFile, 'utf8'));
const inventoryBytes = readFileSync(input.inventory.path);
if (inventoryBytes.length !== input.inventory.sizeBytes || sha(inventoryBytes) !== input.inventory.sha256) throw new Error('Frozen metadata inventory changed');
const inventory = JSON.parse(inventoryBytes);
const root = path.resolve(inventory.root), output = path.resolve(outputDirectory);
if (inventory.state !== 'COMPLETE_METADATA_ONLY' || root.includes('/.local/') || realpathSync(root) !== root
  || root !== input.sourceRoot || inventory.files !== 62582 || inventory.statBytes !== 694126088
  || inventory.directories !== 14761 || inventory.entryCount !== inventory.entries.length
  || realpathSync(path.dirname(output)) !== path.dirname(output) || output.startsWith(root + path.sep)) throw new Error('Exact physical public media inventory and fresh owner output required');
const rows = inventory.entries.filter(row => row.kind === 'file').sort((a,b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0);
if (rows.length !== inventory.files || rows.reduce((n,row) => n + row.bytes, 0) !== inventory.statBytes) throw new Error('Frozen named file totals changed');
const seen = new Set();
for (const row of rows) {
  if (typeof row.relativePath !== 'string' || !row.relativePath || row.relativePath.includes('\\') || /[\0\r\n]/.test(row.relativePath)
    || path.posix.isAbsolute(row.relativePath) || row.relativePath.split('/').some(part => !part || part === '.' || part === '..')
    || seen.has(row.relativePath) || row.absolutePath !== path.join(root,row.relativePath)
    || !Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > 16 * 1024 * 1024) throw new Error('Unsafe, duplicated or oversized inventory entry');
  seen.add(row.relativePath);
  let target = root;
  const parts = row.relativePath.split('/');
  for (const [at,part] of parts.entries()) {
    target = path.join(target,part); const stat = lstatSync(target);
    if (stat.isSymbolicLink() || (at < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error('A frozen named input is no longer physical');
    if (at === parts.length - 1 && (stat.size !== row.bytes || (stat.mode & 511) !== row.mode)) throw new Error('Frozen media metadata changed');
  }
}
const namedSourcesSha256 = sha(rows.map(row => row.absolutePath).join('\n') + '\n');
if (namedSourcesSha256 !== inventory.sourceNamesSha256 || namedSourcesSha256 !== input.namedSourcesSha256) throw new Error('Exact full sorted source-name seal changed');
mkdirSync(output);
const startedAt = new Date().toISOString();
try {
  let bytesRead = 0;
  const files = rows.map(row => {
    const bytes = readFileSync(row.absolutePath); const digest = sha(bytes); bytesRead += bytes.length;
    if (bytes.length !== row.bytes || (row.priorSha256 && row.priorSha256 !== digest)) throw new Error('Frozen media bytes changed: ' + row.relativePath);
    return { path:row.relativePath, bytes:bytes.length, sha256:digest };
  });
  const named = { sourceRoot:root, mediaBaseUrl:input.mediaBaseUrl, artifactIdentity:input.artifactIdentity,
    namedSourcesSha256, files, baseline:input.baseline };
  writeFileSync(path.join(output,'named-media.json'),JSON.stringify(named,null,2) + '\n',{flag:'wx'});
  // The public owner verifier independently enforces the inherited whole-tree seal.
  const descriptor = measureNamedPreparedMedia(named,path.join(output,'release'));
  const result = { format:'umn-named-media-hash-receipt',version:1,status:'PASS',startedAt,finishedAt:new Date().toISOString(),
    filesHashed:files.length,bytesRead,independentVerificationBytes:descriptor.bytes,treeSha256:descriptor.treeSha256,
    inventory:input.inventory,namedSourcesSha256,mediaCopiesPerformed:0,imageDecodes:0,sourceRoot:root,
    descriptor:{path:path.join(output,'release/prepared-media-release.json'),sha256:sha(readFileSync(path.join(output,'release/prepared-media-release.json')))} };
  writeFileSync(path.join(output,'hash-receipt.json'),JSON.stringify(result,null,2) + '\n',{flag:'wx'});
  console.log(JSON.stringify(result));
} catch (error) {
  writeFileSync(path.join(output,'hash-failure.json'),JSON.stringify({status:'FAIL',startedAt,finishedAt:new Date().toISOString(),message:String(error?.message ?? error)},null,2) + '\n',{flag:'wx'});
  throw error;
}
