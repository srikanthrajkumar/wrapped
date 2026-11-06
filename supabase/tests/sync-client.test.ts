// Required tests (constitution IV, "sync without duplicates"; T069): the phone's sync client
// against the real server functions on the local stack. These are the scenarios that need the
// server's own rules: re-claiming after a 409 (eng review D6), another device's edit (D11), a
// lost reply, and a pull racing an edit (D4). The phone's store runs on an in-memory IndexedDB.

import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Event, PushRequest, PushResponse } from '../../app/src/model';
import { keepMine, listAttention } from '../../app/src/store/attention';
import { WrappedDB } from '../../app/src/store/db';
import { save } from '../../app/src/store/mutate';
import { countUnsynced } from '../../app/src/store/outbox';
import { DEVICE_ID_KEY, pushBatch, syncOnce } from '../../app/src/store/sync';
import { rpcSyncApi, SyncError, type RpcClient, type SyncApi } from '../../app/src/store/sync-api';
import {
  claim,
  db as server,
  newEvent,
  newItem,
  pullAll,
  push,
  signUpWriter,
  type Rasika,
} from './server';

const open: WrappedDB[] = [];
afterEach(async () => {
  for (const phone of open.splice(0)) await phone.delete();
});

/** A phone's store for `rasika`, as device `deviceId`. */
async function phoneStore(deviceId: string): Promise<WrappedDB> {
  const store = new WrappedDB(`sync-client-${randomUUID()}`);
  open.push(store);
  await store.meta.put({ key: DEVICE_ID_KEY, value: deviceId });
  return store;
}

function apiFor(rasika: Rasika): SyncApi {
  return rpcSyncApi(rasika.client as unknown as RpcClient);
}

/** The rasika's events as the server stores them, by id. */
async function serverEvents(rasika: Rasika) {
  const rows = await server<{ id: string; seq: string; data: Event }[]>`
    select id, seq, data from private.events where rasika_id = ${rasika.rasikaId}`;
  return new Map(rows.map((row) => [row.id, row]));
}

describe('sync client against the server (required)', () => {
  it('logs offline, syncs, and stores each record once, even when the push is sent again', async () => {
    const rasika = await signUpWriter();
    const phone = await phoneStore(rasika.deviceId);
    const events = [newEvent(), newEvent(), newEvent()];
    for (const event of events) await save('events', event, { db: phone });
    await save('items', newItem(events[0]!.id, 1), { db: phone });
    let sent: PushRequest | null = null;
    const api = apiFor(rasika);
    const recording: SyncApi = {
      ...api,
      push: (request) => {
        sent = structuredClone(request);
        return api.push(request);
      },
    };

    await syncOnce(recording, { db: phone });
    // The same push again, as a retry would send it: acknowledged, not reapplied (FR-015).
    const again = await push(rasika, sent!.ops);
    expect(again.data!.acked).toHaveLength(4);

    const stored = await serverEvents(rasika);
    expect([...stored.keys()].sort()).toEqual(events.map((e) => e.id).sort());
    const items = await server<{ id: string }[]>`
      select id from private.items where rasika_id = ${rasika.rasikaId}`;
    expect(items).toHaveLength(1);
    expect(await countUnsynced(phone)).toBe(0);
  });

  it('after a 409, re-claiming pushes every queued op and the server ends with all of them (D6)', async () => {
    const rasika = await signUpWriter();
    const api = apiFor(rasika);
    const phone = await phoneStore(rasika.deviceId);
    await save('events', newEvent({ note: 'before the iPad' }), { db: phone });
    await syncOnce(api, { db: phone });

    const ipad = randomUUID();
    expect((await claim(rasika, { deviceId: ipad, label: 'iPad' })).error).toBeNull();
    const queued = [newEvent({ note: 'one' }), newEvent({ note: 'two' })];
    for (const event of queued) await save('events', event, { db: phone });

    const stopped = await syncOnce(api, { db: phone }).catch((error: unknown) => error);
    expect(stopped).toBeInstanceOf(SyncError);
    expect((stopped as SyncError).failure).toEqual({ kind: 'not_writer', writerDeviceId: ipad });
    expect(await phone.outbox.count()).toBe(2);

    await api.claim({ deviceId: rasika.deviceId, label: 'Phone' });
    const third = newEvent({ note: 'three' });
    await save('events', third, { db: phone });
    await syncOnce(api, { db: phone });

    const stored = await serverEvents(rasika);
    for (const event of [...queued, third]) {
      expect(stored.get(event.id)?.data.note).toBe(event.note);
    }
    expect(await countUnsynced(phone)).toBe(0);
  });

  it('an older queued edit is rejected `conflict`, the iPad’s edit stays, and "keep mine" then wins (D11)', async () => {
    const rasika = await signUpWriter();
    const api = apiFor(rasika);
    const phone = await phoneStore(rasika.deviceId);
    const event = newEvent({ note: 'first' });
    await save('events', event, { db: phone });
    await syncOnce(api, { db: phone });

    // The iPad takes writing, restores, and edits the Event.
    const ipadId = randomUUID();
    await api.claim({ deviceId: ipadId, label: 'iPad' });
    const ipad = await phoneStore(ipadId);
    await syncOnce(api, { db: ipad });
    const onIpad = (await ipad.events.get(event.id))!;
    await save('events', { ...onIpad, note: 'iPad' }, { db: ipad });
    await syncOnce(api, { db: ipad });

    // The phone, no longer the writer, edits the same Event offline, then takes writing back.
    await save('events', { ...event, note: 'phone' }, { db: phone });
    await api.claim({ deviceId: rasika.deviceId, label: 'Phone' });
    await syncOnce(api, { db: phone });

    expect((await serverEvents(rasika)).get(event.id)?.data.note).toBe('iPad');
    expect((await phone.events.get(event.id))?.note).toBe('phone');
    const [entry] = await listAttention(phone);
    expect(entry).toMatchObject({
      code: 'conflict',
      local: { note: 'phone' },
      server: { note: 'iPad' },
    });
    expect(await countUnsynced(phone)).toBe(1);

    await keepMine(entry!.opId, phone);
    await syncOnce(api, { db: phone });
    expect((await serverEvents(rasika)).get(event.id)?.data.note).toBe('phone');
    expect(await listAttention(phone)).toEqual([]);
    expect(await countUnsynced(phone)).toBe(0);
  });

  it('after a lost reply, the retry starts at the same head, is at least as long, and a later edit is acked', async () => {
    const rasika = await signUpWriter();
    const api = apiFor(rasika);
    const phone = await phoneStore(rasika.deviceId);
    const events = [newEvent({ note: 'a' }), newEvent({ note: 'b' })];
    for (const event of events) await save('events', event, { db: phone });

    const pushes: PushRequest[] = [];
    const answers: PushResponse[] = [];
    let loseReply = true;
    const lossy: SyncApi = {
      ...api,
      push: async (request) => {
        pushes.push(structuredClone(request));
        const answer = await api.push(request);
        answers.push(answer);
        if (loseReply) {
          loseReply = false;
          throw new SyncError({ kind: 'network', status: 0, message: 'reply lost' });
        }
        return answer;
      },
    };
    await expect(syncOnce(lossy, { db: phone })).rejects.toThrow(SyncError);
    expect(await phone.outbox.count()).toBe(2);

    // An edit of a record in the lost push, made before any ack arrived.
    await save('events', { ...events[0]!, note: 'a, edited' }, { db: phone });
    await syncOnce(lossy, { db: phone });

    const [lost, retry] = pushes;
    expect(retry!.ops.slice(0, lost!.ops.length)).toEqual(lost!.ops);
    expect(retry!.ops.length).toBeGreaterThanOrEqual(lost!.ops.length);
    expect(answers[1]!.rejected).toEqual([]);
    expect(answers[1]!.acked).toHaveLength(3);
    expect((await serverEvents(rasika)).get(events[0]!.id)?.data.note).toBe('a, edited');
    expect(await countUnsynced(phone)).toBe(0);
  });

  it('a row edited while a pull is in flight keeps the edit, and the edit reaches the server (D4)', async () => {
    const rasika = await signUpWriter();
    const api = apiFor(rasika);
    const phone = await phoneStore(rasika.deviceId);
    const event = newEvent({ note: 'first' });
    await save('events', event, { db: phone });
    // Pushed and acked; the pull that follows brings the same row back from the server.
    expect(await pushBatch(api, { db: phone })).toBe(1);

    const racing: SyncApi = {
      ...api,
      pull: async (request) => {
        const page = await api.pull(request);
        expect(page.changes.map((change) => change.row.id)).toContain(event.id);
        // The rasika edits while the page is on its way.
        await save('events', { ...event, note: 'edited in the hall' }, { db: phone });
        return page;
      },
    };
    await syncOnce(racing, { db: phone });
    expect((await phone.events.get(event.id))?.note).toBe('edited in the hall');

    await syncOnce(api, { db: phone });
    expect((await serverEvents(rasika)).get(event.id)?.data.note).toBe('edited in the hall');
    expect(await listAttention(phone)).toEqual([]);
    expect(await countUnsynced(phone)).toBe(0);
  });

  it('a restored record carries its pulled seq, so its next edit is acked, not `conflict`', async () => {
    const rasika = await signUpWriter();
    const api = apiFor(rasika);
    const phone = await phoneStore(rasika.deviceId);
    const event = newEvent({ note: 'before the wipe' });
    await save('events', event, { db: phone });
    await syncOnce(api, { db: phone });

    const wiped = await phoneStore(rasika.deviceId);
    await syncOnce(api, { db: wiped });
    const restored = (await wiped.events.get(event.id))!;
    expect(restored.note).toBe('before the wipe');
    await save('events', { ...restored, note: 'after' }, { db: wiped });
    await syncOnce(api, { db: wiped });

    expect(await listAttention(wiped)).toEqual([]);
    expect((await serverEvents(rasika)).get(event.id)?.data.note).toBe('after');
    const { changes } = await pullAll(rasika);
    expect(changes.filter((change) => change.row.id === event.id)).toHaveLength(1);
  });
});
