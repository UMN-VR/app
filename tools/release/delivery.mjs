/** Read-only delivery plans. Existing published resources are never implicitly deleted. */
import { verifyAppRelease, verifyTourRelease } from './artifact.mjs';
export { planTourAppDelivery } from './legacy-delivery.mjs';
const contentIdentity = url => { const resolved = new URL(url, 'https://umn-vr.github.io/'); resolved.hash = ''; return resolved.href; };

/** Retained releases are explicitly typed and pinned; no archive/source-tree discovery. */
export function planAppDelivery({ directory, descriptorSha256, retained = [] }) {
  const { release } = verifyAppRelease(directory, descriptorSha256);
  const mutable = new Set(['tour/minneapolis/index.html', 'tour/st-paul/index.html', 'tour/twin-cities/index.html', 'foss-earth-sw.js']);
  const current = new Map(release.files.map(file => [file.path, file]));
  const preserve = new Set(), contents = new Map([[contentIdentity(release.content.manifestUrl), release.content]]);
  for (const previous of retained) {
    if (!['app', 'legacy-tour'].includes(previous.kind)) throw new Error('Retained release kind must be explicit');
    const old = (previous.kind === 'app' ? verifyAppRelease : verifyTourRelease)(previous.directory, previous.descriptorSha256).release;
    const identity = contentIdentity(old.content.manifestUrl), selected = contents.get(identity);
    if (selected && (selected.manifestSha256 !== old.content.manifestSha256 || selected.revision !== old.content.revision)) throw new Error('Supported releases need distinct immutable content URLs for different bytes');
    contents.set(identity, old.content);
    for (const file of old.files) {
      const replacement = current.get(file.path);
      if (!replacement) preserve.add(file.path);
      else if (!mutable.has(file.path) && (replacement.sha256 !== file.sha256 || replacement.bytes !== file.bytes)) throw new Error(`Retained immutable App path would change: ${file.path}`);
    }
  }
  return {
    schemaVersion: 2, owner: 'UMN-VR/app', kind: 'scene-app', mode: 'additive', dryRun: true,
    descriptorSha256, source: structuredClone(release.source), app: structuredClone(release.app), scene: structuredClone(release.scene),
    mountPath: release.mountPath, base: release.base, worker: structuredClone(release.worker), content: structuredClone(release.content),
    supportedContent: [...contents.values()].map(content => ({ ...content })), files: release.files.map(file => ({ ...file })),
    summary: { files: release.files.length, bytes: release.files.reduce((sum, file) => sum + file.bytes, 0) },
    replaces: [release.mountPath.slice(1) + 'index.html', 'foss-earth-sw.js'], retainsFromSuppliedReleases: [...preserve].sort(),
    preserves: 'Every unselected published path, including the legacy prepared manifest/media and club landing', deletes: [],
  };
}
