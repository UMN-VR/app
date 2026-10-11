export interface TourFile { path: string; bytes: number; sha256: string }
export interface TourSource { commit: string; dirty: boolean; packageVersion: string; builtAt: string }
export interface TourContent { manifestUrl: string; revision: string; manifestSha256: string }
export interface TourClubPin { schemaVersion: 1; repository: 'UMN-VR/tour'; mountPath: '/tour/twin-cities/'; descriptorSha256: string }
export interface TourRelease {
  format: 'umn-vr-tour-release'; version: 1; owner: 'UMN-VR/tour';
  source: TourSource; mountPath: '/tour/twin-cities/'; base: '/';
  worker: { url: '/foss-earth-sw.js'; scope: '/' }; content: TourContent;
  compatibility: { currentTabIds: string[] }; files: TourFile[];
}
export const TOUR_ROUTE: '/tour/twin-cities/';
export const CURRENT_TAB_IDS: readonly string[];
export function sha256(bytes: string | Uint8Array): string;
export function tourBuildSource(html: string, identity: Omit<TourSource, 'builtAt'>): TourSource;
export function writeTourRelease(input: { input: string; output: string; source: TourSource; content: TourContent }): { release: TourRelease; descriptorSha256: string; clubPin: TourClubPin };
export function verifyTourRelease(folder: string, expectedDescriptorSha256: string): { release: TourRelease; payload: string };

export type CampusRoute = '/tour/minneapolis/' | '/tour/st-paul/' | '/tour/twin-cities/';
export type CampusSceneOwner = 'UMN-VR/minneapolis' | 'UMN-VR/st-paul' | 'UMN-VR/twin-cities';
export interface AppPackagePin { repository: 'UMN-VR/app'; revision: string; packageVersion: string; archiveSha256: string }
/** Opaque seal and qualification receipt are pinned evidence from the exact public producer. */
export interface WorkerBinding {
  url: '/foss-earth-sw.js'; scope: '/'; sha256: string;
  buildSealPath: string; buildSealSha256: string; qualificationReceiptSha256: string;
  producer: { repository: string; revision: string; archiveSha256: string };
}
export interface AppRelease {
  format: 'umn-vr-app-release'; version: 2; owner: 'UMN-VR/app';
  source: TourSource; app: AppPackagePin;
  scene: { repository: CampusSceneOwner; source: TourSource };
  mountPath: CampusRoute; base: '/'; worker: WorkerBinding; content: TourContent;
  compatibility: { currentTabIds: string[] }; files: TourFile[];
}
export interface AppClubPin { schemaVersion: 2; repository: 'UMN-VR/app'; sceneRepository: CampusSceneOwner; mountPath: CampusRoute; descriptorSha256: string }
export const CAMPUS_ROUTES: Readonly<Record<CampusRoute, CampusSceneOwner>>;
export function appBuildSource(html: string, identity: Omit<TourSource, 'builtAt'>): TourSource;
export function writeAppRelease(input: {
  input: string; output: string; mountPath: CampusRoute; source: TourSource;
  app: AppPackagePin; scene: { repository: CampusSceneOwner; source: TourSource };
  content: TourContent; worker: WorkerBinding;
}): { release: AppRelease; descriptorSha256: string; clubPin: AppClubPin };
export function verifyAppRelease(folder: string, expectedDescriptorSha256: string): { release: AppRelease; payload: string };
