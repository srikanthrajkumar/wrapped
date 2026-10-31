// The one source of record and outbox ids (eng review D2). Ids are made on the phone, so a
// record has its id before any network call (constitution II).
export function newId(): string {
  return crypto.randomUUID();
}
