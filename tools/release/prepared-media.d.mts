export interface NamedMediaFile { path: string; bytes: number; sha256: string }
export interface NamedPreparedMediaInput {
  sourceRoot: string; mediaBaseUrl: string; namedSourcesSha256: string; artifactIdentity: string;
  files: readonly NamedMediaFile[];
  baseline: { revision: string; generated: { files: number; bytes: number; treeSha256: string }; manifest: { bytes: number; sha256: string } };
}
export function namedPreparedMediaSources(input: NamedPreparedMediaInput): { root: string; base: URL; files: NamedMediaFile[]; names: string[]; bytes: number };
export function measureNamedPreparedMedia(input: NamedPreparedMediaInput, outputDirectory: string): {
  schemaVersion: 1; owner: 'UMN-VR/app'; files: number; bytes: number; treeSha256: string;
  mediaBaseUrl: string; mediaIndex: { path: string; sha256: string; sizeBytes: number };
  retainedFiles: NamedMediaFile[]; archive: null; transport: null; mediaCopiesPerformed: 0;
};
