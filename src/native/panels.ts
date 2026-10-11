import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { LocationPanel } from "@foss-earth/engine/react";
import { createLocationDraftStore, LOCATION_PLACE_DRAFT_KEY, RASTER_BASE_MAP_SOURCES, TERRAIN_SOURCES, resolveRasterBaseMapSource, resolveTerrainSource } from "@foss-earth/engine";
import { createControlsPanel, createInputModeHud, createMapSourcePanel } from "@foss-earth/engine/panels";
import { createMapCachePresentationPolicy, createMapDetailController, connectMapDetailRuntime, setMapSourcePreference, setTerrainSourcePreference } from "@foss-earth/engine/settings";
import type { GlobeRuntime } from "@foss-earth/engine/babylon";
import type { MapCacheAccess } from "@foss-earth/engine/panels";
import { createRendererPanel } from "@foss-earth/renderer/panel";
import { applyRendererChoice } from "@foss-earth/renderer/babylon";
import { createSkyPanel, createDateTimePanel } from "@foss-earth/sky/panels";
import { createToolbarInterfaceSection, createPositionInterfaceSection } from "@foss-earth/toolbar/browser";
import {
  appendHostSections, checkChoice, createChoiceGroup, createChoiceNote, createDial,
  createExternalLinkIcon, createParameterSection, createSectionsElement, createTrack, wrapTurn,
  createSavedSettingsSection, createPresetsSection, createParameterList, createSettingsView,
  createDiagnosticsSection, createBugReportPanel, createThemeControl, createThemeController,
  createAppFilesSection, browserReportDownloads, type DiagnosticsSource,
} from "@foss-earth/ui/browser";
import type { SettingsRegistry, SettingsStorage } from "@foss-earth/ui/settings";
import type { CampusCompositionBindings } from "../tour/composition";

export interface CampusPanelsOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  inputAnchor: HTMLElement;
  toggleControls(): void;
  controller?: HTMLElement;
  settings: SettingsRegistry;
  storage: SettingsStorage | null;
  runtime: GlobeRuntime;
  cache: MapCacheAccess;
  frames: { subscribe(listener: () => void): () => void };
  nowMs(): number;
  diagnostics: DiagnosticsSource;
  appFiles: Parameters<typeof createAppFilesSection>[0];
  published: Parameters<typeof createAppFilesSection>[1];
}

/** Campus supplies tab membership and ports; each feature owner draws its controls. */
export function createCampusPanels(options: CampusPanelsOptions) {
  const { settings, storage, runtime, root } = options;
  const document = root.ownerDocument;
  const view = document.defaultView as (Window & typeof globalThis) | null;
  if (!view) throw new Error("Campus panels require their browser Window.");
  const handles: { destroy(): void }[] = [];
  const stops: (() => void)[] = [];
  let disposed = false;
  const keep = <T extends { destroy(): void }>(handle: T): T => { handles.push(handle); return handle; };
  const refresh = {
    nowMs: options.nowMs,
    subscribe(listener: () => void) {
      const detachSettings = settings.subscribe(listener), detachFrame = options.frames.subscribe(listener);
      return () => { detachSettings(); detachFrame(); };
    },
  };
  const parameterSection = (input: Omit<Parameters<typeof createParameterSection>[1], "document" | "refresh" | "panelStorage">) =>
    createParameterSection(settings, { ...input, document, refresh, panelStorage: storage });
  const sections = (input: Parameters<typeof createSectionsElement>[0]) => createSectionsElement(input, { document, storage });
  const publicUi = { appendHostSections, checkChoice, createChoiceGroup, createChoiceNote, createParameterSection, createSectionsElement,
    createDial, wrapTurn };
  const destroy = (): void => {
    if (disposed) return;
    disposed = true;
    const errors: unknown[] = [];
    for (const close of [...stops.splice(0), ...handles.splice(0).reverse().map(handle => () => handle.destroy())]) {
      try { close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Campus panels cleanup failed.");
  };
  try {
    const location = document.createElement("div"), locationRoot = createRoot(location);
    const current = () => {
      const value = runtime.getViewState();
      return value ? { latDeg: value.latDeg, lonDeg: value.lonDeg, zoomMeters: value.zoomMeters } : null;
    };
    locationRoot.render(createElement(LocationPanel, {
      initialLocation: current() ?? { latDeg: 44.975, lonDeg: -93.234, zoomMeters: 1500 },
      getCurrentLocation: current, observeLocation: options.frames.subscribe,
      onApply: value => runtime.setViewState({ latDeg: value.latDeg, lonDeg: value.lonDeg,
        ...(value.zoomMeters === undefined ? {} : { zoomMeters: value.zoomMeters }),
        ...(value.altMeters === undefined ? {} : { zoomMeters: value.altMeters }) }),
      searchAttribution: null, createAbortController: () => new view.AbortController(),
      draft: createLocationDraftStore({ storage, key: LOCATION_PLACE_DRAFT_KEY }),
    }));
    stops.push(() => locationRoot.unmount());
    const input = keep(createInputModeHud(options.canvas, options.inputAnchor, { document, settings,
      deviceHints: { platform: view.navigator.platform, maxTouchPoints: view.navigator.maxTouchPoints,
        coarsePointer: view.matchMedia("(pointer: coarse)").matches, finePointer: view.matchMedia("(pointer: fine)").matches },
      log: view.console, onModeChange: mode => runtime.setInputMode(mode), onSensitivityChange: value => runtime.setInputSensitivity(value), onToggle: options.toggleControls }));
    const controls = keep(createControlsPanel({ document, settings, inputMethod: input, controller: options.controller, ui: publicUi, refresh, panelStorage: storage }));
    const theme = createThemeController(settings, { root: document.documentElement });
    stops.push(() => theme.dispose());
    const themeControl = keep(createThemeControl(settings, document));
    const toolbar = keep(createToolbarInterfaceSection(settings, { createParameterSection, document, refresh, panelStorage: storage,
      main: themeControl.element, covers: ["interface.theme"] }));
    const position = keep(createPositionInterfaceSection(settings, { createParameterSection, document, refresh, panelStorage: storage }));
    const interfacePanel = keep(sections([
      { id: "interface.toolbar", title: "Toolbar", element: toolbar.element, defaultOpen: true },
      { id: "interface.position", title: "Position", element: position.element, defaultOpen: false },
    ]));
    const interfaceExtra = appendHostSections(settings, "interface", interfacePanel, ["toolbar", "position"], { document, refresh, panelStorage: storage });
    stops.push(() => interfaceExtra.destroy());
    const saved = keep(createSavedSettingsSection(settings, document)), presets = keep(createPresetsSection(settings, document));
    const all = keep(createParameterList(settings, {}, document));
    const reportAddress = new view.URL(view.location.href); reportAddress.searchParams.set("report", "");
    const diagnostics = keep(createDiagnosticsSection(options.diagnostics, { document, reportOnlyHref: reportAddress.href }));
    const appFiles = keep(createAppFilesSection(options.appFiles, options.published, refresh, document));
    const appFilesParameters = keep(parameterSection({ tab: "settings", section: "app-files", main: appFiles.element,
      covers: [] }));
    const settingsPanel = keep(createSettingsView([
      { id: "settings.saved", title: "Saved settings", element: saved.element, defaultOpen: true },
      { id: "settings.presets", title: "Presets", element: presets.element, defaultOpen: false },
      { id: "settings.diagnostics", title: "Diagnostics", element: diagnostics.element, defaultOpen: false },
      { id: "settings.app-files", title: "App files", element: appFilesParameters.element, defaultOpen: false },
      { id: "settings.all", title: "All parameters", element: all.element, defaultOpen: false },
    ], storage, document));
    const detail = createMapDetailController({ settings, deviceHints: () => ({ hardwareConcurrency: view.navigator.hardwareConcurrency,
      deviceMemory: (view.navigator as Navigator & { deviceMemory?: number }).deviceMemory }) });
    stops.push(connectMapDetailRuntime(detail, runtime), () => detail.dispose());
    const cachePolicy = createMapCachePresentationPolicy(settings);
    const map = keep(createMapSourcePanel({ document, InputElement: view.HTMLInputElement, ui: publicUi, refresh, panelStorage: storage, settings,
      cache: { inspect: () => options.cache.inspect(), clear: () => options.cache.clear(), nowMs: options.nowMs,
        rowLimit: cachePolicy.rowLimit, refreshIntervalMs: cachePolicy.refreshIntervalMs },
      detail, detailPanel: { createTrack, idSuffix: () => view.crypto.randomUUID() },
      rasterSources: RASTER_BASE_MAP_SOURCES.map(source => ({ id: source.id, label: source.label, attributionUrl: source.attributionUrl })),
      terrainSources: TERRAIN_SOURCES.map(source => ({ id: source.id, label: source.label, attribution: source.attribution })),
      onMapSourceChange: id => setMapSourcePreference(id, settings), onTerrainSourceChange: id => setTerrainSourcePreference(id, settings) }));
    stops.push(settings.watch("map.source.basemap", value => runtime.setMapSource(value === "google" ? "google" : resolveRasterBaseMapSource(String(value)))),
      settings.watch("map.source.elevation", value => runtime.setTerrainSource(resolveTerrainSource(String(value)))),
      runtime.subscribeStatus(value => map.update(value)));
    map.update(runtime.status);
    const renderer = keep(createRendererPanel({ renderer: runtime.renderer, settings,
      onChange: choice => applyRendererChoice(choice, settings, view.location, {
        getItem: key => storage?.getItem(key) ?? null, setItem: (key, value) => storage?.setItem(key, value),
        removeItem: key => view.localStorage.removeItem(key),
      }),
      ui: { document, isInput: (value): value is HTMLInputElement => value instanceof view.HTMLInputElement,
        createChoiceGroup: (name, title, choices) => createChoiceGroup(name, title, choices, document),
        createChoiceNote: text => createChoiceNote(text, document), checkChoice,
        createParameterSection: (registry, input) => createParameterSection(registry, { ...input, document, refresh, panelStorage: storage }),
        createSectionsElement: sections,
        appendHostSections: (registry, tab, target, own) => appendHostSections(registry, tab, target, own, { document, refresh, panelStorage: storage }) } }));
    const place = () => { const value = runtime.getViewState(); return value ? { latDeg: value.latDeg, lonDeg: value.lonDeg } : null; };
    const sky = keep(createSkyPanel({ document, ui: publicUi, settings, refresh, panelStorage: storage, getPlace: place, now: view.Date.now }));
    const time = keep(createDateTimePanel({ document, ui: publicUi, settings, refresh, panelStorage: storage, getPlace: place, now: view.Date.now }));
    const bug = keep(createBugReportPanel(options.diagnostics, { document, now: () => new view.Date(), downloads: browserReportDownloads(view.URL) }));
    const basePanels: CampusCompositionBindings["basePanels"] = { location, controls: controls.element, interface: interfacePanel.element,
      settings: settingsPanel.element, map: map.element, renderer: renderer.element, sky: sky.element, time: time.element, "bug-report": bug.element };
    const sceneContributions = (["appearance", "motion", "loading", "tiles", "saved"] as const).filter(section => section !== "saved")
      .map(section => ({ section, title: settings.getSectionTitle("scenes", section), ...parameterSection({ tab: "scenes", section }) }));
    return { basePanels, refresh, parameterSection, sections, sceneContributions,
      scenesUi: { parameterSection, sections },
      viewerUi: { representationText: (record: import("@foss-earth/images").ImageRepresentation) => `${record.id} (${record.projection})`, sectionTitle: (tab: string, section: string) => settings.getSectionTitle(tab, section), parameterSection, sections,
        externalLinkIcon: () => createExternalLinkIcon(document) },
      onBugReportShow: () => bug.show(), destroy, detail, input };
  } catch (error) {
    try { destroy(); } catch (cleanup) { throw new AggregateError([error, cleanup], "Campus panels setup failed."); }
    throw error;
  }
}
import "@foss-earth/engine/input-mode.css";
import "@foss-earth/engine/map.css";
import "@foss-earth/engine/map-cache.css";
import "@foss-earth/sky/styles.css";
