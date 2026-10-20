const $ = selector => document.querySelector(selector);
let history = [], visible = 40;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function render() {
  const query = $('#search').value.trim().toLowerCase();
  const ranking = HistoryModel.ranking(history);
  $('#total').textContent = history.length;
  $('#words').textContent = ranking.length;
  $('#repeated').textContent = ranking.filter(word => word.count > 1).length;
  const filtered = history.filter(record => [record.original, record.translation, record.source].some(value => (value || '').toLowerCase().includes(query)));
  $('#records').replaceChildren();
  for (const record of filtered.slice(0, visible)) {
    const card = element('article', 'record');
    card.append(element('p', 'original', record.original), element('p', 'translated', record.translation));
    const meta = element('div', 'meta');
    meta.append(element('time', '', new Date(record.time).toLocaleString('zh-CN')));
    const safeSource = HistoryModel.source(record.source);
    if (safeSource) {
      const link = element('a', '', new URL(safeSource).hostname);
      link.href = safeSource; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = safeSource;
      meta.append(link);
    }
    const remove = element('button', '', '删除');
    remove.addEventListener('click', () => mutate({type: 'history-delete', id: record.id}));
    meta.append(remove); card.append(meta); $('#records').append(card);
  }
  if (!filtered.length) $('#records').append(element('p', 'empty', history.length ? '没有匹配的记录。' : '还没有记录。去已启用的网站查一个词，译文会自动保存在这里。'));
  $('#more').hidden = visible >= filtered.length;
  $('#ranking').replaceChildren();
  for (const [index, word] of ranking.entries()) {
    if (query && ![word.word, word.translation].some(text => text.toLowerCase().includes(query))) continue;
    const row = element('li', 'word'), detail = element('div', 'detail');
    detail.append(element('b', '', word.word), element('div', 'meaning', word.translation));
    row.append(element('span', 'position', index + 1), detail, element('span', 'count', `${word.count} 次`));
    $('#ranking').append(row);
  }
  if (!$('#ranking').children.length) $('#ranking').append(element('li', 'empty', '暂无匹配的单词。'));
  $('#export').disabled = !history.length; $('#clear').disabled = !history.length;
}
async function reload() { const data = await chrome.storage.local.get('history'); history = data.history || []; render(); }
async function mutate(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || '操作失败');
    await reload(); $('#status').textContent = '记录已更新。';
  } catch (error) { $('#status').textContent = `保存失败：${error.message}`; }
}
$('#search').addEventListener('input', () => { visible = 40; render(); });
$('#more').addEventListener('click', () => { visible += 40; render(); });
$('#clear').addEventListener('click', () => { if (confirm('确定清空全部翻译记录和单词排名？此操作不可撤销，建议先导出。')) mutate({type: 'history-clear'}); });
$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({version: 1, exportedAt: new Date().toISOString(), records: history, ranking: HistoryModel.ranking(history)}, null, 2)], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = element('a');
  link.href = url; link.download = `translation-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.history) reload().catch(error => { $('#status').textContent = error.message; }); });
reload().catch(error => { $('#status').textContent = `无法读取记录：${error.message}`; });
