const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let listener, calls = 0, mode = 'ok';
const context = {URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Map, TypeError,
  chrome: {runtime: {onInstalled: {addListener() {}}, onMessage: {addListener(fn) {listener = fn;}}}, storage: {local: {async get() {return {sites: ['https://example.org']};}}}},
  fetch: async () => {calls++; if (mode === 'network') throw new TypeError('failed'); return {ok: mode !== 'http', status: 429, json: async () => mode === 'empty' ? [] : [[['你好', 'Hello']]]};}
};
vm.runInNewContext(readFileSync('zlibrary-translator/background.js', 'utf8'), context);
const send = (text, url = 'https://example.org/book') => new Promise(resolve => listener({type: 'translate', text}, {tab: {id: 1}, url}, resolve));
(async () => {
  assert.equal((await send('Hello')).text, '你好');
  await send('Hello'); assert.equal(calls, 1, 'cache avoids repeated requests');
  assert.equal((await send('secret', 'https://unapproved.org')).ok, false);
  assert.equal((await send('x'.repeat(3001))).ok, false);
  assert.equal((await send(' ')).ok, false);
  assert.equal(calls, 1, 'invalid requests never reach provider');
  mode = 'http'; assert.match((await send('rate')).error, /429/);
  mode = 'empty'; assert.match((await send('empty')).error, /未返回/);
  mode = 'network'; assert.match((await send('offline')).error, /无法连接/);
  mode = 'ok'; const previous = calls;
  await Promise.all([send('same'), send('same')]); assert.equal(calls, previous + 1);
  const manifest = JSON.parse(readFileSync('zlibrary-translator/manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  for (const file of ['background.js', 'popup.js', 'content.js', 'popup.html', 'popup.css']) assert.ok(readFileSync('zlibrary-translator/' + file).length);
  console.log('PASS: translation, cache, authorization, length, HTTP/network/empty failures, concurrent deduplication, package files');
})().catch(error => {console.error(error); process.exitCode = 1;});
