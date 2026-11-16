// A fold on a screen (DESIGN.md "Motion", walkthrough P8): one section of shadcn's Accordion,
// open or closed by its owner, growing open and shrinking closed over 200ms.

import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function Fold({
  title,
  open,
  onOpenChange,
  line = true,
  last = false,
  className,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The hairline above it; off where the fold follows a list that ends on its own line. */
  line?: boolean;
  /** The page's last block: nothing under its content, so the page's own room ends it. */
  last?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      value={open ? 'open' : ''}
      onValueChange={(value) => onOpenChange(value === 'open')}
      className={className}
    >
      {/* Last on the page and closed, its row's 48px reaches into the page's scroll room and
          adds no height (foundations, 2026-11-16). */}
      <AccordionItem
        value="open"
        line={line}
        className={last ? 'data-[state=closed]:-mb-2' : undefined}
      >
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent className={last ? 'pb-0' : undefined}>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
