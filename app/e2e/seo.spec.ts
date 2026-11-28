import { expect, test } from '@playwright/test';

// What search engines and link previews read (WhatsApp first): the page as served, before any
// script runs, and the files for crawlers, which must open as themselves, never as the app.

const DESCRIPTION =
  'Log the concerts you hear in the Chennai December season, with their ragas and songs, even offline.';

/** The served HTML's tags of one kind, as attribute maps. */
function tags(html: string, name: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, attributes]) =>
    Object.fromEntries(
      [...attributes!.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key!, value!]),
    ),
  );
}

test('the served page carries the description, canonical, share preview and app data', async ({
  request,
}) => {
  const response = await request.get('/');
  expect(response.headers()['content-type']).toContain('text/html');
  const html = await response.text();
  const metas = tags(html, 'meta');
  const content = (key: string) =>
    metas.find((meta) => meta.name === key || meta.property === key)?.content;

  expect(content('description')).toBe(DESCRIPTION);
  expect(tags(html, 'link').find((link) => link.rel === 'canonical')?.href).toBe(
    'https://carnatic.live/',
  );
  expect(content('og:type')).toBe('website');
  expect(content('og:site_name')).toBe('carnatic.live');
  expect(content('og:url')).toBe('https://carnatic.live/');
  expect(content('og:title')).toMatch(/^carnatic\.live/);
  expect(content('og:description')).toBe(DESCRIPTION);
  expect(content('og:image')).toBe('https://carnatic.live/og.png');
  expect(content('og:image:width')).toBe('1200');
  expect(content('og:image:height')).toBe('630');
  expect(content('twitter:card')).toBe('summary_large_image');

  const jsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(JSON.parse(jsonLd!)).toMatchObject({
    '@type': 'WebApplication',
    name: 'carnatic.live',
    url: 'https://carnatic.live/',
    operatingSystem: 'Any',
    offers: { price: '0' },
  });

  // Words for crawlers that never run the page, inside #root so React replaces them.
  const crawlerText = /<div id="root">(?:\s|<!--[\s\S]*?-->)*<noscript>([\s\S]*?)<\/noscript>/.exec(
    html,
  )?.[1];
  expect(crawlerText).toContain('December season');

  // The public name only: never the project's working name in what the public reads.
  const publicWords = [...metas.map((meta) => meta.content ?? ''), jsonLd, crawlerText].join(' ');
  expect(publicWords).not.toMatch(/wrapped/i);
});

test('the noscript words never draw while the app runs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'carnatic.live' })).toBeVisible();
  await expect(page.getByText('needs JavaScript')).toHaveCount(0);
});

test('robots.txt, the sitemap and the share image are served as themselves', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  const robotsText = await robots.text();
  expect(robotsText).toMatch(/^User-agent: \*$/m);
  expect(robotsText).toMatch(/^Allow: \/$/m);
  expect(robotsText).toContain('Sitemap: https://carnatic.live/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  expect(await sitemap.text()).toContain('<loc>https://carnatic.live/</loc>');

  const image = await request.get('/og.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
});

test('once the service worker runs, the crawler files still open as themselves', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  for (const path of ['/robots.txt', '/sitemap.xml']) {
    const response = await page.goto(path);
    expect(response?.headers()['content-type'], path).not.toContain('text/html');
    expect(await page.locator('#root').count(), path).toBe(0);
  }
  // Never in the phone's download (globIgnores in vite.config.ts).
  const precached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(precached.length).toBeGreaterThan(0);
  expect(precached.filter((url) => /\/(robots\.txt|sitemap\.xml|og\.png)/.test(url))).toEqual([]);
});
