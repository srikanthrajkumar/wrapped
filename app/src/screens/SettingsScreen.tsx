// Settings (DESIGN.md "Settings", laid out 2026-11-03 for Phase 4): the season first, as three
// icon-led rows whose words are their accessible names, amber when something is wrong: offline
// readiness, persisted storage, and Export with the day of the last one. Then the theme, then
// the app and catalog versions, small and muted, and the Maintainer's link. Export lives here
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
import { useMeta } from '../store/queries';
import { setTheme, useTheme, type Theme } from '../theme';
import { APP_VERSION, exportSeason, useExportState } from './components/export-file';
import { ExportIcon, SeasonFeedback } from './components/feedback';
import { InstallRow } from './components/InstallRow';
import { Screen } from './components/layout';
import { shortDayText } from './format';
import { MESSAGES } from './messages';

const ICON = 'size-5 shrink-0';
const ROW = 'flex min-h-12 items-center gap-3 border-b border-border py-2';

/** Whether the browser has promised to keep this site's storage, asked when Settings opens. */
function useStorageProtected(): boolean | undefined {
  const [persisted, setPersisted] = useState<boolean>();
  useEffect(() => {
    let current = true;
    void storagePersisted().then((answer) => current && setPersisted(answer));
    return () => {
      current = false;
    };
  }, []);
  return persisted;
}

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
  if (offline === undefined) return null;
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
  if (persisted === undefined) return null;
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
    <li className="border-b border-border">
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
      <h1 className="pt-4 pb-2 text-title font-semibold">Settings</h1>
      <InstallRow />
      <SeasonFeedback />
      <ul className="border-t border-border">
        <OfflineRow />
        <StorageRow />
        <ExportRow />
      </ul>
      <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-1 pt-8">
        <span className="text-sub text-muted-foreground">Theme</span>
        <div className="flex gap-2">
          {(['dark', 'light'] as Theme[]).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={theme === choice}
              onClick={() => setTheme(choice)}
              className={cn(
                'min-h-12 flex-1 rounded-2xl border border-border px-4',
                theme === choice && 'border-foreground bg-secondary font-semibold',
              )}
            >
              {choice === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
      </div>
      <p className="flex flex-col pt-8 text-caption text-muted-foreground">
        <span>
          {MESSAGES.versions.app} {APP_VERSION}
        </span>
        {catalogVersion && (
          <span className="break-all">
            {MESSAGES.versions.catalog} {catalogVersion}
          </span>
        )}
      </p>
      <p className="pt-4">
        <Link href="/admin" className="inline-flex min-h-12 items-center text-muted-foreground">
          Maintainer
        </Link>
      </p>
    </>
  );
}
