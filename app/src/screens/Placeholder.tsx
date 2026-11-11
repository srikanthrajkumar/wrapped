import type { ReactNode } from 'react';
import { TopBar } from './components/layout';

// Stands in for each screen not built yet (Tidy, the Maintainer's review), as a pushed page.
export function Placeholder({
  title,
  back,
  children,
}: {
  title: string;
  /** Where the back link goes. */
  back: string;
  children?: ReactNode;
}) {
  return (
    <>
      <TopBar back={{ href: back, label: back === '/' ? 'Season' : 'Settings' }} />
      <h1 className="pt-2 pb-2 text-heading font-bold">{title}</h1>
      {children}
    </>
  );
}
