import type { ReactNode } from 'react';
import { Link } from 'wouter';

// Stands in for each screen until the design system (T030) and the screen tasks arrive.
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
      {back && <Link href={back}>Back</Link>}
      <h1>{title}</h1>
      {children}
    </>
  );
}
