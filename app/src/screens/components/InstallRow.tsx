// The install strip (DESIGN.md "Install"; eng review D15; the Maintainer, 2026-11-11): on a phone
// with the app open in a browser tab, one thin persistent strip directly above the tab bar, the
// same on every tab, with no dismiss. On iPhone it draws Safari's steps as marks, the Share
// glyph and then Add to Home Screen; on Android, led by the same Add mark, it has one Install
// button that opens the browser's prompt. Installed, or on a desktop, nothing. It is part of the
// shell's bottom stack (search bar, strip, tab bar), so it never covers or disables a screen's
// action, and it hides with the tab bar while the Item editor is open.

import { IconChevronRight, IconShare2, IconSquarePlus } from '@tabler/icons-react';
import { promptInstall, useInstall } from '../../install';
import { MESSAGES } from '../messages';

const STRIP =
  'flex items-center gap-x-2 bg-background text-sub text-muted-foreground hairline-t pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(16px+env(safe-area-inset-left))]';

export function InstallStrip() {
  const { way, canPrompt } = useInstall();
  if (way === 'ios') {
    return (
      <div data-install-strip className={`${STRIP} min-h-9 flex-wrap py-2`}>
        {/* The marks stand for words, so they grow with the text (20px at the default size). */}
        <span aria-hidden className="flex flex-wrap items-center gap-x-2">
          <span>{MESSAGES.install.iPhone}</span>
          {/* The two steps wrap together, never apart. */}
          <span className="flex items-center gap-x-2">
            <IconShare2 className="size-[1.33em] shrink-0" />
            <IconChevronRight className="size-[1.07em] shrink-0" />
            <IconSquarePlus className="size-[1.33em] shrink-0" />
          </span>
        </span>
        <span className="sr-only">{MESSAGES.install.name}</span>
      </div>
    );
  }
  // Android without the browser's offer (it may come later) has nothing to tap.
  if (way !== 'android' || !canPrompt) return null;
  return (
    <div data-install-strip className={`${STRIP} min-h-11 justify-between`}>
      <span aria-hidden className="flex items-center gap-x-2 py-2">
        <IconSquarePlus className="size-[1.33em] shrink-0" />
        {MESSAGES.install.android}
      </span>
      {/* A text button, 44px tall, its label ending on the gutter. */}
      <button
        type="button"
        aria-label={`${MESSAGES.install.action}. ${MESSAGES.install.why}`}
        onClick={() => void promptInstall()}
        className="-mr-2 flex min-h-11 items-center rounded-xl px-2 font-semibold text-foreground"
      >
        {MESSAGES.install.action}
      </button>
    </div>
  );
}
