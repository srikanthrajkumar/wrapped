// Writes that must wait for another to settle: a Detail set while a repick is being written
// goes after it, since the repick clears the Details the new pick doesn't keep. The write is
// tracked, and journalled, at once; only the store write waits.

export class WriteGate {
  private pending: Promise<unknown> | null = null;

  /** Writes made with `after` wait for `write` to settle, success or failure. */
  hold(write: Promise<unknown>): void {
    const held = write.catch(() => undefined);
    this.pending = held;
    void held.then(() => {
      if (this.pending === held) this.pending = null;
    });
  }

  /** `write`, run once the held write has settled (at once when there is none). */
  after<T>(write: () => Promise<T>): () => Promise<T> {
    return async () => {
      while (this.pending) await this.pending;
      return write();
    };
  }
}
