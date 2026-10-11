#!/usr/bin/env node
/** Source-free production from public packages and one authenticated finite media map. */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { prepareQualifiedCampusScenes } from '@umn-vr/app/scene-production';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const [inputFile, outputDirectory] = process.argv.slice(2);
if (!inputFile || !outputDirectory || process.argv.length !== 4) throw new Error('Usage: node tools/release/produce-campus-scenes.mjs EXACT_PRODUCER_INPUT_JSON NEW_OUTPUT_DIR');
const input = JSON.parse(readFileSync(inputFile,'utf8'));
function pinned(pin) {
  const bytes = readFileSync(pin.path);
  if (bytes.length !== pin.sizeBytes || sha(bytes) !== pin.sha256) throw new Error('Exact acquired input changed: ' + pin.path);
  return bytes;
}
const binding = input.producerBinding;
if (binding?.providers?.length !== 3) throw new Error('Three independently qualified producer providers required');
for (const provider of binding.providers) {
  if (sha(readFileSync(provider.archive.path)) !== provider.archiveSha256
    || sha(readFileSync(provider.qualificationReceipt.path)) !== provider.qualificationReceiptSha256) throw new Error('Actual producer archive or qualification receipt changed');
  const root = path.resolve(provider.installedRoot);
  if (realpathSync(root) !== root || !root.includes('/node_modules/@foss-earth/')) throw new Error('Exact physically installed public provider required');
  const manifest = JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
  if (manifest.name !== '@' + provider.repository || !Array.isArray(provider.files) || !provider.files.length || provider.files.length > 2048) throw new Error('Provider package identity/full-file map required');
  for (const file of provider.files) {
    if (typeof file.path !== 'string' || file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Unsafe provider file map');
    const target = path.join(root,file.path);
    if (lstatSync(target).isSymbolicLink()) throw new Error('Installed provider file must be physical');
    const bytes = readFileSync(target);
    if (bytes.length !== file.sizeBytes || sha(bytes) !== file.sha256) throw new Error('Installed public provider differs from its qualified archive: ' + file.path);
  }
}
const descriptor = JSON.parse(pinned(input.media.descriptor));
const indexBytes = pinned({path:path.join(input.media.directory,descriptor.mediaIndex.path),sha256:descriptor.mediaIndex.sha256,sizeBytes:descriptor.mediaIndex.sizeBytes});
if (descriptor.files !== 62582 || descriptor.bytes !== 694126088 || descriptor.mediaCopiesPerformed !== 0
  || descriptor.treeSha256 !== input.baseline.generated.treeSha256 || descriptor.sourceRoot !== input.media.sourceRoot) throw new Error('One exact measured original media release required');
const limits = input.limits;
if (limits.totalInputBytes !== 768 * 1024 * 1024 || limits.mediaIndexBytes !== 32 * 1024 * 1024
  || limits.jsonNodes !== 2000000 || limits.files !== 64000 || limits.fileBytes !== 16 * 1024 * 1024
  || limits.children !== 2 || limits.entities !== 60 || limits.assets !== 60 || limits.links !== 138
  || limits.groups !== 24 || limits.jsonDepth !== 64) throw new Error('The independently reviewed finite production limits are required');
const mediaInputs = new Map([[input.media.indexUrl,indexBytes]]);
let acquiredBytes = indexBytes.length;
for (const file of descriptor.retainedFiles) {
  const target = path.join(descriptor.sourceRoot,file.path);
  if (lstatSync(target).isSymbolicLink()) throw new Error('Measured media source must remain physical');
  const bytes = readFileSync(target);
  if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw new Error('Measured media bytes changed: ' + file.path);
  mediaInputs.set(new URL(file.path,input.media.baseUrl).href,bytes); acquiredBytes += bytes.length;
}
const sources = Object.fromEntries(Object.entries(input.sources).map(([key,pin]) => [key,pinned(pin)]));
if (acquiredBytes + Object.values(sources).reduce((n,bytes) => n + bytes.length,0) >= limits.totalInputBytes) throw new Error('Measured acquired map exceeds the reviewed finite input bound');
const output = path.resolve(outputDirectory);
if (realpathSync(path.dirname(output)) !== path.dirname(output)) throw new Error('Physical existing output parent required');
mkdirSync(output);
const startedAt = new Date().toISOString();
try {
  const produced = prepareQualifiedCampusScenes({sources,publication:input.publication,producerBinding:binding,
    media:{index:{url:input.media.indexUrl,id:'umn-campus-prepared-media',revision:descriptor.revision,sha256:descriptor.mediaIndex.sha256,sizeBytes:indexBytes.length},
      baseUrl:input.media.baseUrl,inputs:mediaInputs},limits,previewSheets:input.previewSheets});
  const results = {...produced.children,'twin-cities':produced.aggregate};
  const scenes = [];
  for (const [id,result] of Object.entries(results)) {
    const destination = path.join(output,id + '.json');
    writeFileSync(destination,result.manifest,{flag:'wx'});
    scenes.push({id,path:destination,url:input.publication[id].url,sha256:result.sha256,sizeBytes:result.sizeBytes,
      sceneId:result.document.id,revision:result.document.revision,entities:result.document.entities.length,
      assets:result.document.assets.length,groups:result.document.groups.length,
      links:result.document.entities.reduce((n,entity) => n + (entity.links?.length ?? 0),0),receipt:result.receipt});
  }
  if (JSON.stringify(scenes.map(scene => scene.entities)) !== '[48,12,60]' || scenes[2].links !== 134 || scenes[2].groups !== 24) throw new Error('Actual public producer did not preserve authored Campus counts');
  const receipt = {format:'umn-actual-three-scene-production',version:1,status:'PASS',startedAt,finishedAt:new Date().toISOString(),
    producerBinding:binding,limits,acquiredMediaBytes:acquiredBytes,measuredIndexBytes:indexBytes.length,mediaCopiesPerformed:0,
    scenes,authoredCounts:produced.authoredCounts,publishedChildPins:produced.publishedChildPins};
  writeFileSync(path.join(output,'production-receipt.json'),JSON.stringify(receipt,null,2) + '\n',{flag:'wx'});
  console.log(JSON.stringify({status:'PASS',output,scenes:scenes.map(({id,entities,links,groups,sha256}) => ({id,entities,links,groups,sha256}))}));
} catch(error) {
  writeFileSync(path.join(output,'production-failure.json'),JSON.stringify({status:'FAIL',startedAt,finishedAt:new Date().toISOString(),message:String(error?.message ?? error)},null,2) + '\n',{flag:'wx'});
  throw error;
}
