/* Shared by the service worker, history page and regression tests. */
globalThis.HistoryModel = {
  limit: 1500,
  word(text) {
    const cleaned = text.trim().replace(/^[“”"'‘’.,!?;:()[\]{}]+|[“”"'‘’.,!?;:()[\]{}]+$/g, '');
    return /^[a-z]+(?:['’-][a-z]+)*$/i.test(cleaned) ? cleaned.toLowerCase().replace(/’/g, "'") : null;
  },
  ranking(records) {
    const words = new Map();
    for (const record of records) {
      const word = this.word(record.original);
      if (!word) continue;
      const entry = words.get(word) || {word, count: 0, translation: record.translation, last: record.time};
      entry.count++;
      if (record.time >= entry.last) { entry.last = record.time; entry.translation = record.translation; }
      words.set(word, entry);
    }
    return [...words.values()].sort((a, b) => b.count - a.count || b.last - a.last || a.word.localeCompare(b.word));
  },
  source(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.origin + url.pathname : '';
    } catch { return ''; }
  }
};
