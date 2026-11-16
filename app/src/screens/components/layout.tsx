// The pieces every screen shares (DESIGN.md "The Season spine", "Shared parts"): a screen's root
// and its kept place, the pushed screens' top bar (design D5), the plain tab header and the
// hub's curtain, the section header with its chevron, the bottom bar that holds a screen's one
// action above the tab bar, and the status line.

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { MESSAGES } from '../messages';
import {
  arrive,
  lastMove,
  leftAt,
  navState,
  noteScroll,
  subscribeNav,
  under,
  WHATS_ON,
} from '../nav';
import { SeasonFeedback } from './feedback';
import { UndoBar } from './UndoBar';

/**
 * A screen's root (DESIGN.md "Motion", "Navigation"): going into a page, the screen enters from
 * the right and opens at its top; coming back, from the left. The first screen and a switch
 * between tabs just appear, so nothing waits on motion. A page come back to, or a tab switched
 * to, is found where it was left, by the screens that keep their place ({@link useKeptScroll};
 * What's on keeps its own).
 */
export function Screen({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [enter] = useState<'forward' | 'back' | undefined>(() => {
    const move = arrive(path);
    return move === 'forward' || move === 'back' ? move : undefined;
  });
  useLayoutEffect(() => {
    // Once, as the screen first draws.
    if (lastMove() === 'forward') window.scrollTo(0, 0);
  }, []);
  return (
    <div data-enter={enter} className="screen flex flex-1 flex-col">
      {children}
    </div>
  );
}

/**
 * Keep a page's place: where it was scrolled to as the rasika left it, found again when they
 * come back to it or switch back to its tab, once its content is `ready`; a page gone into opens
 * at its top. The tab that is on, tapped, forgets the place first (screens/nav.ts).
 */
export function useKeptScroll(ready: boolean) {
  const [path] = useLocation();
  useLayoutEffect(() => {
    if (!ready) return;
    window.scrollTo(0, lastMove() === 'forward' ? 0 : leftAt(path));
    return () => noteScroll(path, window.scrollY);
  }, [ready, path]);
}

/** The shell's bottom bar, for the screen on show to fill. */
export type Bar = {
  /** Where the screen's action goes, inside the bar's frame. */
  slot: HTMLElement;
  /** Keep showing what the bar last held until the returned release is called. */
  hold(): () => void;
};
const BarContext = createContext<Bar | null>(null);
export const BarProvider = BarContext.Provider;

/** The labels the bar shows, to tell a change of action from the same action redrawn. */
const labels = (slot: HTMLElement) =>
  [...slot.querySelectorAll('[data-slot="button"]')].map((b) => b.textContent).join('|');

/**
 * The bottom bar (DESIGN.md "Thumb zone", "Motion"): one frame, owned by the shell, that never
 * unmounts across Season, Event and Item, so the screen changing never empties or shrinks it.
 * A screen supplies only its contents ({@link BottomDock}). While the next screen is still
 * loading ({@link BarHold}) the frame keeps an inert copy of what it last held; when the action
 * changes, only the labels fade in (150ms) inside the same button. With no action the frame
 * hides, as on Settings and an empty Season (Season's otherwise holds its search bar), and any Undo bars sit right on the tab bar; otherwise they
 * stack above the action.
 */
export function ActionBar({ onBar }: { onBar(bar: Bar | null): void }) {
  const frame = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const kept = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = frame.current!;
    const slot = live.current!;
    const copy = kept.current!;
    let holds = 0;
    let shown: string | null = null;
    // Runs after React's commit and before the next paint (a microtask), so no frame is drawn
    // with the bar empty between one screen's action and the next.
    const update = (removed: Node[] = []) => {
      if (slot.hasChildNodes()) {
        copy.replaceChildren();
        const now = labels(slot);
        if (!root.hidden && shown !== null && now !== shown) {
          slot.removeAttribute('data-changed');
          // Reading layout restarts the fade when the attribute comes back.
          void slot.offsetWidth;
          slot.setAttribute('data-changed', '');
        }
        shown = now;
        root.hidden = false;
      } else if (holds > 0) {
        if (removed.length > 0) copy.replaceChildren(...removed.map((n) => n.cloneNode(true)));
        root.hidden = !copy.hasChildNodes();
      } else {
        copy.replaceChildren();
        root.hidden = true;
      }
    };
    const observer = new MutationObserver((records) => {
      // What the slot lost: the action that was on show before it emptied.
      const lost = records
        .filter((r) => r.target === slot)
        .flatMap((r) => [...r.removedNodes])
        .filter((n) => !n.isConnected);
      update(lost);
    });
    observer.observe(slot, { childList: true, subtree: true, characterData: true });
    const faded = (event: AnimationEvent) => {
      if (event.animationName === 'label-in') slot.removeAttribute('data-changed');
    };
    slot.addEventListener('animationend', faded);
    update();
    onBar({
      slot,
      hold() {
        holds += 1;
        return () => {
          holds -= 1;
          queueMicrotask(() => update());
        };
      },
    });
    return () => {
      observer.disconnect();
      slot.removeEventListener('animationend', faded);
      onBar(null);
    };
  }, [onBar]);
  return (
    <div className="group/stack relative">
      {/* The page fades out over 24px above a fill at the bottom (an Undo bar, the search bar,
          Add Item), so no row is cut hard against it (foundations, 2026-11-16). */}
      <div
        aria-hidden
        data-bottom-fade
        className="pointer-events-none absolute inset-x-0 bottom-full hidden h-6 bg-gradient-to-t from-background to-transparent group-has-[[data-undo-bar]]/stack:block group-has-[[data-slot=bar-frame]:not([hidden])]/stack:block"
      />
      <UndoBar />
      <div
        ref={frame}
        data-slot="bar-frame"
        // Its fill on the 8px edge (foundations, 2026-11-16).
        className="relative bg-background px-2 py-2"
      >
        <div ref={live} className="bar-slot" />
        <div ref={kept} inert aria-hidden />
      </div>
    </div>
  );
}

/** A screen's bottom action (DESIGN.md "Thumb zone"), drawn in the shell's bar. */
export function BottomDock({ children }: { children: ReactNode }) {
  const bar = useContext(BarContext);
  return bar ? createPortal(children, bar.slot) : null;
}

/**
 * Rendered by a screen with an action while it is still loading, so the bar keeps what it
 * showed instead of emptying until the screen's own action arrives.
 */
export function BarHold() {
  const bar = useContext(BarContext);
  useLayoutEffect(() => bar?.hold(), [bar]);
  return null;
}

/**
 * The top bar of a pushed screen (design D5): only a back chevron labelled with its destination
 * at the left, and at most one item at the right. The top centre belongs to the Dynamic Island.
 * The season-wide line, when there is one, sits under it (DESIGN.md "Status"); the install
 * strip is the shell's, above the tab bar.
 */
export function TopBar({
  back,
  right,
  onBack,
}: {
  back: { href: string; label: string };
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <>
      <div className="flex min-h-12 items-center justify-between gap-2">
        <Link
          href={back.href}
          onClick={onBack}
          className="-ml-2 flex min-h-12 min-w-0 items-center gap-1 rounded-xl pr-2 text-body text-foreground"
        >
          <IconChevronLeft className="size-[22px] shrink-0" stroke={2} aria-hidden />
          <span className="break-words">{back.label}</span>
        </Link>
        {/* A 48px icon button whose mark's ink (the ⋯) ends on the 24px column. */}
        {right && <div className="-mr-[17px]">{right}</div>}
      </div>
      <SeasonFeedback />
    </>
  );
}

const PAGE_NAME: Record<string, string> = {
  '/': MESSAGES.tabs.season,
  [WHATS_ON]: MESSAGES.spine.whatsOn,
  '/shortlist': MESSAGES.tabs.shortlist,
  '/diary': MESSAGES.tabs.diary,
  '/settings': MESSAGES.tabs.settings,
};

/**
 * Where a pushed screen's back chevron goes, and its name: the page under it in its tab's own
 * stack (screens/nav.ts), so an Event opened from the Diary goes back to the Diary.
 */
export function useBack(): { href: string; label: string } {
  const [path] = useLocation();
  const nav = useSyncExternalStore(subscribeNav, navState);
  const href = under(nav, path);
  return { href, label: PAGE_NAME[href] ?? MESSAGES.tabs.season };
}

/**
 * A plain tab header (the Maintainer, 2026-11-11: only the hub has a curtain): the tab's title
 * on the page, then the season-wide line (DESIGN.md "Status"). The Shortlist and the Diary start
 * with it. An `action` sits at the title's right, its 48px reaching past the line and its mark
 * ending on the gutter.
 */
export function TabHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      {/* The title 16px from the top, then 24px to the page's content (foundations). */}
      <div className="flex items-center justify-between gap-2 pt-4 pb-6">
        <h1 className="text-heading font-bold">{title}</h1>
        {action && <div className="-my-3 -mr-3.5 flex">{action}</div>}
      </div>
      {children}
      <SeasonFeedback />
    </>
  );
}

/** The top inset the shell pads the page by, as App.tsx sets it. */
const TOP = 'var(--app-top-inset,env(safe-area-inset-top))';

/**
 * The hub's curtain (DESIGN.md "The motif", "The status bar"): the motif drawn full-bleed from
 * the very top of the screen, under the clock and the Dynamic Island, with the safe area as
 * padding inside it, and the page drawn up over it as a sheet with 18px top corners (the
 * Maintainer, 2026-11-14, having seen the council's flat fade live: the sheet edge and the half
 * fade stay). Its content stands on the hub's 24px column, 8px clear of the safe area (the
 * Maintainer, 2026-11-13: more room above and left of the title). While any
 * of it is under the status bar the shell's band stays clear (`data-curtain` on the root), so
 * the field shows there; in light, where the clock is white, a rose-ink wash holds it readable.
 */
export function Curtain({ art, children }: { art: ReactNode; children: ReactNode }) {
  const field = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const node = field.current!;
    const set = () => {
      // The field still reaches under the status bar: its foot is below the shell's band.
      const band = document.querySelector<HTMLElement>('[data-status-band]');
      const inset = band?.offsetHeight ?? 0;
      root.toggleAttribute('data-curtain', node.getBoundingClientRect().bottom - 18 > inset);
    };
    set();
    window.addEventListener('scroll', set, { passive: true });
    return () => {
      window.removeEventListener('scroll', set);
      root.removeAttribute('data-curtain');
    };
  }, []);
  return (
    <div
      ref={field}
      data-curtain-field
      className="relative mr-[calc(-24px-env(safe-area-inset-right))] ml-[calc(-24px-env(safe-area-inset-left))]"
      style={{ marginTop: `calc(-1 * ${TOP})` }}
    >
      <div className="absolute inset-0 overflow-hidden">{art}</div>
      {/* The hero holds its contrast: the field fades halfway to the page behind it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/50 to-transparent"
      />
      <div aria-hidden className="status-wash absolute inset-x-0 top-0" />
      <div
        // From the top down, so the hero's row, with the +, sits at one place in every state
        // (the council, 2026-11-11: it jumped between the title and a concert).
        className="relative flex flex-col pr-[calc(24px+env(safe-area-inset-right))] pb-4 pl-[calc(24px+env(safe-area-inset-left))]"
        style={{ minHeight: `calc(${TOP} + 96px)`, paddingTop: `calc(${TOP} + 8px)` }}
      >
        {children}
      </div>
      <div aria-hidden className="relative h-[18px] rounded-t-[18px] bg-background" />
    </div>
  );
}

/**
 * Focus the screen's first block when it opens, so a screen reader starts there (design D24).
 * Returns the ref for that block, which takes tabIndex -1.
 */
export function useFocusOnOpen<T extends HTMLElement>(key: unknown): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/**
 * A section's label (foundations, 2026-11-16): `body` 600 in ink, 8px over its panel, with an
 * optional action at its right on the label's baseline ("Edit order", given `-my-3 -mr-2` so its
 * tap area reaches past the line and its text ends on the 24px column).
 */
export function SectionHead({
  id,
  children,
  action,
  className,
  headRef,
}: {
  id?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  headRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    // The label sits 8px above its panel; an action's 48px reaches past the line.
    <div data-section-label className={cn('flex items-baseline justify-between gap-2', className)}>
      <h2 id={id} ref={headRef} tabIndex={-1} className="text-body font-semibold text-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * The section pattern's header (DESIGN.md "The section pattern"; the Maintainer, 2026-11-13;
 * foundations, 2026-11-16): the label in `body` 600 ink, an optional muted line under it, and at
 * the right, on the label's baseline, a count when above zero and a chevron. With an `href` the
 * whole row is one link that opens the section's page; without one it carries no chevron, as a
 * chevron always means "this opens a page". Its text stands on the 24px column, and its
 * chevron's tip ends on the same column at the right. Its 48px tap area reaches 24px up into the
 * gap above it and never adds height; it sits 8px over its panel.
 */
export function SectionHeader({
  id,
  label,
  line,
  count = 0,
  href,
  onClick,
}: {
  id: string;
  label: string;
  /** One muted line under the label: a section with no rows says what it holds here. */
  line?: ReactNode;
  count?: number;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <h2 id={id} className="text-body font-semibold break-words text-foreground">
          {label}
        </h2>
        {line && <span className="text-sub text-muted-foreground">{line}</span>}
      </span>
      {count > 0 && <span className="text-sub text-muted-foreground tabular-nums">{count}</span>}
      {href && (
        // Centred on the label's first line; the mark's ink ends on the column.
        <span className="flex h-6 items-center self-start">
          <IconChevronRight
            aria-hidden
            className="-mr-2 size-[22px] shrink-0 text-muted-foreground"
          />
        </span>
      )}
    </>
  );
  const shape = 'relative -mt-6 flex min-h-12 items-baseline gap-2 pt-6';
  return href ? (
    <Link
      href={href}
      onClick={onClick}
      data-section-label
      className={cn(shape, 'rounded-xl focus-visible:-outline-offset-2')}
    >
      {body}
    </Link>
  ) : (
    <div data-section-label className={shape}>
      {body}
    </div>
  );
}

/**
 * The section pattern's panel (DESIGN.md "The section pattern"; foundations, 2026-11-16): a quiet
 * surface one step above the page, around a group of rows under one label, on every page. It
 * stands 8px from the screen with 16px corners and holds its rows 16px in, so their text stands
 * on the 24px column with every label's; a row's own hairline divides it from the next, and the
 * last row has none (app.css `.panel`).
 */
export function Panel({
  as: Tag = 'ul',
  className,
  style,
  children,
}: {
  as?: 'ul' | 'ol' | 'div';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Tag
      data-panel
      className={cn('panel fill-edge rounded-fill bg-panel px-4', className)}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** A quiet text button, as "Edit order" (DESIGN.md "Reordering"). */
export function QuietButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-12 items-center rounded-xl px-2 text-sub whitespace-nowrap text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

/** Re-render on a timer, for screens whose content depends on the clock (which Event is Now). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
