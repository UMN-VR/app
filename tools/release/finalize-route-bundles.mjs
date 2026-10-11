#!/usr/bin/env node
/** One post-build public UI worker for the actual three-route bundle union. */
import { appFilesWorker } from '@foss-earth/ui/vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const [inputFile, outputDirectory] = process.argv.slice(2);
if (!inputFile || !outputDirectory || process.argv.length !== 4) throw new Error('Usage: node tools/release/finalize-route-bundles.mjs EXACT_RAW_ROUTE_INPUT_JSON NEW_OUTPUT_DIR');
const input = JSON.parse(readFileSync(inputFile,'utf8'));
if (input?.schemaVersion !== 1 || !Array.isArray(input.routes) || input.routes.length !== 3
  || new Set(input.routes.map(route => route.id)).size !== 3
  || input.routes.some(route => !['minneapolis','st-paul','twin-cities'].includes(route.id))
  || input.producer.repository !== 'foss-earth/ui' || !/^[a-f0-9]{40}$/.test(input.producer.sourceIdentity)
  || sha(readFileSync(input.producer.archive.path)) !== input.producer.archiveSha256
  || sha(readFileSync(input.producer.qualificationReceipt.path)) !== input.producer.qualificationReceiptSha256) throw new Error('Exact qualified public UI producer and three raw route bindings required');
const union = new Map(), rawRoutes = [];
function collect(directory,prefix='') {
  if (realpathSync(directory) !== path.resolve(directory)) throw new Error('Raw compiled input root must be physical');
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const relative = prefix + entry.name, target = path.join(directory,entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) throw new Error('Raw bundle input must contain only physical files');
    return entry.isDirectory() ? collect(target,relative + '/') : [{path:relative,source:target}];
  });
}
for (const route of input.routes) {
  const files = collect(route.directory);
  if (files.length > 4096 || !files.some(file => file.path === `tour/${route.id}/index.html`)
    || files.some(file => file.path.startsWith('tour/') && file.path !== `tour/${route.id}/index.html`)
    || files.some(file => file.path === 'foss-earth-sw.js')) throw new Error('Raw route must exclude media, other routes and preliminary workers');
  const records = files.map(file => {
    const bytes = readFileSync(file.source);
    const record = {...file,sizeBytes:bytes.length,sha256:sha(bytes)};
    const old = union.get(file.path);
    if (old && (old.sha256 !== record.sha256 || old.sizeBytes !== record.sizeBytes)) throw new Error('Different immutable bundle bytes share a path');
    union.set(file.path,record); return record;
  });
  if (records.reduce((n,file) => n + file.sizeBytes,0) > 100 * 1024 * 1024) throw new Error('One raw route exceeds the reviewed 100MiB output bound');
  rawRoutes.push({id:route.id,directory:route.directory,files:records});
}
if (!Array.isArray(input.retainedFiles) || !input.retainedFiles.length || input.retainedFiles.length > 4096
  || input.retainedFiles.some(file => !file.url.startsWith('/assets/') || !/^[a-f0-9]{64}$/.test(file.sha256))) throw new Error('Explicit older immutable App resources required; media never enters the app worker');
const produced = appFilesWorker([...union.keys()],{base:'/',scope:'/',cacheNamespace:input.cacheNamespace,identity:input.messageIdentity,
  retention:'retain-older',retainedFiles:input.retainedFiles});
const buildSeal = {format:'umn-shared-public-app-files-build',version:1,state:'PRODUCED_FROM_ACTUAL_THREE_ROUTE_UNION',
  producer:{repository:input.producer.repository,sourceIdentity:input.producer.sourceIdentity,archiveSha256:input.producer.archiveSha256,qualificationReceiptSha256:input.producer.qualificationReceiptSha256},publicProducerReceipt:produced.receipt,manifest:produced.manifest,
  rawRoutes:rawRoutes.map(route => ({id:route.id,files:route.files.map(({path,sizeBytes,sha256}) => ({path,sizeBytes,sha256}))})),
  mediaIncluded:false,retainedOlderAppResources:input.retainedFiles};
const sealBytes = Buffer.from(JSON.stringify(buildSeal,null,2) + '\n'),sealSha = sha(sealBytes);
const buildSealPath = `assets/app-files-build-${sealSha.slice(0,12)}.json`;
const worker = {url:'/foss-earth-sw.js',scope:'/',sha256:produced.receipt.workerSha256,buildSealPath,buildSealSha256:sealSha,
  producer:{repository:'foss-earth/ui',revision:input.producer.sourceIdentity,archiveSha256:input.producer.archiveSha256}};
const qualification = {format:'umn-public-worker-producer-qualification',version:1,status:'PASS',worker,
  claim:'Exact actual bundled union and preserved old App pins through the qualified public UI producer; browser control/update proof remains separate',
  manifestSha256:produced.receipt.manifestSha256,workerSizeBytes:produced.receipt.workerSizeBytes,rawRoutes:buildSeal.rawRoutes};
const qualificationBytes = Buffer.from(JSON.stringify(qualification,null,2) + '\n');
worker.qualificationReceiptSha256 = sha(qualificationBytes);
const output = path.resolve(outputDirectory);
if (realpathSync(path.dirname(output)) !== path.dirname(output)) throw new Error('Physical existing output parent required');
mkdirSync(output);
writeFileSync(path.join(output,'worker-qualification.json'),qualificationBytes,{flag:'wx'});
writeFileSync(path.join(output,'worker-binding.json'),JSON.stringify(worker,null,2) + '\n',{flag:'wx'});
for (const route of rawRoutes) {
  const root = path.join(output,route.id);mkdirSync(root);
  for (const file of route.files) {
    const target = path.join(root,file.path);mkdirSync(path.dirname(target),{recursive:true});
    let bytes = readFileSync(file.source);
    if (bytes.length !== file.sizeBytes || sha(bytes) !== file.sha256) throw new Error('Raw compiled bytes changed during finalization');
    if (file.path.endsWith('/index.html')) {
      const html = bytes.toString('utf8');
      if ((html.match(/PENDING_SHARED_WORKER_FINALIZATION/g) ?? []).length !== 1) throw new Error('Raw route must carry exactly one honest pending-worker seal');
      bytes = Buffer.from(html.replace('PENDING_SHARED_WORKER_FINALIZATION',sealSha));
    }
    writeFileSync(target,bytes,{flag:'wx'});
  }
  writeFileSync(path.join(root,'foss-earth-sw.js'),produced.source,{flag:'wx'});
  const seal = path.join(root,buildSealPath);mkdirSync(path.dirname(seal),{recursive:true});writeFileSync(seal,sealBytes,{flag:'wx'});
}
console.log(JSON.stringify({status:'PASS',output,worker,routes:rawRoutes.map(route => route.id),rawInputsPreserved:true}));
