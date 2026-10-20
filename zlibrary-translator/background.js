const cache = new Map();
const pending = new Map();
importScripts('history-model.js');
let historyQueue = Promise.resolve();
function mutateHistory(change) {
  const job = historyQueue.then(async () => {
    const {history = []} = await chrome.storage.local.get('history');
    await chrome.storage.local.set({history: change(history)});
  });
  historyQueue = job.catch(() => {});
  return job;
}

chrome.runtime.onInstalled.addListener(async () => {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const updates = scripts.filter(script => script.id.startsWith('site-')).map(script => ({id: script.id, allFrames: true, matchOriginAsFallback: true, runAt: 'document_start'}));
  if (updates.length) await chrome.scripting.updateContentScripts(updates);
});

async function translate(text) {
  if (cache.has(text)) return cache.get(text);
  if (pending.has(text)) return pending.get(text);
  const job = (async () => {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({client: 'gtx', sl: 'auto', tl: 'zh-CN', dt: 't', q: text});
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {signal: controller.signal, credentials: 'omit', cache: 'no-store'});
      if (!response.ok) throw new Error(`翻译服务返回 ${response.status}，请稍后重试。`);
      const data = await response.json();
      const result = Array.isArray(data?.[0]) ? data[0].map(part => typeof part?.[0] === 'string' ? part[0] : '').join('') : '';
      if (!result.trim()) throw new Error('翻译服务未返回译文，请重试。');
      cache.set(text, result);
      if (cache.size > 80) cache.delete(cache.keys().next().value);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('翻译超时，请检查网络后重试。');
      if (error instanceof TypeError) throw new Error('无法连接 Google 翻译，请检查网络是否可访问该服务。');
      throw error;
    } finally { clearTimeout(timer); }
  })();
  pending.set(text, job);
  try { return await job; } finally { pending.delete(text); }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'history-delete' || message?.type === 'history-clear') {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('history.html')) return;
    mutateHistory(records => message.type === 'history-clear' ? [] : records.filter(record => record.id !== message.id))
      .then(() => reply({ok: true}), error => reply({ok: false, error: error.message}));
    return true;
  }
  if (message?.type !== 'translate') return;
  (async () => {
    if (!sender.tab || !sender.url) throw new Error('请求来源无效。');
    const origin = sender.origin && sender.origin !== 'null' ? sender.origin : new URL(sender.url).origin;
    const {sites = []} = await chrome.storage.local.get('sites');
    if (!sites.includes(origin)) throw new Error('请先在扩展面板中启用当前网站。');
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!text || text.length > 3000) throw new Error('请选择 1–3000 个字符。');
    const translated = await translate(text);
    let warning = '';
    try {
      await mutateHistory(records => [{
        id: crypto.randomUUID(), original: text, translation: translated,
        time: Date.now(), source: HistoryModel.source(sender.tab.url || sender.url)
      }, ...records].slice(0, HistoryModel.limit));
    } catch { warning = '译文已生成，但记录保存失败，请导出并清理历史后重试。'; }
    reply({ok: true, text: translated, warning});
  })().catch(error => reply({ok: false, error: error.message}));
  return true;
});
