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
  line = true,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item> & {
  /** The hairline above the row; off where what is above it ends on a line of its own. */
  line?: boolean;
}) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(line && 'hairline-t', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  row = false,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  /** The first row of its own panel, rather than a label over one: no reach into what follows. */
  row?: boolean;
}) {
  return (
    // An h2, as the section heads around it are (Radix's default h3 would skip a level).
    <AccordionPrimitive.Header asChild>
      {/* Its 48px row reaches 4px into what follows, so the label stands 8px over it, as a
          label stands over its panel (foundations, 2026-11-16). */}
      <h2 className={row ? 'flex' : '-mb-1 flex'}>
        <AccordionPrimitive.Trigger
          data-slot="accordion-trigger"
          className={cn(
            // A fold's title is a label above what it holds: body 600, in ink (foundations).
            'group/accordion-trigger flex min-h-12 flex-1 items-center justify-between gap-2 py-2 text-left text-body font-semibold text-foreground disabled:pointer-events-none disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
          <IconChevronDown
            aria-hidden
            data-slot="accordion-trigger-icon"
            className="pointer-events-none -mr-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-sheet group-aria-expanded/accordion-trigger:rotate-180"
          />
        </AccordionPrimitive.Trigger>
      </h2>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  onFocus,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      // A focus ring inside stays inside the clip, and a field reaches the 8px edge: 16px of
      // padding at the sides, taken back by the margin.
      className="-mx-4 overflow-hidden px-4 ease-sheet data-open:animate-accordion-down data-closed:animate-accordion-up"
      // Focus moving in as the fold opens finishes the opening, so the field is at its place and
      // the page at its height when it is scrolled clear of the footer (App's useFooterRoom).
      onFocus={(event) => {
        for (const animation of event.currentTarget.getAnimations?.() ?? []) animation.finish();
        onFocus?.(event);
      }}
      {...props}
    >
      <div className={cn('pb-4', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
