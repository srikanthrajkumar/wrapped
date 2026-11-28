// Settings' "Send feedback" row (DESIGN.md "Settings", 2026-11-28): a plain mailto: link to the
// project's inbox, so it needs no server and works offline (the mail app sends it later). The
// mail holds only blank lines to write in and a footer with the app's version and plain words
// for the phone and browser: never an account, an address, a device id or anything logged.

import { MESSAGES } from './messages';

/** What the browser tells us, read where the row is drawn. */
export interface DeviceFacts {
  userAgent: string;
  /** `navigator.maxTouchPoints`: an iPad's Safari says Macintosh, but with touch. */
  touchPoints: number;
  /** Opened from the home screen, not a browser tab. */
  installed: boolean;
}

function deviceName({ userAgent: ua, touchPoints }: DeviceFacts): string {
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown device';
}

function browserName(ua: string): string {
  // Order matters: Edge, Opera and Samsung's say Chrome too, and every browser says Safari.
  if (/EdgA?\/|EdgiOS\//.test(ua)) return 'Edge';
  if (/OPR\/|OPiOS\//.test(ua)) return 'Opera';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Unknown browser';
}

/** "iPhone · Safari · installed": the kind of phone and browser, no versions or ids. */
export function describeDevice(facts: DeviceFacts): string {
  return [
    deviceName(facts),
    browserName(facts.userAgent),
    facts.installed ? MESSAGES.feedback.installed : MESSAGES.feedback.inBrowser,
  ].join(' · ');
}

/** The row's href: the inbox, the subject, and a body of blank lines over the footer. */
export function feedbackMailto(version: string, device: string): string {
  const body = ['', '', '', ...MESSAGES.feedback.footer(version, device)].join('\r\n');
  return (
    `mailto:${MESSAGES.feedback.address}` +
    `?subject=${encodeURIComponent(MESSAGES.feedback.subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

/** This browser's facts, read when the row is drawn. */
export function currentDeviceFacts(): DeviceFacts {
  return {
    userAgent: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints ?? 0,
    installed:
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as { standalone?: boolean }).standalone === true,
  };
}
