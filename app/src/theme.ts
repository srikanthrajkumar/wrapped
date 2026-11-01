// Dark is the default theme; light is offered in Settings (DESIGN.md "Colors"). The choice is a
// per-phone convenience kept in localStorage, so index.html can apply it before anything draws
// and no white flashes on launch.

import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'wrapped.theme';
const BACKGROUND: Record<Theme, string> = { dark: '#090b0c', light: '#ffffff' };
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.background = BACKGROUND[theme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BACKGROUND[theme]);
  listeners.forEach((listener) => listener());
}

export function useTheme(): Theme {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, getTheme);
}
