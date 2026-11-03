import type { ReactNode } from 'react';
import { SeasonFeedback } from './components/feedback';
import { InstallRow } from './components/InstallRow';
import { TopBar } from './components/layout';

// Stands in for each screen not built yet (Wrapped, Tidy, the Maintainer's review).
export function Placeholder({
  title,
  back,
  children,
}: {
  title: string;
  /** Where the back link goes, for a pushed screen. */
  back?: string;
  children?: ReactNode;
}) {
  return (
    <>
      {back && <TopBar back={{ href: back, label: back === '/' ? 'Season' : 'Settings' }} />}
      <h1 className="pt-4 text-title font-semibold">{title}</h1>
      {/* A tab's own screen has no top bar: its install row and season-wide line go under its
          title. */}
      {!back && <InstallRow />}
      {!back && <SeasonFeedback />}
      {children}
    </>
  );
}
