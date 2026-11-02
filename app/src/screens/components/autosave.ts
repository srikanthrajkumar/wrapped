// Free text that saves as the rasika types (the Event note, the Laya vinyasam note): saved once
// typing pauses, when the field loses focus, when the page is hidden (iOS does not reliably blur
// a field on lock, app switch or kill, but does fire pagehide and visibilitychange) and when the
// field goes away. A newer stored value replaces the text only while nothing typed is pending.

import { useCallback, useEffect, useRef, useState } from 'react';

const PAUSE_MS = 800;

export function useAutosave(stored: string, save: (text: string) => void) {
  const [text, setText] = useState(stored);
  const [dirty, setDirty] = useState(false);
  const [seen, setSeen] = useState(stored);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ stored, save });
  useEffect(() => {
    latest.current = { stored, save };
  });

  // Resync from the store (another tab, an Undo) while nothing typed is waiting.
  if (stored !== seen) {
    setSeen(stored);
    if (!dirty) setText(stored);
  }

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    pending.current = null;
    setDirty(false);
    if (value !== null && value !== latest.current.stored) latest.current.save(value);
  }, []);

  useEffect(() => {
    const onHidden = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const change = (value: string) => {
    setText(value);
    setDirty(true);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, PAUSE_MS);
  };

  return { text, change, flush };
}
