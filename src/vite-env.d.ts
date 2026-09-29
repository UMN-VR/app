/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional URL of an independently published Twin Cities scene manifest. */
  readonly VITE_TOUR_SCENE_URL?: string;
}

// Defined in vite.config.ts; FOSS Earth's Settings → About shows them.
declare const __BUILD_TIME__: string;
declare const __SOURCE_VERSION__: string;
declare const __REPOSITORY_SLUG__: string;
