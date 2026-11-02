// assets/js/core/queue.js
import { getSupabase } from './db.js';
import { cache } from './cache.js';

const QUEUE_KEY = 'pending_writes';

const writeQueue = {
  _get() {
    return cache.get(QUEUE_KEY) || [];
  },

  _save(items) {
    cache.set(QUEUE_KEY, items, 7 * 24 * 60 * 60 * 1000);
  },

  add(item) {
    item._id = Date.now() + '_' + Math.random();
    item._retries = 0;
    item._created = Date.now();
    const items = this._get();
    items.push(item);
    this._save(items);
    this.flush().catch(() => {});
    return item._id;
  },

  remove(id) {
    const items = this._get().filter(x => x._id !== id);
    this._save(items);
  },

  size() {
    return this._get().length;
  },

  async flush() {
    if (!navigator.onLine) return { processed: 0, failed: 0 };

    const client = getSupabase();
    let processed = 0, failed = 0;
    const items = this._get();

    for (const item of items) {
      try {
        let q;
        if (item.op === 'insert') {
          q = client.from(item.table).insert(item.data);
        } else if (item.op === 'update') {
          q = client.from(item.table).update(item.data).eq('id', item.id);
        } else if (item.op === 'upsert') {
          q = client.from(item.table).upsert(item.data, item.opts || {});
        } else if (item.op === 'delete') {
          q = client.from(item.table).delete().eq('id', item.id);
        } else {
          throw new Error('Unknown op: ' + item.op);
        }

        const { error } = await q;
        if (error) throw error;

        this.remove(item._id);
        processed++;
      } catch (err) {
        item._retries = (item._retries || 0) + 1;
        if (item._retries >= 3) {
          console.error('[queue] dropping after 3 retries:', item, err);
          this.remove(item._id);
          failed++;
        } else {
          const items2 = this._get();
          const idx = items2.findIndex(x => x._id === item._id);
          if (idx >= 0) items2[idx] = item;
          this._save(items2);
        }
      }
    }

    return { processed, failed };
  },

  async flushAll() {
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const res = await this.flush();
      total += res.processed;
      if (this.size() === 0) break;
    }
    return total;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[queue] online, flushing...');
    writeQueue.flush().catch(() => {});
  });
  window.tbQueue = writeQueue;
}

export { writeQueue };