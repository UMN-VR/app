import type { AppClubPin } from './artifact.mjs';
export interface FourRouteCompiledInput {
  schemaVersion: 1;
  selector: { directory: string; pin: { schemaVersion: 1; repository: 'UMN-VR/tour'; mountPath: '/tour/'; descriptorSha256: string } };
  scenes: { directory: string; pin: AppClubPin }[];
  preparedContent: { directory: string; files: { path: string; bytes: number; sha256: string }[] };
  media: { directory: string; descriptorSha256: string; publicRoot: string };
  retained: { kind: 'app' | 'legacy-tour'; directory: string; descriptorSha256: string }[];
}
export function createFourRouteAssemblyInput(input: FourRouteCompiledInput): {
  selector: FourRouteCompiledInput['selector']; scenes: FourRouteCompiledInput['scenes']; retained: FourRouteCompiledInput['retained'];
  retainedContent: { directory: string; files: { path: string; bytes: number; sha256: string }[] }[];
};
