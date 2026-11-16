// Settings (DESIGN.md "Settings", laid out 2026-11-03 for Phase 4): the season first, as three
// icon-led rows whose words are their accessible names, amber when something is wrong: offline
// readiness, persisted storage, and Export with the day of the last one. Then the theme, then
// the Maintainer's link, then the app and catalog versions, small and muted. A pushed page since
// 2026-11-11, opened from the hub's Settings mark, which is amber while a row here is. Export lives here
// alone before sync (the safety rows keep their own); Settings can always be reached, offline
// too (FR-019). Sync, account and consent join in Phase 7.

import {
  IconAlertCircle,
  IconLoader2,
  IconPlaneTilt,
  IconShieldCheck,
  IconShieldExclamation,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { useOfflineState } from '../pwa';
import { CATALOG_VERSION_KEY } from '../store/catalog-version';
import { LAST_EXPORT_KEY, type LastExport } from '../store/export';
import { storagePersisted } from '../store/persist';
import { preloadMeta, useMeta } from '../store/queries';
import { READY_KEY } from '../store/offline-ready';
import { setTheme, useTheme, type Theme } from '../theme';
import { APP_VERSION, exportSeason, useExportState } from './components/export-file';
import { ExportIcon } from './components/feedback';
import { Panel, Screen, TabHeader } from './components/layout';
import { ListRowBody, ROW_SHAPE } from './components/rows';
import { shortDayText } from './format';
import { MESSAGES } from './messages';

const ICON = 'size-5 shrink-0';
/** A Settings row is a List row (the row spec, 2026-11-16): its mark, then its title at 56. */
const ROW = cn(ROW_SHAPE, 'hairline-b');

// Settings' rows wait on answers: the store (offline readiness, the last Export, the catalog
// version) and the browser (storage protected). Measured on a 4x-slowed CPU (walkthrough P10),
// Storage and Offline painted 30-60ms after the page and pushed Export down. So the answers are
// read ahead, when the app opens, and the last one is drawn at once while it is asked again.
let persistedSeen: boolean | undefined;

/** Read ahead what Settings shows, so it opens whole. */
export function preloadSettings(): void {
  void preloadMeta([READY_KEY, LAST_EXPORT_KEY, CATALOG_VERSION_KEY]).catch(() => undefined);
  void storagePersisted()
    .then((answer) => {
      persistedSeen = answer;
    })
    .catch(() => undefined);
}

/** Whether the browser has promised to keep this site's storage, asked when Settings opens. */
function useStorageProtected(): boolean | undefined {
  const [persisted, setPersisted] = useState(persistedSeen);
  useEffect(() => {
    let current = true;
    void storagePersisted().then((answer) => {
      persistedSeen = answer;
      if (current) setPersisted(answer);
    });
    return () => {
      current = false;
    };
  }, []);
  return persisted;
}

/**
 * Whether a Settings row is amber, for the hub's Settings mark (DESIGN.md "Colors"): offline
 * logging isn't available, or the browser hasn't promised to keep the storage.
 */
export function useSettingsToFix(): boolean {
  const offline = useOfflineState();
  const persisted = useStorageProtected();
  return offline === 'unavailable' || persisted === false;
}

/** A row's place while its answer is read, so the rows under it never move. */
const Pending = () => <li aria-hidden className={ROW} />;

function SeasonRow({
  icon,
  wrong,
  children,
}: {
  icon: ReactNode;
  wrong?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={ROW}>
      <ListRowBody mark={icon} title={children} warn={wrong} />
    </li>
  );
}

function OfflineRow() {
  const offline = useOfflineState();
  if (offline === undefined) return <Pending />;
  if (offline === 'unavailable') {
    return (
      <SeasonRow wrong icon={<IconAlertCircle aria-hidden className={ICON} />}>
        <span className="break-words">{MESSAGES.gettingReady.unavailable}</span>
      </SeasonRow>
    );
  }
  if (offline === 'getting-ready') {
    return (
      <SeasonRow
        icon={
          <IconLoader2
            aria-hidden
            className={cn(ICON, 'animate-spin text-muted-foreground motion-reduce:animate-none')}
          />
        }
      >
        <span role="status" className="text-muted-foreground">
          {MESSAGES.offline.gettingReady}
        </span>
      </SeasonRow>
    );
  }
  return (
    <SeasonRow icon={<IconPlaneTilt aria-hidden className={ICON} />}>
      {MESSAGES.offline.ready}
    </SeasonRow>
  );
}

function StorageRow() {
  const persisted = useStorageProtected();
  if (persisted === undefined) return <Pending />;
  return persisted ? (
    <SeasonRow icon={<IconShieldCheck aria-hidden className={ICON} />}>
      {MESSAGES.storage.protected}
    </SeasonRow>
  ) : (
    <SeasonRow wrong icon={<IconShieldExclamation aria-hidden className={ICON} />}>
      {MESSAGES.storage.notProtected}
    </SeasonRow>
  );
}

/** Export, with the day of the last one and the check once a file goes from this page. */
function ExportRow() {
  const last = useMeta<LastExport>(LAST_EXPORT_KEY);
  const { seasonHandedOver } = useExportState();
  // One Export at a time: a second share sheet would fail and fall back to a download.
  const exporting = useRef(false);
  const day = last ? MESSAGES.lastExport(shortDayText(last.at)) : null;
  const action = seasonHandedOver ? MESSAGES.short.exported : MESSAGES.actions.export;
  return (
    <li className="hairline-b">
      <button
        type="button"
        aria-label={day ? `${action}. ${day}` : action}
        className={ROW_SHAPE}
        onClick={async () => {
          if (exporting.current) return;
          exporting.current = true;
          try {
            await exportSeason();
          } finally {
            exporting.current = false;
          }
        }}
      >
        <ListRowBody
          mark={<ExportIcon exported={seasonHandedOver} />}
          title={MESSAGES.actions.export}
          value={day ?? MESSAGES.neverExported}
        />
      </button>
    </li>
  );
}

/**
 * How the phone has sized the page, small and muted under the versions: what a screenshot of
 * Settings needs to say when the app sits wrongly on a phone no test can stand in for (the tab
 * bar off the bottom edge on an installed iPhone, 2026-11-13). The screen, the page as the
 * browser reports it, the three viewport heights, the safe areas at top and bottom, how far
 * the tab bar's foot is from the page's, and whether the app is installed.
 */
function ScreenFacts() {
  const [facts, setFacts] = useState('');
  useEffect(() => {
    const read = () => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;' +
        'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
      document.body.append(probe);
      const unit = (height: string) => {
        probe.style.height = height;
        return Math.round(probe.getBoundingClientRect().height);
      };
      const style = getComputedStyle(probe);
      const insets = `${parseFloat(style.paddingTop)}/${parseFloat(style.paddingBottom)}`;
      probe.style.padding = '0';
      const heights = ['100dvh', '100lvh', '100svh'].map(unit).join('/');
      probe.remove();
      const bar = document.querySelector('nav[aria-label="Main"]');
      const foot = bar ? Math.round(window.innerHeight - bar.getBoundingClientRect().bottom) : '-';
      const installed =
        (navigator as { standalone?: boolean }).standalone === true ||
        window.matchMedia?.('(display-mode: standalone)').matches === true;
      setFacts(
        `${screen.width}×${screen.height} · ${window.innerWidth}×${window.innerHeight} · ` +
          `${heights} · ${insets} · ${foot} · ${installed ? 'installed' : 'tab'}`,
      );
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return facts ? (
    <span data-screen-facts>
      {MESSAGES.versions.screen} {facts}
    </span>
  ) : null;
}

export function SettingsScreen() {
  return (
    <Screen>
      <SettingsView />
    </Screen>
  );
}

function SettingsView() {
  const theme = useTheme();
  const catalogVersion = useMeta<string>(CATALOG_VERSION_KEY);
  return (
    <>
      {/* A tab since 2026-11-13 (the Maintainer): a plain header, with no way back to give. */}
      <TabHeader title={MESSAGES.tabs.settings} />
      {/* Each group on its panel, 32px apart (foundations, 2026-11-16). */}
      <Panel>
        <OfflineRow />
        <StorageRow />
        <ExportRow />
      </Panel>
      <div role="radiogroup" aria-label="Theme" className="mt-8 flex flex-col gap-2">
        <span className="text-body font-semibold text-foreground">Theme</span>
        {/* One track holding both choices, so it reads as one choice; on the 8px edge. */}
        <div className="fill-edge flex gap-1 rounded-fill border border-border p-1">
          {(['dark', 'light'] as Theme[]).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={theme === choice}
              onClick={() => setTheme(choice)}
              className={cn(
                'min-h-12 flex-1 rounded-xl px-4',
                theme === choice && 'bg-secondary font-semibold',
              )}
            >
              {choice === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
      </div>
      {/* A List row on its own panel, with a chevron, as it opens a page; the versions close
          the page. */}
      <Panel className="mt-8">
        <li>
          <Link href="/admin" className={ROW_SHAPE}>
            <ListRowBody title="Maintainer" chevron />
          </Link>
        </li>
      </Panel>
      <p className="flex flex-col pt-6 text-sub text-muted-foreground">
        <span>
          {MESSAGES.versions.app} {APP_VERSION}
        </span>
        {catalogVersion && (
          <span className="break-all">
            {MESSAGES.versions.catalog} {catalogVersion}
          </span>
        )}
        <ScreenFacts />
      </p>
    </>
  );
}
