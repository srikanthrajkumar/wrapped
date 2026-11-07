// Free text that saves as the rasika types (the Event note, the Laya vinyasam note): saved once
// typing pauses, when the field loses focus, when the page is hidden (iOS does not reliably blur
// a field on lock, app switch or kill, but does fire pagehide and visibilitychange) and when the
// field goes away. A newer stored value replaces the text only while nothing typed is pending.
// Until it is written, typed text is handed to `onPending`, which copies it to save feedback's
// storage at once, so a kill inside the pause loses nothing (null: nothing to write after all;
// when `onPending` answers false, a write for the field is still running and may land after, so
// the text is written anyway). A field that stores its text tidied (a title, trimmed) says so
// with `same`: stored text that matches what is typed never replaces it, so a space typed before
// a pause stays, and the next word doesn't join on (PR #23 review).

import { useCallback, useEffect, useRef, useState } from 'react';

const PAUSE_MS = 800;

const exactly = (a: string, b: string) => a === b;

export function useAutosave(
  stored: string,
  save: (text: string) => void,
  onPending?: (text: string | null) => boolean | void,
  same: (typed: string, stored: string) => boolean = exactly,
) {
  const [text, setText] = useState(stored);
  const [dirty, setDirty] = useState(false);
  const [seen, setSeen] = useState(stored);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ stored, save, onPending, same });
  useEffect(() => {
    latest.current = { stored, save, onPending, same };
  });

  // Resync from the store (another tab, an Undo) while nothing typed is waiting.
  if (stored !== seen) {
    setSeen(stored);
    if (!dirty && !same(text, stored)) setText(stored);
  }

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    pending.current = null;
    setDirty(false);
    if (value === null) return;
    if (!latest.current.same(value, latest.current.stored)) latest.current.save(value);
    else if (latest.current.onPending?.(null) === false) latest.current.save(value);
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
    latest.current.onPending?.(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, PAUSE_MS);
  };

  return { text, change, flush };
}
