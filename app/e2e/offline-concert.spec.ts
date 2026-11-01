// Required test (constitution IV, "offline capture surviving a forced close"; T034, SC-001).
// In airplane mode, a full Concert is logged in the installed app's page: 5 Appearances with
// Colours, 8 Items, one Laya vinyasam and notes. The browser is then closed and relaunched on
// the same profile, still offline, and every Detail must be there.
//
// The screens (T040 to T044) are still being designed, so the logging goes through the same
// store actions they will call, injected into the real page from e2e/harness; the IndexedDB,
// service worker and offline state are the real browser's. Once the screens exist, this test
// should drive them instead.

import { chromium, devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { harnessScript } from './harness/build';
import type { Harness } from './harness/entry';

// The phone's screen and touch, for a persistent profile, which takes no browser type.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
const phone = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
const catalogV1: unknown = JSON.parse(
  readFileSync(new URL('../tests/fixtures/catalog-v1.json', import.meta.url), 'utf8'),
);

/** The whole Concert as stored: what must come back after the relaunch. */
async function readConcert(page: Page, eventId: string) {
  return page.evaluate(async (eventId) => {
    const { db, queries } = (globalThis as unknown as { harness: Harness }).harness;
    const event = await queries.getEvent(eventId);
    const sabha = event?.sabhaId ? await queries.resolveSabha(event.sabhaId) : undefined;
    return {
      event,
      sabha: sabha?.name,
      appearances: await queries.listAppearances(eventId),
      items: await queries.listItems(eventId),
      outbox: (await db.outbox.orderBy('seq').toArray()).map(({ opId, recordId, row }) => ({
        opId,
        recordId,
        row,
      })),
    };
  }, eventId);
}

async function openOffline(context: BrowserContext): Promise<Page> {
  await context.setOffline(true);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Season' })).toBeVisible();
  await page.addScriptTag({ content: await harnessScript() });
  return page;
}

test('a Concert logged offline survives closing the browser (SC-001)', async ({
  baseURL,
}, testInfo) => {
  const profile = testInfo.outputPath('profile');
  const launch = () => chromium.launchPersistentContext(profile, { ...phone, baseURL });

  // First visit, online: the app installs and caches itself for offline use.
  let context = await launch();
  const first = context.pages()[0] ?? (await context.newPage());
  await first.goto('/');
  await first.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(
      () =>
        first.evaluate(
          () =>
            new Promise((resolve) => {
              const open = indexedDB.open('carnatic-wrapped');
              open.onsuccess = () => {
                const db = open.result;
                const get = db.transaction('meta').objectStore('meta').get('readyForOffline');
                get.onsuccess = () => {
                  db.close();
                  resolve(get.result !== undefined);
                };
              };
            }),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);

  // In the hall, with no signal.
  let page = await openOffline(context);
  const eventId = await page.evaluate(async (snapshot) => {
    const { events, items, people, model, decodeSnapshot } = (
      globalThis as unknown as { harness: Harness }
    ).harness;
    const { catalogValue, unknownValue, unresolvedValue, notApplicableValue } = model;
    const catalog = decodeSnapshot(snapshot);
    const song = (id: string) => catalog.songByKritiId.get(id)!;

    const sabha = await people.createSabha('Narada Gana Sabha');
    const event = await events.createEvent({
      kind: 'concert',
      startTime: '18:45',
      sabhaId: sabha.id,
    });
    await events.editEvent(event.id, { note: 'Packed hall; thani was the highlight.' });

    const stage = [
      ['Ranjani', 'vocal', 'red', 'white'],
      ['Gayatri', 'vocal', 'blue', null],
      ['Embar Kannan', 'violin', 'yellow', null],
      ['Sai Giridhar', 'mridangam', 'unknown', null],
      ['Anirudh Athreya', 'khanjira', 'green', 'beige'],
    ] as const;
    for (const [name, role, colourPrimary, colourSecondary] of stage) {
      const artist = await people.createArtist(name);
      await people.addAppearance(event.id, artist.id, { role, colourPrimary, colourSecondary });
    }

    const options = { catalog };
    const add = () => items.addItem(event.id);
    // 1. A varnam, picked from the catalog as it is.
    await items.pickComposition((await add()).id, song('c0017'));
    // 2. Vatapi, with its tala marked not sure.
    const vatapi = await items.pickComposition((await add()).id, song('c0002'));
    await items.setDetail(vatapi.id, 'tala', { ...vatapi.tala, guess: true }, options);
    // 3. Nagumomu, heard in Sankarabharanam: an Override.
    const nagumomu = await items.pickComposition((await add()).id, song('c0001'));
    await items.setRagas(
      nagumomu.id,
      [catalogValue('Sankarabharanam', 'Sankarabharanam')],
      options,
    );
    // 4. A ragamalika.
    await items.pickComposition((await add()).id, song('c0016'));
    // 5. An RTP in two ragas, khanda nadai, pallavi by an unknown hand.
    const rtp = await items.addRtp(event.id);
    await items.setRagas(
      rtp.id,
      [catalogValue('Todi', 'Todi'), catalogValue('Kalyani', 'Kalyani')],
      options,
    );
    await items.setDetail(rtp.id, 'tala', catalogValue('adi', 'Adi'), options);
    await items.setDetail(rtp.id, 'nadai', catalogValue('khanda', 'khanda'), options);
    await items.setDetail(rtp.id, 'language', unresolvedValue('Sanskrit?'), options);
    // 6. Kamakshi, followed by the Laya vinyasam, with a note.
    const kamakshi = await items.pickComposition((await add()).id, song('c0004'));
    await items.setLayaVinyasam(kamakshi.id, {
      nadai: catalogValue('tisra', 'tisra'),
      note: 'Tisra korvai to close',
    });
    await items.editItem(kamakshi.id, { note: 'Slow, deliberate niraval' });
    // 7. A song the catalog doesn't know, typed in.
    const typed = await add();
    await items.editItem(typed.id, { title: 'Bhaja Govindam' });
    await items.setDetail(typed.id, 'composer', unresolvedValue('Adi Sankara'), options);
    await items.setRagas(typed.id, [unknownValue()], options);
    // 8. A tillana, with no subject.
    const tillana = await items.pickComposition((await add()).id, song('c0015'));
    await items.setDetail(tillana.id, 'subject', notApplicableValue(), options);
    // The last two swap places, then one more is added and deleted again.
    await items.moveItem(tillana.id, 6);
    await items.removeItem((await add()).id);
    return event.id;
  }, catalogV1);

  const logged = await readConcert(page, eventId);
  expect(logged.event?.note).toBe('Packed hall; thani was the highlight.');
  expect(logged.appearances).toHaveLength(5);
  expect(logged.items).toHaveLength(8);
  expect(logged.items.filter((item) => item.layaVinyasam)).toHaveLength(1);

  // Force-close: the whole browser goes, with nothing synced.
  await context.close();

  context = await launch();
  page = await openOffline(context);
  const reopened = await readConcert(page, eventId);
  await context.close();

  expect(reopened).toEqual(logged);
  expect(reopened.sabha).toBe('Narada Gana Sabha');
  expect(reopened.appearances.map((a) => [a.artist?.name, a.role, a.colourPrimary])).toEqual([
    ['Ranjani', 'vocal', 'red'],
    ['Gayatri', 'vocal', 'blue'],
    ['Embar Kannan', 'violin', 'yellow'],
    ['Sai Giridhar', 'mridangam', 'unknown'],
    ['Anirudh Athreya', 'khanjira', 'green'],
  ]);
  expect(reopened.items.map((item) => item.title)).toEqual([
    'Sarasijanabha',
    'Vatapi Ganapatim',
    'Nagumomu',
    'Bhavayami Raghuramam',
    'RTP',
    'Kamakshi',
    'Thillana',
    'Bhaja Govindam',
  ]);
  const [, vatapi, nagumomu, , rtp, kamakshi, tillana, typed] = reopened.items;
  expect(vatapi?.tala.guess).toBe(true);
  expect(nagumomu?.ragas[0]).toMatchObject({ state: 'override', key: 'Sankarabharanam' });
  expect(rtp).toMatchObject({
    compositionKey: null,
    nadai: { key: 'khanda' },
    composer: { state: 'na' },
    language: { state: 'unresolved', text: 'Sanskrit?' },
  });
  expect(rtp?.ragas.map((raga) => raga.key)).toEqual(['Todi', 'Kalyani']);
  expect(kamakshi?.layaVinyasam).toEqual({
    nadai: { state: 'catalog', key: 'tisra', text: 'tisra', guess: false },
    note: 'Tisra korvai to close',
  });
  expect(tillana?.subject.state).toBe('na');
  expect(typed).toMatchObject({ compositionKey: null, composer: { text: 'Adi Sankara' } });
  // Every record is still queued for the server.
  expect(new Set(reopened.outbox.map((entry) => entry.recordId)).size).toBe(1 + 1 + 5 * 2 + 9);
});
