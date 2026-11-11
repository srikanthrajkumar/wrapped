import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn's Empty (added with the CLI from the Rhea preset), in the app's tokens (DESIGN.md "Empty
// states"): the type scale (a `body` 600 title over a `sub` muted line), the 8px grid, a 48px
// mark on `surface-raised` with 14px corners, and no dashed border. It is used only where
// something is truly empty: an Event with no Items, the hub with nothing left today, an empty
// Shortlist or Diary, a search with no match.

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex w-full min-w-0 flex-col items-center justify-center gap-6 px-4 py-8 text-center text-balance',
        className,
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-[280px] flex-col items-center gap-2', className)}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg:not([class*='size-'])]:size-[22px]",
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="empty-title"
      className={cn('font-heading text-body font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-description"
      // Not through `cn`, which reads the type scale's `text-sub` as a colour and drops it
      // before `text-muted-foreground`.
      className={`text-sub text-muted-foreground ${className ?? ''}`}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn('flex w-full max-w-[280px] min-w-0 flex-col items-center gap-2', className)}
      {...props}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
