import { MESSAGES } from './messages';

// Where an Event's back goes: the page it was opened from, Season or the days gone (the
// Maintainer, 2026-11-09). An Event opened afresh, or after a reload, goes back to Season; its
// Items, opened and left, never change it.

export type Back = { href: string; label: string };

const SEASON: Back = { href: '/', label: 'Season' };
const EARLIER: Back = { href: '/earlier', label: MESSAGES.earlier };

let back = SEASON;

/** Noted as each screen opens, with the path shown before it (null on a launch). */
export function noteOpened(path: string, from: string | null) {
  if (!path.startsWith('/event/') || from?.startsWith('/event/')) return;
  back = from === '/earlier' ? EARLIER : SEASON;
}

export const eventBack = (): Back => back;
