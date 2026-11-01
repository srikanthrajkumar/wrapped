// Settings, as far as this phase goes: the theme (DESIGN.md "Colors": dark by default, light
// offered here) and the Maintainer's link. The full layout is designed with T053 and T082.

import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { setTheme, useTheme, type Theme } from '../theme';

export function SettingsScreen() {
  const theme = useTheme();
  return (
    <>
      <h1 className="pt-4 pb-4 text-title font-semibold">Settings</h1>
      <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-1">
        <span className="text-sub text-muted-foreground">Theme</span>
        <div className="flex gap-2">
          {(['dark', 'light'] as Theme[]).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={theme === choice}
              onClick={() => setTheme(choice)}
              className={cn(
                'min-h-12 flex-1 rounded-2xl border border-border px-4',
                theme === choice && 'border-foreground bg-secondary font-semibold',
              )}
            >
              {choice === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
      </div>
      <p className="pt-8">
        <Link href="/admin" className="inline-flex min-h-12 items-center text-muted-foreground">
          Maintainer
        </Link>
      </p>
    </>
  );
}
