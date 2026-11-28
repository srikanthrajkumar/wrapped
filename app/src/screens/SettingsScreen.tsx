// Settings (DESIGN.md "Settings", laid out 2026-11-03 for Phase 4; a tab since 2026-11-13). With
// a server, it opens on one Account row: who is signed in, with a chevron to the Account page
// (the Maintainer, 2026-11-28: no deletion contact or "Sign out other devices" on the first
// view). Then the season, as icon-led rows whose words are their accessible names, amber when
// something is wrong: offline readiness, persisted storage, the backup (with a server), and
// Export with the day of the last one. Then the theme; then "Send feedback" (a mailto: row) and
// the Maintainer's link on one panel; then the app and catalog versions, small and muted.
// Settings can always be reached, offline too (FR-019). The Account page holds who is signed in,
// "Sign out other devices" (FR-021), Privacy, a page of its own with both consents (changeable at
// any time, kept on the phone at once and sent at once; FR-042, FR-049), and the deletion contact
// as a mailto: row (FR-046).

import {
  IconAlertCircle,
  IconCloudCheck,
  IconCloudUp,
  IconDevicesX,
  IconLoader2,
  IconLock,
  IconMessageCircle,
  IconTool,
  IconPlaneTilt,
  IconShieldCheck,
  IconShieldExclamation,
  IconTrash,
  IconUserCircle,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import type { MeResponse } from '../model';
import { useOfflineState } from '../pwa';
import { ACCOUNT_KEY, CONSENT_KEY, type Consent, type ConsentName } from '../store/account';
import { IDENTITY_KEY, signOutOtherDevices, type Identity } from '../store/auth';
import { buildAuthConfig } from '../store/auth-config';
import { CATALOG_VERSION_KEY } from '../store/catalog-version';
import { LAST_EXPORT_KEY, type LastExport } from '../store/export';
import { storagePersisted } from '../store/persist';
import { preloadMeta, useMeta, useUnsyncedCount } from '../store/queries';
import { READY_KEY } from '../store/offline-ready';
import { changeConsent, refreshAccount } from '../store/sync-runtime';
import { setTheme, useTheme, type Theme } from '../theme';
import { APP_VERSION, exportSeason, useExportState } from './components/export-file';
import { ExportIcon } from './components/feedback';
import { Panel, Screen, TabHeader, TopBar } from './components/layout';
import { ListRowBody, ROW_SHAPE } from './components/rows';
import { currentDeviceFacts, describeDevice, feedbackMailto } from './feedback-link';
import { useSyncStatus } from './sync-status';
import { shortDayText } from './format';
import { MESSAGES } from './messages';

const ICON = 'size-5 shrink-0';
/** Fixed for the build: a build without a server has no backup or account to show. */
const AUTH_CONFIG = buildAuthConfig();
/** A Settings row is a List row (the row spec, 2026-11-16): its mark, then its title at 56. */
const ROW = cn(ROW_SHAPE, 'hairline-b');

// Settings' rows wait on answers: the store (offline readiness, the last Export, the catalog
// version) and the browser (storage protected). Measured on a 4x-slowed CPU (walkthrough P10),
// Storage and Offline painted 30-60ms after the page and pushed Export down. So the answers are
// read ahead, when the app opens, and the last one is drawn at once while it is asked again.
let persistedSeen: boolean | undefined;

/** Read ahead what Settings shows, so it opens whole. */
export function preloadSettings(): void {
  void preloadMeta([
    READY_KEY,
    LAST_EXPORT_KEY,
    CATALOG_VERSION_KEY,
    IDENTITY_KEY,
    CONSENT_KEY,
    ACCOUNT_KEY,
  ]).catch(() => undefined);
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

/** The writes not yet on the server (FR-016, constitution II), counted as the home line words it. */
function BackupRow() {
  const count = useUnsyncedCount();
  if (count === undefined) return <Pending />;
  return count === 0 ? (
    <SeasonRow icon={<IconCloudCheck aria-hidden className={ICON} />}>
      {MESSAGES.homeStatus.allSynced}
    </SeasonRow>
  ) : (
    <SeasonRow icon={<IconCloudUp aria-hidden className={ICON} />}>
      {MESSAGES.homeStatus.changesWaiting(count)}
    </SeasonRow>
  );
}

/**
 * One choice as one track holding both answers, as the theme's. A consent shows neither picked
 * until it is answered (FR-042, FR-049: nothing pre-selected).
 */
function ChoiceTrack<T extends string | boolean>({
  label,
  value,
  choices,
  onChoose,
  note,
}: {
  label: string;
  value: T | null;
  choices: { value: T; label: string }[];
  onChoose(value: T): void;
  /** A line under the track, muted: why it's asked. */
  note?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-body font-semibold text-foreground">{label}</span>
      {/* One track holding both choices, so it reads as one choice; on the 8px edge. */}
      <div className="fill-edge flex gap-1 rounded-fill border border-border p-1">
        {choices.map((choice) => (
          <button
            key={String(choice.value)}
            type="button"
            role="radio"
            aria-checked={value === choice.value}
            onClick={() => onChoose(choice.value)}
            className={cn(
              'min-h-12 flex-1 rounded-xl px-4',
              value === choice.value && 'bg-secondary font-semibold',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {note && <p className="text-sub text-muted-foreground">{note}</p>}
    </div>
  );
}

const YES_NO = [
  { value: true, label: MESSAGES.actions.yes },
  { value: false, label: MESSAGES.actions.no },
];

function ConsentChoice({
  name,
  label,
  note,
  value,
}: {
  name: ConsentName;
  label: string;
  note: string;
  value: boolean | null;
}) {
  return (
    <ChoiceTrack
      label={label}
      note={note}
      value={value}
      choices={YES_NO}
      onChoose={(answer) => {
        // Kept on the phone now and sent at once, even while sync is stopped for another phone
        // writing; with no signal, the next sync sends it.
        void changeConsent(name, answer).catch(() => undefined);
      }}
    />
  );
}

/** "Sign out other devices" (FR-021: a lost phone), with how it went on the line under it. */
function SignOutOthersRow({ config }: { config: NonNullable<typeof AUTH_CONFIG> }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  return (
    <li className="hairline-b">
      <button
        type="button"
        className={ROW_SHAPE}
        aria-busy={state === 'working' || undefined}
        disabled={state === 'working'}
        onClick={async () => {
          setState('working');
          try {
            await signOutOtherDevices({ config });
            setState('done');
          } catch {
            setState('failed');
          }
        }}
      >
        <ListRowBody
          mark={<IconDevicesX aria-hidden className={ICON} />}
          title={MESSAGES.account.signOutOthers}
          line={
            state === 'done' || state === 'failed' ? (
              <span role="status">
                {state === 'done'
                  ? MESSAGES.account.signedOutOthers
                  : MESSAGES.account.signOutOthersFailed}
              </span>
            ) : undefined
          }
        />
      </button>
    </li>
  );
}

/** Whether the server has ended this phone's session (signed out elsewhere, or another account). */
function useSessionEnded(): boolean {
  const status = useSyncStatus();
  return (
    status.state === 'stopped' &&
    (status.failure.kind === 'signed_out' || status.failure.kind === 'other_account')
  );
}

/**
 * Settings' one Account row (2026-11-28): who is signed in, with a chevron to the Account page,
 * where the rest of the account lives. Signed out, it says so and opens nothing.
 */
function AccountRow() {
  const identity = useMeta<Identity>(IDENTITY_KEY);
  const ended = useSessionEnded();
  useEffect(() => {
    void refreshAccount();
  }, []);
  if (!identity) {
    return (
      <li className={ROW}>
        <ListRowBody
          mark={<IconUserCircle aria-hidden className={ICON} />}
          title={MESSAGES.account.notSignedIn}
        />
      </li>
    );
  }
  return (
    <li>
      <Link href={ACCOUNT_PATH} className={ROW_SHAPE}>
        <WhoBody identity={identity} ended={ended} chevron />
      </Link>
    </li>
  );
}

/**
 * Who is signed in: Google's name with the email under it, or the email alone; once the session
 * has ended, "Sign in again…" in place of the email.
 */
function WhoBody({
  identity,
  ended,
  chevron,
}: {
  identity: Identity;
  ended: boolean;
  /** Settings' row: a chevron, and a long email cut to one line so the chevron stays. */
  chevron?: boolean;
}) {
  const email = identity.name ? identity.email : null;
  const emailLine = email && (
    <span className={chevron ? 'block truncate' : 'break-all'}>{email}</span>
  );
  return (
    <ListRowBody
      mark={<IconUserCircle aria-hidden className={ICON} />}
      title={
        // A name breaks between words; an email alone anywhere.
        <span className={identity.name ? undefined : 'break-all'}>
          {identity.name ?? identity.email ?? MESSAGES.account.title}
        </span>
      }
      line={ended ? MESSAGES.sessionEnded : emailLine}
      chevron={chevron}
    />
  );
}

/** The Account page, pushed from Settings' Account row. */
export const ACCOUNT_PATH = '/settings/account';

/**
 * Account (2026-11-28; FR-021, FR-042, FR-046, FR-049): who is signed in and "Sign out other
 * devices", then Privacy with both consents, then the deletion contact as a mailto: row, one tap
 * from Settings.
 */
export function AccountScreen() {
  const identity = useMeta<Identity>(IDENTITY_KEY);
  const account = useMeta<MeResponse>(ACCOUNT_KEY);
  const ended = useSessionEnded();
  useEffect(() => {
    void refreshAccount();
  }, []);
  return (
    <Screen>
      <TopBar back={{ href: '/settings', label: MESSAGES.tabs.settings }} />
      <h1 className="pt-2 pb-2 text-heading font-bold">{MESSAGES.account.title}</h1>
      <Panel className="mt-4">
        <li className={ROW}>
          {identity ? (
            <WhoBody identity={identity} ended={ended} />
          ) : (
            <ListRowBody
              mark={<IconUserCircle aria-hidden className={ICON} />}
              title={MESSAGES.account.notSignedIn}
            />
          )}
        </li>
        {identity && AUTH_CONFIG && <SignOutOthersRow config={AUTH_CONFIG} />}
      </Panel>
      {identity && (
        <Panel className="mt-8">
          <li>
            <Link href={PRIVACY_PATH} className={ROW_SHAPE}>
              <ListRowBody
                mark={<IconLock aria-hidden className={ICON} />}
                title={MESSAGES.account.privacy}
                chevron
              />
            </Link>
          </li>
        </Panel>
      )}
      {account?.deletionContact && (
        // A mailto: link, so no chevron (it opens the mail app, not a page), with the address
        // under it for a browser that has no mail app.
        <Panel className="mt-8">
          <li>
            <a
              href={deletionMailto(account.deletionContact, identity?.email ?? null)}
              className={ROW_SHAPE}
            >
              <ListRowBody
                mark={<IconTrash aria-hidden className={ICON} />}
                title={MESSAGES.account.deleteTitle}
                line={
                  <span className="break-all">
                    {MESSAGES.account.deleteLine(account.deletionContact)}
                  </span>
                }
              />
            </a>
          </li>
        </Panel>
      )}
    </Screen>
  );
}

/** A mail to the deletion contact, its subject and a line naming the account filled in. */
function deletionMailto(contact: string, email: string | null): string {
  return (
    `mailto:${contact}` +
    `?subject=${encodeURIComponent(MESSAGES.account.deleteSubject)}` +
    `&body=${encodeURIComponent(MESSAGES.account.deleteBody(email))}`
  );
}

/** The page with both consent questions, under Account. */
export const PRIVACY_PATH = '/settings/account/privacy';

/**
 * Privacy (FR-042, FR-049): both questions as on first launch, each with its reason, changeable
 * at any time. An answer is kept on the phone at once and sent at once, even while another phone
 * is the writer; with no signal, when signal returns.
 */
export function PrivacyScreen() {
  const consent = useMeta<Consent>(CONSENT_KEY);
  useEffect(() => {
    void refreshAccount();
  }, []);
  return (
    <Screen>
      <TopBar back={{ href: ACCOUNT_PATH, label: MESSAGES.account.title }} />
      <h1 className="pt-2 pb-2 text-heading font-bold">{MESSAGES.account.privacy}</h1>
      <div className="mt-4 flex flex-col gap-8">
        <ConsentChoice
          name="shareAdditions"
          label={MESSAGES.consent1.question}
          note={MESSAGES.consent1.reason}
          value={consent?.shareAdditions ?? null}
        />
        <ConsentChoice
          name="seasonReports"
          label={MESSAGES.consent2.question}
          note={MESSAGES.consent2.reason}
          value={consent?.seasonReports ?? null}
        />
      </div>
    </Screen>
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
      {/* A tab since 2026-11-13 (the Maintainer): a plain header, with no way back to give. */}
      <TabHeader title={MESSAGES.tabs.settings} />
      {/* Who is signed in first, one row to the Account page (the Maintainer, 2026-11-28, B of
          three); then the season's rows. Each group on its panel, 32px apart (foundations,
          2026-11-16). */}
      {AUTH_CONFIG && (
        <Panel className="mb-8">
          <AccountRow />
        </Panel>
      )}
      <Panel>
        <OfflineRow />
        <StorageRow />
        {AUTH_CONFIG && <BackupRow />}
        <ExportRow />
      </Panel>
      <div className="mt-8">
        <ChoiceTrack<Theme>
          label="Theme"
          value={theme}
          choices={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          onChoose={setTheme}
        />
      </div>
      {/* Feedback and the Maintainer's link on one panel. Feedback is a mailto: link, so no
          chevron (it opens the mail app, not a page), with the inbox under it for a browser that
          has no mail app; the Maintainer's opens a page. The versions close the page. */}
      <Panel className="mt-8">
        <li className="hairline-b">
          <a
            href={feedbackMailto(APP_VERSION, describeDevice(currentDeviceFacts()))}
            className={ROW_SHAPE}
          >
            <ListRowBody
              mark={<IconMessageCircle aria-hidden className={ICON} />}
              title={MESSAGES.feedback.title}
              line={MESSAGES.feedback.address}
            />
          </a>
        </li>
        <li>
          <Link href="/admin" className={ROW_SHAPE}>
            <ListRowBody
              mark={<IconTool aria-hidden className={ICON} />}
              title="Maintainer"
              chevron
            />
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
      </p>
    </>
  );
}
