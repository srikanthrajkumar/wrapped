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
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The hairline above it; off where the fold follows a list that ends on its own line. */
  line?: boolean;
  children: ReactNode;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      value={open ? 'open' : ''}
      onValueChange={(value) => onOpenChange(value === 'open')}
    >
      <AccordionItem value="open" line={line}>
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
