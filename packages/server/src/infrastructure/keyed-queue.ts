/** Each instance owns an independent queue scope. Actions must not re-enter the same key. */
export class KeyedQueue {
  private readonly pending = new Map<string, Promise<void>>();

  async run<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.pending.set(key, current);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.pending.get(key) === current) this.pending.delete(key);
    }
  }
}
