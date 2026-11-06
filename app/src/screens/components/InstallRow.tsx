// The install row (DESIGN.md "Install"; eng review D15): on a phone with the app open in a
// browser tab, one persistent row under every screen's title, with no dismiss. On iPhone it draws
// Safari's steps as marks, the Share glyph and then Add to Home Screen; on Android, led by the
// same Add mark, it has one Install button that opens the browser's prompt. Installed, or on a
// desktop, nothing. It sits in the page's flow at the top, so it never covers or disables Add
// Item. A 48px row with its hairline drawn inside (DESIGN.md "Layout"); on the tabs it comes
// from TabHeader, so it sits at the same place on Season, Wrapped and Settings.

import { IconChevronRight, IconShare2, IconSquarePlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { promptInstall, useInstall } from '../../install';
import { MESSAGES } from '../messages';

export function InstallRow() {
  const { way, canPrompt } = useInstall();
  if (way === 'ios') {
    return (
      <div className="flex min-h-12 items-center text-sub text-muted-foreground hairline-b">
        {/* The marks stand for words, so they grow with the text (20px at the default size). */}
        <span aria-hidden className="flex flex-wrap items-center gap-x-2 py-2">
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
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-2 text-sub text-muted-foreground hairline-b">
      <span aria-hidden className="flex items-center gap-x-2 py-2">
        <IconSquarePlus className="size-[1.33em] shrink-0" />
        {MESSAGES.install.android}
      </span>
      {/* The label ends on the gutter; the 48px tap area reaches past it. */}
      <Button
        variant="ghost"
        className="-mr-4 text-foreground"
        aria-label={`${MESSAGES.install.action}. ${MESSAGES.install.why}`}
        onClick={() => void promptInstall()}
      >
        {MESSAGES.install.action}
      </Button>
    </div>
  );
}
