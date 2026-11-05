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
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  children: ReactNode;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      value={open ? 'open' : ''}
      onValueChange={(value) => onOpenChange(value === 'open')}
    >
      <AccordionItem value="open">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
