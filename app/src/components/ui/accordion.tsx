import * as React from 'react';
import { cn } from '@/lib/utils';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import { IconChevronDown } from '@tabler/icons-react';

// shadcn's Accordion, as the app's fold (DESIGN.md "Motion", walkthrough P8): rows on the
// background divided by the hairline, a muted section-label trigger on a 48px row with its
// chevron on the gutter, and content that grows to its height and shrinks back over 200ms.

function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('hairline-t', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    // An h2, as the section heads around it are (Radix's default h3 would skip a level).
    <AccordionPrimitive.Header asChild>
      <h2 className="flex">
        <AccordionPrimitive.Trigger
          data-slot="accordion-trigger"
          className={cn(
            'group/accordion-trigger flex min-h-12 flex-1 items-center justify-between gap-2 py-2 text-left text-sub font-semibold text-muted-foreground disabled:pointer-events-none disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
          <IconChevronDown
            aria-hidden
            data-slot="accordion-trigger-icon"
            className="pointer-events-none size-5 shrink-0 transition-transform duration-200 ease-sheet group-aria-expanded/accordion-trigger:rotate-180"
          />
        </AccordionPrimitive.Trigger>
      </h2>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      // A focus ring inside stays inside the clip: 4px of padding, taken back by the margin.
      className="-mx-1 overflow-hidden px-1 ease-sheet data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div className={cn('pb-4', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
