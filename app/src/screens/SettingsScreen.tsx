// Settings (DESIGN.md "Settings", laid out 2026-11-03 for Phase 4): the season first, as three
// icon-led rows whose words are their accessible names, amber when something is wrong: offline
// readiness, persisted storage, and Export with the day of the last one. Then the theme, then
// the Maintainer's link, then the app and catalog versions, small and muted. Export lives here
// alone before sync (the safety rows keep their own); Settings can always be reached, offline
// too (FR-019). Sync, account and consent join in Phase 7.

import {
  IconAlertCircle,
  IconChevronRight,
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
import { ExportIcon, SeasonFeedback } from './components/feedback';
import { InstallRow } from './components/InstallRow';
import { Screen } from './components/layout';
import { shortDayText } from './format';
import { MESSAGES } from './messages';

const ICON = 'size-5 shrink-0';
const ROW = 'flex min-h-12 items-center gap-3 py-2 hairline-b';

// Settings' rows wait on answers: the store (offline readiness, the last Export, the catalog
// version) and the browser (storage protected). Measured on a 4x-slowed CPU (walkthrough P10),
// Storage and Offline painted 30-60ms after the page and pushed Export down. So the answers are
// read ahead, when the app opens, and the last one is drawn at once while it is asked again.
let persistedSeen: boolean | undefined;

/** Read ahead what Settings shows, so it opens whole. */
export function preloadSettings(): void {
  void preloadMeta([READY_KEY, LAST_EXPORT_KEY, CATALOG_VERSION_KEY]).catch(() => undefined);
  void storagePersisted().then((answer) => {
    persistedSeen = answer;
  });
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
    <li className={cn(ROW, wrong && 'text-warning')}>
      {icon}
      {children}
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
        className={cn(ROW, 'w-full border-b-0 text-left')}
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
        <ExportIcon exported={seasonHandedOver} />
        <span className="flex-1">{MESSAGES.actions.export}</span>
        <span className="text-sub text-muted-foreground">{day ?? MESSAGES.neverExported}</span>
      </button>
    </li>
  );
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
      {/* 16px to the first row, as Season's title has to the Now card. */}
      <h1 className="pt-4 pb-4 text-title font-semibold">Settings</h1>
      <InstallRow />
      <SeasonFeedback />
      <ul className="hairline-t">
        <OfflineRow />
        <StorageRow />
        <ExportRow />
      </ul>
      <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-2 pt-8">
        <span className="text-sub text-muted-foreground">Theme</span>
        {/* One track holding both choices, so it reads as one choice. */}
        <div className="flex gap-1 rounded-2xl border border-border p-1">
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
      {/* A row like the season's, so it reads as a place to go; the versions close the page. */}
      <Link
        href="/admin"
        className="mt-8 flex min-h-12 items-center justify-between gap-2 text-muted-foreground hairline-y"
      >
        Maintainer
        <IconChevronRight aria-hidden className={ICON} />
      </Link>
      <p className="flex flex-col pt-6 text-caption text-muted-foreground">
        <span>
          {MESSAGES.versions.app} {APP_VERSION}
        </span>
        {catalogVersion && (
          <span className="break-all">
            {MESSAGES.versions.catalog} {catalogVersion}
          </span>
        )}
      </p>
    </>
  );
}
