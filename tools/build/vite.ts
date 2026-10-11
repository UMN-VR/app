import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { builtFrom } from "@foss-earth/about/vite";
import { babylonShaderChunks } from "@foss-earth/renderer/vite";
import react from "@vitejs/plugin-react";
import type { Plugin, UserConfig } from "vite";

export interface CampusBuildInput {
  mountPath: "/tour/minneapolis/" | "/tour/st-paul/" | "/tour/twin-cities/";
  app: { commit: string; dirty: boolean; packageVersion: string; archiveSha256: string };
  content: { manifestUrl: string; revision: string; manifestSha256: string };
  nativeHost: {
    repository: "UMN-VR/app"; revision: string; publicModule: "@umn-vr/app/native";
    exportName: "createCampusNativeHostFactory"; archiveSha256: string; qualificationReceiptSha256: string;
    options: import("../../src/native/host").CampusNativeHostOptions;
    providers: readonly { repository: string; revision: string; archiveSha256: string; qualificationReceiptSha256: string }[];
  };
  installedSources?: readonly { package: string; sourceIdentity: string; dirty: boolean }[];
  worker: {
    /** Raw compiled output is retained until the shared post-build worker is sealed. */
    stage?: "PREPARED_FOR_SHARED_ASSEMBLY";
    url: "/foss-earth-sw.js"; scope: "/"; sha256?: string;
    buildSealPath: string; buildSealSha256?: string; qualificationReceiptSha256: string;
    producer: { repository: string; revision: string; archiveSha256: string };
  };
}
const digest = (value: string) => /^[a-f\d]{64}$/.test(value);
/** A route can compile only after its native/content/worker contracts are pinned. */
export function campusRouteConfig({ root, id, title, description, input, workerPlugin }: {
  root: string; id: string; title: string; description: string;
  input: CampusBuildInput; workerPlugin?: Plugin;
}): UserConfig {
  const sharedWorkerPending = input.worker?.stage === "PREPARED_FOR_SHARED_ASSEMBLY";
  if (!input || (!workerPlugin && !sharedWorkerPending) || input.mountPath !== `/tour/${id}/`
    || !/^[a-f\d]{40}$/.test(input.app.commit) || typeof input.app.dirty !== "boolean"
    || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(input.app.packageVersion)
    || typeof input.content.manifestUrl !== "string" || !input.content.manifestUrl.trim()
    || typeof input.content.revision !== "string" || !input.content.revision
    || !/^[a-f\d]{40}$/.test(input.nativeHost.revision)
    || input.nativeHost.repository !== "UMN-VR/app" || input.nativeHost.revision !== input.app.commit
    || input.nativeHost.archiveSha256 !== input.app.archiveSha256
    || input.worker.url !== "/foss-earth-sw.js" || input.worker.scope !== "/"
    || !input.worker.buildSealPath || !/^[a-f\d]{40}$/.test(input.worker.producer.revision)
    || !/^foss-earth\/[a-z-]+$/.test(input.worker.producer.repository) || input.worker.producer.repository === "foss-earth/app"
    || ![input.app.archiveSha256, input.content.manifestSha256, input.nativeHost.archiveSha256,
      input.nativeHost.qualificationReceiptSha256,
      input.worker.qualificationReceiptSha256, input.worker.producer.archiveSha256].every(digest)
    || (!sharedWorkerPending && ![input.worker.buildSealSha256, input.worker.sha256].every(value => typeof value === "string" && digest(value)))) {
    throw new Error("A qualified App/native host/Scenes/media/worker build input is required; source plans cannot be built as releases.");
  }
  if (input.nativeHost.publicModule !== "@umn-vr/app/native"
    || input.nativeHost.exportName !== "createCampusNativeHostFactory"
    || !input.nativeHost.options || !Array.isArray(input.nativeHost.providers)
    || ["engine", "360", "renderer", "ui", "images", "sky"].some(owner =>
      input.nativeHost.providers.filter(pin => pin.repository === `foss-earth/${owner}`).length !== 1)
    || input.nativeHost.providers.some(pin => !/^[a-f\d]{40}$/.test(pin.revision)
      || !digest(pin.archiveSha256) || !digest(pin.qualificationReceiptSha256)
      || !/^foss-earth\/(engine|360|renderer|ui|images|sky)$/.test(pin.repository))) {
    throw new Error("Campus owns the native factory; six exact qualified public shared provider pins are required.");
  }
  if (input.installedSources && (!Array.isArray(input.installedSources)
    || new Set(input.installedSources.map(pin => pin.package)).size !== input.installedSources.length
    || input.installedSources.some(pin => !/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(pin.package)
      || !/^[a-f\d]{40}$/.test(pin.sourceIdentity) || typeof pin.dirty !== "boolean")))
    throw new Error("Installed About source identities must be unique, real commits with honest dirty flags.");
  const git = (...args: string[]) => execFileSync("git", ["--no-optional-locks", ...args], { cwd: root, encoding: "utf8" }).trim();
  const sceneCommit = git("rev-parse", "HEAD");
  const sceneDirty = Boolean(git("status", "--porcelain"));
  const sceneVersion = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version as string;
  const builtAt = new Date().toISOString();
  const nativeOptions = { ...input.nativeHost.options, about: { ...input.nativeHost.options.about,
    identity: { ...input.nativeHost.options.about.identity, build: builtAt } } };
  const virtualId = "virtual:umn-campus-route";
  const entry: Plugin = {
    name: "umn-campus-native-route",
    resolveId: value => value === virtualId ? `\0${virtualId}` : undefined,
    load: value => value === `\0${virtualId}` ? `
      import { ${input.nativeHost.exportName} as createNative } from ${JSON.stringify(input.nativeHost.publicModule)};
      import { mountCampusApp } from '@umn-vr/app/browser';
      import { readBuiltFrom } from '@foss-earth/about';
      const root = document.getElementById('root');
      if (!root) throw new Error('Expected Campus root.');
      const options = ${JSON.stringify(nativeOptions)};
      options.about.builtFrom = readBuiltFrom(document);
      const native = createNative(options);
      const mounted = await mountCampusApp(root, ${JSON.stringify({ examples: [{ id, title, description, url: input.content.manifestUrl }], initialSceneId: id })}, native);
      // Observe the actual public controller; this port has no navigation or readiness setters.
      Object.defineProperty(window, '__UMNVR_CAMPUS__', { configurable: true, value: Object.freeze({
        readSceneState: () => JSON.parse(JSON.stringify(mounted.composition?.content.controller.state() ?? null)),
        readRuntime: () => JSON.parse(JSON.stringify(mounted.readRuntime())),
        pickPanoramasAt: (x, y) => [...mounted.pickPanoramasAt(x, y)],
        inspectImages: async () => JSON.parse(JSON.stringify(await mounted.inspectImages())),
      }) });
      window.addEventListener('pagehide', () => {
        delete window.__UMNVR_CAMPUS__;
        void mounted.destroy().catch(error => console.error(error));
      }, { once: true });
    ` : undefined,
    transformIndexHtml: () => Object.entries({
      "umn-vr-app-source": `${input.app.commit}${input.app.dirty ? "-dirty" : ""}`,
      "umn-vr-app-package-version": input.app.packageVersion,
      "umn-vr-built-at": builtAt,
      "foss-earth-build": builtAt,
      "umn-vr-scene-source": `${sceneCommit}${sceneDirty ? "-dirty" : ""}`,
      "umn-vr-scene-package-version": sceneVersion,
      "umn-vr-scene-owner": `UMN-VR/${id}`,
      "umn-vr-content-url": input.content.manifestUrl,
      "umn-vr-content-revision": input.content.revision,
      "umn-vr-content-sha256": input.content.manifestSha256,
      "umn-vr-app-archive-sha256": input.app.archiveSha256,
      "umn-vr-worker-build-seal-sha256": input.worker.buildSealSha256 ?? "PENDING_SHARED_WORKER_FINALIZATION",
    }).map(([name, content]) => ({ tag: "meta", attrs: { name, content }, injectTo: "head" as const })),
    generateBundle(_options, bundle) {
      const page = bundle["index.html"];
      if (!page || page.type !== "asset") throw new Error("Missing compiled Campus route page.");
      delete bundle["index.html"];
      page.fileName = `${input.mountPath.slice(1)}index.html`;
      bundle[page.fileName] = page;
    },
  };
  return {
    root, base: "/", publicDir: false,
    resolve: { dedupe: ["@babylonjs/core", "@babylonjs/loaders", "react", "react-dom"] },
    define: { __BUILD_TIME__: JSON.stringify(builtAt), __SOURCE_VERSION__: JSON.stringify(sceneCommit), __REPOSITORY_SLUG__: JSON.stringify(`UMN-VR/${id}`) },
    build: { outDir: "dist-app", emptyOutDir: false, copyPublicDir: false },
    plugins: [react(), babylonShaderChunks(), builtFrom({ describe(part) {
      const source = input.installedSources?.find(pin => pin.package === part.name);
      const artifact = input.nativeHost.options.about.release.artifacts.find(pin => pin.package === part.name && pin.role === "runtime" && pin.availability === "available");
      return source ? { commit: source.sourceIdentity, dirty: source.dirty, ...(artifact ? { artifact } : {}) } : artifact ? { artifact } : undefined;
    } }), entry, ...(workerPlugin ? [workerPlugin] : [])],
  };
}
