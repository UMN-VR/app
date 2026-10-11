/** Exact Campus four-route input preparation. Actual copying remains the Club assembler's job. */
import { readFileSync, writeFileSync, realpathSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyAppRelease, CAMPUS_ROUTES } from './app-artifact.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
function pinnedJson(directory, relative, expected) {
  const file=path.join(directory,relative);
  if (realpathSync(directory)!==path.resolve(directory) || lstatSync(file).isSymbolicLink()) throw new Error('Physical release directories/files required');
  const bytes=readFileSync(file);
  if (!SHA.test(expected) || sha(bytes)!==expected) throw new Error(`Exact release pin changed: ${relative}`);
  return JSON.parse(bytes);
}
/**
 * Consumes measured local media and actual compiled App/selector releases only.
 * The Club's public assembler independently verifies the selector and all files.
 */
export function createFourRouteAssemblyInput(input) {
  if (input?.schemaVersion!==1 || !Array.isArray(input.scenes) || input.scenes.length!==3) throw new Error('Exactly three compiled Campus route artifacts required');
  if (input.selector?.pin?.repository!=='UMN-VR/tour' || input.selector.pin.mountPath!=='/tour/' || input.selector.pin.schemaVersion!==1) throw new Error('Exact runtime-free selector release required');
  const selector=pinnedJson(input.selector.directory,'selector-release.json',input.selector.pin.descriptorSha256);
  if (selector.owner!=='UMN-VR/tour' || selector.mountPath!=='/tour/') throw new Error('Selector identity changed');
  const routes=new Set();const workers=[];const manifests=[];
  for (const selected of input.scenes) {
    const {pin}=selected;
    if (pin?.schemaVersion!==2 || pin.repository!=='UMN-VR/app' || pin.sceneRepository!==CAMPUS_ROUTES[pin.mountPath] || routes.has(pin.mountPath)) throw new Error('Distinct compiled App scene route pins required');
    const {release}=verifyAppRelease(selected.directory,pin.descriptorSha256);
    if (release.mountPath!==pin.mountPath || release.scene.repository!==pin.sceneRepository) throw new Error('Compiled route differs from selected owner');
    const url=new URL(release.content.manifestUrl,'https://umn-vr.github.io/');
    if (url.origin!=='https://umn-vr.github.io' || url.username || url.password || url.search || url.hash
      || !url.pathname.startsWith(pin.mountPath) || url.pathname==='/'
      || url.pathname==='/tour/twin-cities/scene.json') throw new Error('New same-origin immutable scene manifest path required; original legacy manifest stays retained');
    manifests.push({path:decodeURIComponent(url.pathname.slice(1)),sha256:release.content.manifestSha256});
    routes.add(pin.mountPath);workers.push(JSON.stringify(release.worker));
  }
  if (routes.size!==3 || new Set(workers).size!==1) throw new Error('All three routes must share the exact canonical root worker/build producer');
  const prepared=input.preparedContent;
  if (!prepared?.directory || !Array.isArray(prepared.files) || prepared.files.length!==3
    || new Set(prepared.files.map(file=>file.path)).size!==3
    || prepared.files.some(file=>!Number.isSafeInteger(file.bytes) || file.bytes<1
      || !manifests.some(manifest=>manifest.path===file.path && manifest.sha256===file.sha256)))
    throw new Error('Exact three checked prepared-scene file pins required for local runtime assembly');
  // Club validates physical paths, inventories and every byte before copying.
  const media=pinnedJson(input.media.directory,'prepared-media-release.json',input.media.descriptorSha256);
  if (media.owner!=='UMN-VR/app' || media.schemaVersion!==1 || media.mediaCopiesPerformed!==0 || !Array.isArray(media.retainedFiles) || media.retainedFiles.length!==62582 || media.bytes!==694126088
    || media.treeSha256!=='5741f8a4b9e2e4f129fcce2a2d44fa2c49bc4e43e54d24757af2f949f6d7d0d3') throw new Error('Actual original one-copy Campus media measurement required');
  pinnedJson(input.media.directory,media.mediaIndex.path,media.mediaIndex.sha256);
  const publicRoot=path.resolve(input.media.publicRoot);
  if (media.sourceRoot!==path.join(publicRoot,'tour/twin-cities')) throw new Error('Media receipt must name the exact reviewed prepared public source');
  if (!Array.isArray(input.retained) || !input.retained.length) throw new Error('Explicit older supported App releases are required; no published-resource discovery');
  return {
    selector:input.selector,scenes:input.scenes,retained:input.retained,
    retainedContent:[prepared,{directory:publicRoot,files:media.retainedFiles.map(file=>({path:`tour/twin-cities/${file.path}`,bytes:file.bytes,sha256:file.sha256}))}],
  };
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [inputFile,outputFile]=process.argv.slice(2);
  if (!inputFile || !outputFile || process.argv.length!==4) throw new Error('Usage: node tools/release/compiled-integration.mjs EXACT_COMPILED_INPUT_JSON NEW_ASSEMBLY_INPUT_JSON');
  const input=createFourRouteAssemblyInput(JSON.parse(readFileSync(inputFile,'utf8')));
  writeFileSync(outputFile,`${JSON.stringify(input,null,2)}\n`,{flag:'wx'});
  console.log(JSON.stringify({state:'INPUTS_PREPARED;Club artifact verification/assembly/browser checks remain required',output:outputFile,sha256:sha(readFileSync(outputFile)),routes:4}));
}
