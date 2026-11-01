// A bottom sheet for the docked-search pickers (DESIGN.md "Elevation & Depth"): it rises over a
// 50% black scrim, keeps focus inside until closed, then returns it to the control that opened
// it (Radix Dialog; design D24), and its search box sits just above the keyboard.

import type { ReactNode } from 'react';
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
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  /** Full height, for a docked search; otherwise as tall as its content. */
  tall?: boolean;
  children: ReactNode;
}) {
  const inset = useKeyboardInset();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        style={
          inset > 0 ? { bottom: inset, maxHeight: `calc(100dvh - ${inset}px - 24px)` } : undefined
        }
        className={cn(tall && 'h-[92dvh]')}
        // Focus goes to the sheet itself, not its search box: only the Item editor's search
        // autofocuses, so no keyboard rises unasked (DESIGN.md "Search box"; design D24).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
