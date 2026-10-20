const button = document.querySelector('#toggle');
const status = document.querySelector('#status');
document.querySelector('#history').addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('history.html')}));
let tab, origin, pattern, id, enabled;
async function init() {
  [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const url = new URL(tab.url);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('请打开 Z-Library 网页后再使用。');
  origin = url.origin;
  pattern = `${origin}/*`;
  id = `site-${Array.from(origin).map(c => c.charCodeAt(0).toString(16)).join('-')}`;
  document.querySelector('#site').textContent = url.hostname;
  const {sites = []} = await chrome.storage.local.get('sites');
  enabled = sites.includes(origin);
  render();
}
function render() { button.disabled = false; button.textContent = enabled ? '停用当前网站' : '同意并在当前网站启用'; }
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    if (!enabled && !await chrome.permissions.request({origins: [pattern]})) throw new Error('未获得网站访问权限，可再次点击启用。');
    const {sites = []} = await chrome.storage.local.get('sites');
    if (enabled) {
      await chrome.scripting.unregisterContentScripts({ids: [id]}).catch(() => {});
      await chrome.storage.local.set({sites: sites.filter(site => site !== origin)});
      enabled = false;
    } else {
      const existing = await chrome.scripting.getRegisteredContentScripts({ids: [id]});
      const script = {id, matches: [pattern], js: ['content.js'], runAt: 'document_start', allFrames: true, matchOriginAsFallback: true, persistAcrossSessions: true};
      if (!existing.length) await chrome.scripting.registerContentScripts([script]);
      else await chrome.scripting.updateContentScripts([script]);
      await chrome.storage.local.set({sites: [...new Set([...sites, origin])]});
      enabled = true;
      await chrome.scripting.executeScript({target: {tabId: tab.id, allFrames: true}, files: ['content.js']});
    }
    status.textContent = enabled ? '已启用。在页面选中文字即可翻译。' : '已停用。';
  } catch (error) { status.textContent = error.message; }
  finally { render(); }
});
init().catch(error => { status.textContent = error.message; button.textContent = '无法在此页面启用'; });
