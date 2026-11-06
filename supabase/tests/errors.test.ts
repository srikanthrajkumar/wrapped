// The custom-error check (ADR 0001, "How the contract's responses map"): a raised 409 and 426
// reach supabase-js with their status and PostgREST's body, `details` as one plain string,
// and the pre-request hook reads X-App-Version. A PostgREST upgrade that changes any of this
// fails here before the phone depends on it.

import { beforeAll, describe, expect, it } from 'vitest';
import type { NotWriterResponse, UpdateRequiredResponse } from '../../app/src/model/sync-payloads';
import { SYNC_FUNCTIONS } from '../../app/src/model/sync-payloads';
import {
  APP_VERSION,
  apiClient,
  call,
  db,
  me,
  newEvent,
  op,
  push,
  signUp,
  signUpWriter,
  type Rasika,
} from './server';

let minimum: string;

beforeAll(async () => {
  const [config] = await db<{ min_app_version: string }[]>`
    select min_app_version from private.server_config`;
  minimum = config!.min_app_version;
});

describe('409 not_writer', () => {
  it('comes back as 409 with the writer device id as details', async () => {
    const rasika = await signUpWriter();
    const reply = await push(rasika, [op('events', newEvent())], crypto.randomUUID());

    expect(reply.status).toBe(409);
    const expected: NotWriterResponse = {
      code: 'not_writer',
      message: expect.any(String) as string,
      details: rasika.deviceId,
      hint: null,
    };
    expect(reply.error).toEqual(expected);
  });
});

describe('426 update_required', () => {
  const below = (version: string) => {
    const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
    if (patch > 0) return `${major}.${minor}.${patch - 1}`;
    if (minor > 0) return `${major}.${minor - 1}.99`;
    return `${major - 1}.99.99`;
  };

  async function signedInAt(version: string | null): Promise<Rasika> {
    return signUp('version', version);
  }

  it('comes back as 426 with the minimum version as details when the app is too old', async () => {
    const rasika = await signedInAt(below(minimum));
    const reply = await me(rasika);

    expect(reply.status).toBe(426);
    const expected: UpdateRequiredResponse = {
      code: 'update_required',
      message: expect.any(String) as string,
      details: minimum,
      hint: null,
    };
    expect(reply.error).toEqual(expected);
  });

  it('comes back as 426 when the version header is missing or not a version', async () => {
    for (const version of [null, 'not-a-version', '']) {
      const rasika = await signedInAt(version);
      const reply = await me(rasika);
      expect(reply.status, String(version)).toBe(426);
      expect(reply.error?.code).toBe('update_required');
    }
  });

  it('lets the minimum version and the app version through, so the hook reads the header', async () => {
    for (const version of [minimum, APP_VERSION, `${minimum}-beta.1`]) {
      const rasika = await signedInAt(version);
      const reply = await me(rasika);
      expect(reply.status, version).toBe(200);
    }
  });

  it('applies to every function, not only push', async () => {
    const rasika = await signedInAt(below(minimum));
    for (const name of Object.values(SYNC_FUNCTIONS)) {
      const reply = await call(rasika.client, name, {});
      expect(reply.status, name).toBe(426);
    }
  });
});

describe('401', () => {
  it('is what a caller without a session gets, from the API itself', async () => {
    const anonymous = apiClient();
    for (const name of Object.values(SYNC_FUNCTIONS)) {
      const reply = await call(anonymous, name, {});
      expect(reply.status, name).toBe(401);
    }
  });
});
