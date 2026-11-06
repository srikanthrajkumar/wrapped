// The account operations (T075): me, consent and the device claim.

import { describe, expect, it } from 'vitest';
import type { MeResponse } from '../../app/src/model/sync-payloads';
import { claim, consent, db, me, signUp } from './server';

describe('me', () => {
  it('starts with nothing answered and no writer, from the first sign-in', async () => {
    const rasika = await signUp('fresh');
    const reply = await me(rasika);
    const [config] = await db<{ deletion_contact: string | null }[]>`
      select deletion_contact from private.server_config`;
    const expected: MeResponse = {
      id: rasika.rasikaId,
      name: 'Test fresh',
      shareAdditions: null,
      seasonReports: null,
      writerDeviceId: null,
      deletionContact: config!.deletion_contact,
    };
    expect(reply.data).toEqual(expected);
  });
});

describe('consent (FR-042, FR-049)', () => {
  it('appends one consent event per change and none for an unchanged value', async () => {
    const rasika = await signUp('consent');

    expect((await consent(rasika, { shareAdditions: false })).data).toEqual({
      shareAdditions: false,
      seasonReports: null,
    });
    expect((await consent(rasika, { shareAdditions: false, seasonReports: true })).data).toEqual({
      shareAdditions: false,
      seasonReports: true,
    });
    await consent(rasika, { shareAdditions: true });
    await consent(rasika, {});

    const events = await db<{ purpose: string; value: boolean }[]>`
      select purpose, value from private.consent_event where rasika_id = ${rasika.rasikaId} order by id`;
    expect(events.map((e) => [e.purpose, e.value])).toEqual([
      ['share_additions', false],
      ['season_reports', true],
      ['share_additions', true],
    ]);
    expect((await me(rasika)).data).toMatchObject({ shareAdditions: true, seasonReports: true });
  });

  it('refuses a value that is not true or false', async () => {
    const rasika = await signUp('consent');
    const reply = await consent(rasika, { seasonReports: 'yes' as unknown as boolean });
    expect(reply.status).toBe(400);
  });
});

describe('claim (FR-022)', () => {
  it('makes the device the writer and records it once', async () => {
    const rasika = await signUp('claim');
    expect((await claim(rasika, { deviceId: rasika.deviceId, label: 'Phone' })).data).toEqual({
      writerDeviceId: rasika.deviceId,
    });
    await claim(rasika, { deviceId: rasika.deviceId, label: 'Phone, renamed' });

    expect((await me(rasika)).data?.writerDeviceId).toBe(rasika.deviceId);
    const devices = await db<{ label: string }[]>`
      select label from private.device where rasika_id = ${rasika.rasikaId}`;
    expect(devices).toEqual([{ label: 'Phone, renamed' }]);
  });
});
