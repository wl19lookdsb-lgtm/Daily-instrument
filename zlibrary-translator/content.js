(() => {
  if (globalThis.__zlibChineseTranslator) return;
  globalThis.__zlibChineseTranslator = true;
  // Inherited about:blank/srcdoc frames expose their effective origin here.
  const pageOrigin = globalThis.origin && globalThis.origin !== 'null' ? globalThis.origin : location.origin;
  let enabled = false, host, root, timer, request = 0, lastText = '';
  chrome.storage.local.get('sites').then(({sites = []}) => { enabled = sites.includes(pageOrigin); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sites) {
      enabled = (changes.sites.newValue || []).includes(pageOrigin);
      if (!enabled) close();
    }
  });
  function close() { clearTimeout(timer); request++; host?.remove(); host = null; lastText = ''; }
  function show(rect) {
    host?.remove();
    host = document.createElement('div');
    host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;';
    root = host.attachShadow({mode: 'closed'});
    root.innerHTML = `<style>
      :host{color-scheme:light}*{box-sizing:border-box}.card{width:min(360px,calc(100vw - 24px));font:14px/1.7 system-ui,"Microsoft YaHei",sans-serif;color:#22392e;background:#fff;border:1px solid #dce7df;border-radius:14px;box-shadow:0 10px 40px #142c2433;padding:16px;text-align:left}header{display:flex;align-items:center;justify-content:space-between;color:#24664f;font-size:12px;font-weight:600}button{font:inherit;cursor:pointer;border:0;background:#edf3ee;color:#285d48;border-radius:6px;padding:4px 9px}#result{white-space:pre-wrap;overflow-wrap:anywhere;max-height:min(280px,45vh);overflow:auto;margin:12px 0;user-select:text}footer{display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#7a867e}[hidden]{display:none!important}button:focus-visible{outline:2px solid #24664f}
      </style><section class="card" role="region" aria-label="中文翻译"><header>简体中文翻译<button id="close" aria-label="关闭翻译">×</button></header><div id="result" aria-live="polite">正在翻译…</div><footer><span>Google 翻译 · Esc 关闭</span><button id="retry" hidden>重试</button></footer></section>`;
    host.addEventListener('pointerdown', event => event.stopPropagation());
    host.addEventListener('pointerup', event => event.stopPropagation());
    root.querySelector('#close').addEventListener('click', close);
    root.querySelector('#retry').addEventListener('click', () => run(lastText));
    document.documentElement.appendChild(host);
    const width = host.getBoundingClientRect().width;
    host.style.setProperty('left', `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`, 'important');
    host.style.setProperty('top', `${Math.max(12, Math.min(rect.bottom + 10, innerHeight - 200))}px`, 'important');
  }
  async function run(text) {
    const token = ++request;
    const result = root.querySelector('#result');
    const retry = root.querySelector('#retry');
    result.textContent = '正在翻译…'; retry.hidden = true;
    try {
      const response = await chrome.runtime.sendMessage({type: 'translate', text});
      if (token !== request || !host) return;
      if (!response?.ok) throw new Error(response?.error || '翻译失败，请重试。');
      result.textContent = response.text;
      if (response.warning) result.textContent += '\n\n' + response.warning;
    } catch (error) {
      if (token !== request || !host) return;
      result.textContent = error.message.includes('context invalidated') ? '扩展已更新，请刷新网页。' : error.message;
      retry.hidden = false;
    }
    if (host && token === request) {
      const box = host.getBoundingClientRect();
      host.style.setProperty('top', `${Math.max(12, Math.min(box.top, innerHeight - box.height - 12))}px`, 'important');
    }
  }
  function selected(event) {
    if (!enabled || event.composedPath().includes(host)) return;
    const active = document.activeElement;
    if (active?.matches('input,textarea,select') || active?.isContentEditable) return;
    // Snapshot during capture, before the reader's annotation menu changes selection.
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection.rangeCount) return;
    const anchor = selection.anchorNode?.parentElement;
    if (anchor?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])')) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!enabled) return;
      if (text === lastText && host) return;
      request++; lastText = text; show(rect);
      if (text.length > 3000) root.querySelector('#result').textContent = '选中文字过长，请缩短到 3000 个字符以内。';
      else run(text);
    }, 280);
  }
  window.addEventListener('pointerup', selected, true);
  window.addEventListener('mouseup', selected, true);
  window.addEventListener('keyup', event => { if (event.key === 'Escape') close(); else if (event.key === 'Shift' || event.key.startsWith('Arrow')) selected(event); }, true);
  document.addEventListener('pointerdown', event => { if (host && !event.composedPath().includes(host)) close(); });
  window.addEventListener('resize', close);
})();
