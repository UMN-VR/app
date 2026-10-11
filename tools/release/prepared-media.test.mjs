import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { measureNamedPreparedMedia, namedPreparedMediaSources } from './prepared-media.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const scratch=mkdtempSync(path.join(tmpdir(),'umn-named-media-'));const root=path.join(scratch,'public');mkdirSync(root);
  const values={'scene.json':Buffer.from('{"original":"scene"}\n'),'face.jpg':Buffer.from('original photograph bytes')};
  const files=Object.entries(values).map(([name,bytes])=>{writeFileSync(path.join(root,name),bytes);return {path:name,bytes:bytes.length,sha256:sha(bytes)}}).sort((a,b)=>a.path.localeCompare(b.path));
  const original=files.find(file=>file.path==='scene.json');
  const input={sourceRoot:root,mediaBaseUrl:'https://umn-vr.github.io/tour/twin-cities/',artifactIdentity:'fixture-only',files,namedSourcesSha256:sha(`${files.map(file=>path.join(root,file.path)).join('\n')}\n`),baseline:{revision:'fixture-r1',manifest:original,generated:{files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),treeSha256:sha(files.map(file=>`${file.path}\0${file.bytes}\0${file.sha256}\n`).join(''))}}};
  return {scratch,root,input,output:path.join(scratch,'new-receipt')};
}
test('measures one exact shared release without copying any photograph and retains original scene',()=>{
  const f=fixture();const before=readFileSync(path.join(f.root,'face.jpg'));const release=measureNamedPreparedMedia(f.input,f.output);
  assert.equal(release.mediaCopiesPerformed,0);assert.equal(release.archive,null);assert.equal(release.retainedFiles.length,2);assert.deepEqual(readFileSync(path.join(f.root,'face.jpg')),before);
  assert.deepEqual(JSON.parse(readFileSync(path.join(f.output,'media-index.json'))).files.map(file=>file.url),['face.jpg','scene.json']);
  assert.throws(()=>measureNamedPreparedMedia(f.input,f.output),/exist/i);
});
test('rejects same-sized changed bytes and incomplete or duplicated names before creating release',()=>{
  const f=fixture();writeFileSync(path.join(f.root,'face.jpg'),Buffer.alloc(f.input.files[0].bytes));assert.throws(()=>measureNamedPreparedMedia(f.input,f.output),/changed/);
  assert.throws(()=>namedPreparedMediaSources({...f.input,namedSourcesSha256:sha('different names')}),/source.*seal/);
  assert.throws(()=>namedPreparedMediaSources({...f.input,files:[...f.input.files,f.input.files[0]]}),/Duplicate/);
});
test('rejects symlink or traversal sources and credentialled transport identity',()=>{
  const f=fixture();symlinkSync(path.join(f.root,'face.jpg'),path.join(f.root,'alias.jpg'));
  assert.throws(()=>namedPreparedMediaSources({...f.input,files:[{...f.input.files[0],path:'alias.jpg'}]}),/regular/);
  assert.throws(()=>namedPreparedMediaSources({...f.input,files:[{...f.input.files[0],path:'../face.jpg'}]}),/Unsafe/);
  assert.throws(()=>namedPreparedMediaSources({...f.input,mediaBaseUrl:'https://name:secret@example.invalid/media/'}),/public media/);
});
