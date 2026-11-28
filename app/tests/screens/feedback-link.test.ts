// Settings' "Send feedback" link (DESIGN.md "Settings", 2026-11-28): a mailto: to the inbox whose
// body is blank lines and a footer of the version and the kind of phone and browser, encoded so
// every mail app reads it whole, and holding nothing that names the rasika or their phone.

import { describe, expect, it } from 'vitest';
import { describeDevice, feedbackMailto } from '../../src/screens/feedback-link';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const ANDROID_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const MAC_FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0';

const device = (userAgent: string, installed = false, touchPoints = 0) =>
  describeDevice({ userAgent, installed, touchPoints });

/** The parts of a mailto: as a mail app reads them. */
function read(href: string) {
  const url = new URL(href);
  return {
    protocol: url.protocol,
    to: url.pathname,
    subject: url.searchParams.get('subject'),
    body: url.searchParams.get('body'),
    raw: url.search,
  };
}

describe('describeDevice', () => {
  it('names the kind of phone, the browser and how it was opened, with no versions', () => {
    expect(device(IPHONE_SAFARI, true, 5)).toBe('iPhone · Safari · installed');
    expect(device(IPAD_SAFARI, false, 5)).toBe('iPad · Safari · browser tab');
    expect(device(IPHONE_CHROME)).toBe('iPhone · Chrome · browser tab');
    expect(device(ANDROID_CHROME, true, 5)).toBe('Android phone · Chrome · installed');
    expect(device(ANDROID_SAMSUNG)).toBe('Android phone · Samsung Internet · browser tab');
    expect(device(WINDOWS_EDGE)).toBe('Windows · Edge · browser tab');
    expect(device(MAC_FIREFOX)).toBe('Mac · Firefox · browser tab');
    expect(device('')).toBe('Unknown device · Unknown browser · browser tab');
  });
});

describe('feedbackMailto', () => {
  const href = feedbackMailto('0.4.0', 'iPhone · Safari · installed');

  it('writes to the inbox with the subject', () => {
    const mail = read(href);
    expect(mail.protocol).toBe('mailto:');
    expect(mail.to).toBe('info@carnatic.live');
    expect(mail.subject).toBe('carnatic.live feedback');
  });

  it('starts with blank lines to write in, then the footer with the version and device', () => {
    expect(read(href).body).toBe(
      '\r\n\r\n\r\n—\r\ncarnatic.live 0.4.0\r\niPhone · Safari · installed',
    );
  });

  it('percent-encodes every space, break and non-ASCII mark, never "+"', () => {
    const { raw } = read(href);
    expect(raw).not.toMatch(/[ +\r\n—·]/);
    expect(raw).toContain('subject=carnatic.live%20feedback');
    expect(raw).toContain('%0D%0A%0D%0A%0D%0A%E2%80%94%0D%0A');
    // One "?" and one "&": nothing in the values breaks the link apart.
    expect(href.split('?')).toHaveLength(2);
    expect(raw.split('&')).toHaveLength(2);
  });

  it('keeps a value with "&", "=" or "#" inside its own field', () => {
    const mail = read(feedbackMailto('1.0.0-rc&x=1#y', 'a?b'));
    expect(mail.body).toContain('carnatic.live 1.0.0-rc&x=1#y\r\na?b');
    expect(mail.subject).toBe('carnatic.live feedback');
  });

  it('holds nothing but the inbox, subject, version and device', () => {
    const mail = read(href);
    expect(mail.raw.split('&').map((part) => part.split('=')[0])).toEqual(['?subject', 'body']);
    const words = mail.body!.replace(/\s+/g, ' ').trim();
    expect(words).toBe('— carnatic.live 0.4.0 iPhone · Safari · installed');
    // No address but the inbox's, no id-like run of digits or hex.
    expect(href.match(/@/g)).toHaveLength(1);
    expect(decodeURIComponent(href)).not.toMatch(/[0-9a-f]{8,}|\d{5,}/i);
  });
});
