// A bottom sheet for the docked-search pickers (DESIGN.md "Elevation & Depth"): it rises over a
// 50% black scrim, keeps focus inside until closed, then returns it to the control that opened
// it (Radix Dialog; design D24), and its search box sits just above the keyboard.

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { cn } from '@/lib/utils';

export function SheetFrame({
  open,
  onOpenChange,
  title,
  description,
  tall = false,
  header,
  focus,
  className,
  children,
}: {
  /** For the sheet itself (a height the content doesn't set). */
  className?: string;
  /**
   * Focused as the sheet opens, its keyboard rising at once: only for a sheet opened to type in
   * (Season's search, as the Item editor's; DESIGN.md "Search box").
   */
  focus?: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The sheet's name; shown as its title unless `header` takes its place. */
  title: string;
  description?: string;
  /** Shown in place of the title, which screen readers still hear (an editable name). */
  header?: ReactNode;
  /** Full height, for a docked search; otherwise as tall as its content. */
  tall?: boolean;
  children: ReactNode;
}) {
  const inset = useKeyboardInset();
  // What opened the sheet, given focus back as it closes without scrolling the page to it: a
  // control in the sticky bottom bar sits, to the browser, at the page's end.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        style={
          inset > 0
            ? { bottom: inset, maxHeight: `calc(var(--app-height) - ${inset}px - 24px)` }
            : undefined
        }
        className={cn(tall && 'h-[calc(var(--app-height)*0.92)]', className)}
        // Focus goes to the sheet itself, not its search box: only the Item editor's search
        // autofocuses, so no keyboard rises unasked (DESIGN.md "Search box"; design D24).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (
            document.activeElement instanceof HTMLElement &&
            document.activeElement !== document.body
          )
            opener.current = document.activeElement;
          // Without scrolling: the sheet is still sliding up from below the screen.
          if (focus?.current) focus.current.focus({ preventScroll: true });
          else (event.currentTarget as HTMLElement).focus();
        }}
        // One sheet closing as another opens (an Artist's sheet to their Colours) leaves focus in
        // the one opening, rather than returning it to the row under both.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (document.querySelector('[role="dialog"][data-state="open"]')) return;
          const back = opener.current;
          opener.current = null;
          if (back?.isConnected) back.focus({ preventScroll: true });
        }}
      >
        <SheetHeader>
          <SheetTitle className={cn(header !== undefined && 'sr-only')}>{title}</SheetTitle>
          {header}
          {description ? (
            // 4px under the title's line, not under its 48px row.
            <SheetDescription className="-mt-2.5">{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * What a sheet shows, kept while it closes: a screen that holds "which sheet is open" as a value
 * renders the sheet from the last value with `open` false, so it slides back down the way it
 * came instead of vanishing (walkthrough P8). Returns that value and whether the sheet is open.
 */
export function useLingering<T>(value: T | null): [T | null, boolean] {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  return [value ?? last, value !== null];
}
