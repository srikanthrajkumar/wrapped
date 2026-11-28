// The public privacy policy at /privacy (Google's brand verification for Sign in with Google;
// India's DPDP Act). A plain HTML document built with the app (the privacy-page plugin in
// app/vite.config.ts), never the app shell: a reviewer or crawler reads it without signing in,
// running first launch or JavaScript. The words it shares with the app (the two consent
// questions and their reasons, the Settings rows) come from messages.ts, so the two never drift.
//
// Every claim here is checked against the code and docs: Google's ID token claims and what is
// kept of them (supabase/migrations/0001_accounts.sql, app/src/store/auth.ts), the device label
// (app/src/store/account.ts), Mumbai and the 30-day backups (ADR 0014, carnatic-backups),
// deletion and de-identification (0005_deletion.sql; specs/001-season-logger/data-model.md),
// and consent events kept at least a year (0001_accounts.sql). Change one, change this page.
//
// Public words only: never the project's working name or a server address.

import { MESSAGES } from '../screens/messages';
import { PRIVACY_POLICY_PATH } from './path';

export { PRIVACY_POLICY_FILE, PRIVACY_POLICY_PATH } from './path';
export const PRIVACY_CONTACT = 'privacy@carnatic.live';
export const PRIVACY_UPDATED = '28 November 2026';

/** The tokens the page uses from app/src/styles/app.css, per theme. */
const TOKENS = ['background', 'foreground', 'muted-foreground', 'panel', 'border'] as const;
type Tokens = Partial<Record<(typeof TOKENS)[number], string>>;

export interface PageOptions {
  /** The app's stylesheet, for its colours; without it the page falls back to its own. */
  css?: string;
  /** The built URL of Source Sans 3's Latin file; without it, the system font. */
  fontUrl?: string;
}

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** One block's custom properties (`:root {` or `.dark {`), first occurrence, by name. */
function readBlock(css: string, selector: string): Tokens {
  const start = css.search(new RegExp(`^${selector.replace('.', '\\.')} \\{$`, 'm'));
  if (start < 0) return {};
  const block = css.slice(start, css.indexOf('\n}', start));
  const tokens: Tokens = {};
  for (const name of TOKENS) {
    const value = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm').exec(block)?.[1];
    if (value && !value.includes('var(')) tokens[name] = value.trim();
  }
  return tokens;
}

// The app's own values as of 2026-11-28, used only when app.css can't be read.
const FALLBACK_DARK: Required<Tokens> = {
  background: 'oklch(0.148 0.004 228.8)',
  foreground: 'oklch(0.88 0.014 80)',
  'muted-foreground': 'oklch(0.72 0.014 75)',
  panel: 'oklch(0.195 0.006 226)',
  border: 'oklch(1 0 0 / 10%)',
};
const FALLBACK_LIGHT: Required<Tokens> = {
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.2 0.014 60)',
  'muted-foreground': 'oklch(0.5 0.016 60)',
  panel: 'oklch(0.965 0 0)',
  border: 'oklch(0.925 0.005 214.3)',
};

function declarations(tokens: Required<Tokens>): string {
  return TOKENS.map((name) => `--${name}: ${tokens[name]};`).join(' ');
}

const SETTINGS = MESSAGES.tabs.settings;
const ACCOUNT = MESSAGES.account.title;
const path = (...rows: string[]) =>
  `<b>${[SETTINGS, ACCOUNT, ...rows].map(escape).join(' → ')}</b>`;
const mail = `<a href="mailto:${PRIVACY_CONTACT}">${PRIVACY_CONTACT}</a>`;

/** The policy's sections: a heading and its blocks, each a paragraph or a list (HTML). */
export const SECTIONS: { heading: string; blocks: (string | string[])[] }[] = [
  {
    heading: 'When you sign in with Google',
    blocks: [
      'You sign in with your Google account. Google then tells us only:',
      [
        'your name',
        'your email address',
        'your profile picture (a link to it)',
        'your Google account ID, a number that tells your account apart from others',
      ],
      'We ask Google for nothing else. We never see your password, contacts, emails, files or anything else in your Google account.',
      'We use your name and email to show who is signed in, and to find your account if you ask us to delete it. The account ID lets you sign in again, on this phone or a new one. The app doesn’t use your picture. We never send you marketing emails.',
    ],
  },
  {
    heading: 'What you log',
    blocks: [
      'Your diary (the concerts, artists, ragas and songs you log, and your notes) is saved on your phone first, so the app works without signal. Once you’re signed in, a copy is backed up to our server, so you can get it back on a new phone.',
      'We also keep the kind of phone you log from (for example “iPhone”), so only one phone writes your diary at a time.',
    ],
  },
  {
    heading: 'Your two choices',
    blocks: [
      `When you first open the app, we ask you two questions. Nothing is chosen for you, and you can change either answer anytime in ${path(MESSAGES.account.privacy)}.`,
      [
        `<b>${escape(MESSAGES.consent1.question)}</b> ${escape(MESSAGES.consent1.reason)}`,
        `<b>${escape(MESSAGES.consent2.question)}</b> ${escape(MESSAGES.consent2.reason)}`,
      ],
    ],
  },
  {
    heading: 'Where it’s kept',
    blocks: [
      'Your account and the backed-up copy of your diary are kept in a database run for us by Supabase, in Mumbai, India.',
      'Every night we make an encrypted backup of that database. Each backup is kept for 30 days, then deleted. Only we hold the key that opens it.',
    ],
  },
  {
    heading: 'Who we share it with',
    blocks: [
      'We don’t sell your data, and we don’t share it with anyone. The app has no ads, trackers or analytics.',
      'A few companies run parts of the service for us, and handle your data only to do that: Google (sign-in), Supabase (the database), Cloudflare (delivers the app) and GitHub (stores the encrypted backups).',
      'If you said yes to the season totals, we may publish totals across everyone, like the most-heard ragas. They never name you or show your diary.',
    ],
  },
  {
    heading: 'How long we keep it',
    blocks: [
      [
        'Your account and backed-up diary: until you ask us to delete them.',
        'Each nightly backup: 30 days.',
        'A record of each answer to the two questions (the answer and when you gave it), with no name or email: at least a year, as India’s data protection rules require.',
      ],
    ],
  },
  {
    heading: 'Deleting your data',
    blocks: [
      `Email ${mail} from the address you sign in with, and ask us to delete your account. In the app, ${path(MESSAGES.account.deleteTitle)} writes that email for you.`,
      'We then:',
      [
        'delete your sign-in account, which signs you out on every device',
        'remove your name, your email and every note you wrote',
        'delete your backed-up diary, unless you said yes to counting your concerts in the season totals. Then we keep your concerts and songs, without your name, email or notes, so the totals stay right. Nothing left links them to you.',
      ],
      'Backups that still hold your data are deleted within 30 days.',
      'The diary on your phone stays there until you delete the app or clear this site’s data in your browser.',
    ],
  },
  {
    heading: 'Contact',
    blocks: [
      `Questions about your privacy: ${mail}.`,
      'If this policy changes, we’ll update this page and the date at the top.',
    ],
  },
];

function block(content: string | string[]): string {
  return typeof content === 'string'
    ? `<p>${content}</p>`
    : `<ul>${content.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

/** The whole document, as served at /privacy. */
export function privacyPage({ css = '', fontUrl }: PageOptions = {}): string {
  const light = { ...FALLBACK_LIGHT, ...readBlock(css, ':root') };
  const dark = { ...FALLBACK_DARK, ...readBlock(css, '.dark') };
  const font = fontUrl
    ? `@font-face { font-family: 'Source Sans 3'; font-style: normal; font-weight: 200 900; font-display: swap; src: url('${fontUrl}') format('woff2'); }`
    : '';
  const description =
    'What carnatic.live collects when you sign in with Google, why, where it is kept, and how to have it deleted.';
  const sections = SECTIONS.map(
    ({ heading, blocks }) =>
      `<section><h2>${heading}</h2>${blocks.map((content) => block(content)).join('')}</section>`,
  ).join('\n      ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Privacy policy · carnatic.live</title>
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="https://carnatic.live${PRIVACY_POLICY_PATH}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta name="color-scheme" content="dark light" />
    <style>
      ${font}
      :root { ${declarations(dark)} color-scheme: dark; }
      @media (prefers-color-scheme: light) { :root { ${declarations(light)} color-scheme: light; } }
      * { box-sizing: border-box; }
      html { -webkit-text-size-adjust: 100%; }
      body { margin: 0; background: var(--background); color: var(--foreground); font-family: 'Source Sans 3', ui-sans-serif, system-ui, sans-serif; font-size: 17px; line-height: 24px; }
      main { max-width: 640px; margin: 0 auto; padding: calc(24px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) calc(48px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
      a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
      .home { display: inline-block; color: var(--muted-foreground); font-size: 15px; line-height: 20px; padding: 8px 0; }
      h1 { font-size: 32px; line-height: 40px; font-weight: 700; margin: 16px 0 4px; }
      .updated { color: var(--muted-foreground); font-size: 15px; line-height: 20px; margin: 0 0 24px; }
      h2 { font-size: 20px; line-height: 28px; font-weight: 700; margin: 0 0 8px; }
      section { border-top: 1px solid var(--border); padding-top: 24px; margin-top: 24px; }
      p { margin: 0 0 12px; }
      ul { margin: 0 0 12px; padding-left: 20px; }
      li { margin-bottom: 8px; }
      b { font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <a class="home" href="/">← carnatic.live</a>
      <h1>Privacy policy</h1>
      <p class="updated">Updated ${PRIVACY_UPDATED}</p>
      <p>carnatic.live is a free app for logging the concerts you hear in the Chennai December season. This page explains what it collects, why, where it’s kept, and how to have it deleted.</p>
      ${sections}
    </main>
  </body>
</html>
`;
}
