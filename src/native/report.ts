import type { AppIdentity } from "@foss-earth/about";
import type { PublishedVersionDisplayPort } from "@foss-earth/about/panel";
import type { SettingsRegistry } from "@foss-earth/ui/settings";
import { buildReport, effectiveReportSettings, createSessionTrail, reportPage, TRAIL_STEPS_DEFAULT } from "@foss-earth/ui/diagnostics";
import { createReportView, createBrowserClipboard, readBrowserReportDetails, browserReportDownloads, browserTrailEnvironment } from "@foss-earth/ui/browser";

export interface CampusReportVersion extends PublishedVersionDisplayPort {
  whenSettled(): Promise<void>;
  dispose(): void;
}

/** A public UI report renderer. No renderer/world/viewer/Dev import or allocation. */
export function createCampusReport(options: {
  container: HTMLElement;
  signal: AbortSignal;
  settings: SettingsRegistry;
  identity: AppIdentity;
  published: CampusReportVersion;
}) {
  const { container, settings, published, signal, identity } = options;
  const document = container.ownerDocument, view = document.defaultView as (Window & typeof globalThis) | null;
  if (!view) throw new Error("Campus report requires its browser Window.");
  const pending = new Set<Promise<unknown>>();
  let disposed = false;
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work); void work.then(() => pending.delete(work), () => pending.delete(work)); return work;
  };
  const trail = createSessionTrail({ app: () => "", kept: () => false, limit: () => TRAIL_STEPS_DEFAULT, readOnly: true,
    environment: browserTrailEnvironment() });
  trail.step("Campus report-only page opened; the globe and image viewer were not started.");
  const previous = track(trail.previous());
  const source = {
    previous: () => previous,
    copy: createBrowserClipboard(document, view.navigator),
    reportSecrets: () => settings.list().filter(spec => spec.sensitive).map(spec => settings.get(spec.id)).filter((value): value is string => typeof value === "string" && value.length > 0),
    report: () => track((async () => {
      await published.whenSettled();
      const context = settings.getDeviceContext();
      return buildReport({ at: new view.Date(), appName: document.title || "UMN-VR Campus Tour", page: reportPage(view.location.href), ...identity,
        userAgent: view.navigator.userAgent,
        screen: { width: view.innerWidth, height: view.innerHeight, devicePixelRatio: view.devicePixelRatio, touch: context.touch },
        device: { cores: context.hardwareConcurrency, memoryGiB: context.deviceMemoryGiB },
        environment: readBrowserReportDetails(),
        renderer: { asked: "not started", mode: "not started", driver: null, maxTextureSize: null, fallbackReason: null, lost: 0 },
        state: [`Published: ${published.describe()}`, "Campus report-only startup; no globe, viewer or Dev session."],
        settings: effectiveReportSettings(settings), settingsComplete: true, steps: trail.steps(), errors: [], previous: await previous.catch(() => null) });
    })()),
  };
  const report = createReportView(source, { document, href: view.location.href, now: () => new view.Date(), downloads: browserReportDownloads(view.URL) });
  const note = document.createElement("p"); note.textContent = "The campus map and image viewer were not started.";
  report.element.querySelector("h1")?.after(note); container.replaceChildren(report.element); report.show();
  const dispose = (): void => {
    if (disposed) return; disposed = true;
    signal.removeEventListener("abort", dispose);
    const errors: unknown[] = [];
    for (const close of [() => report.destroy(), () => trail.dispose(), () => published.dispose()]) {
      try { close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Campus report cleanup failed.");
  };
  signal.addEventListener("abort", dispose, { once: true });
  if (signal.aborted) dispose();
  return { dispose, async whenSettled(): Promise<void> {
    while (pending.size) await Promise.allSettled([...pending]);
    await published.whenSettled();
  } };
}
