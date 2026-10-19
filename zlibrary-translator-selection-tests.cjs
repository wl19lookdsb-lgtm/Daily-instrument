const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const listeners = {}, nodes = {}, messages = [];
let selectedText = 'A book worth reading.', delayed;
const origin = 'https://example.org';
const shadow = {set innerHTML(value) {}, querySelector(id) {return nodes[id] ||= {textContent: '', addEventListener() {}};}};
const host = {style: {setProperty() {}}, attachShadow: () => shadow, addEventListener() {}, remove() {}, getBoundingClientRect: () => ({width: 360, height: 180, top: 200})};
const context = {origin, location: {origin: 'null'}, innerWidth: 1200, innerHeight: 800,
  setTimeout(fn) {delayed = fn; return 1;}, clearTimeout() {delayed = null;},
  document: {activeElement: null, createElement: () => host, documentElement: {appendChild() {}}, addEventListener() {}},
  window: {addEventListener(name, fn, capture) {listeners[name] = {fn, capture};}, getSelection: () => ({toString: () => selectedText, rangeCount: 1, anchorNode: {parentElement: {closest: () => null}}, getRangeAt: () => ({getBoundingClientRect: () => ({left: 100, bottom: 180})})})},
  chrome: {storage: {local: {get: async () => ({sites: [origin]})}, onChanged: {addListener() {}}}, runtime: {sendMessage: async msg => {messages.push(msg); return {ok: true, text: '一本值得读的书。'};}}}
};
(async () => {
  vm.runInNewContext(fs.readFileSync('zlibrary-translator/content.js', 'utf8'), context);
  await Promise.resolve();
  assert.equal(listeners.pointerup.capture, true);
  listeners.pointerup.fn({composedPath: () => []});
  selectedText = ''; // Reader clears native selection while opening its own menu.
  delayed();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages[0].text, 'A book worth reading.');
  assert.equal(nodes['#result'].textContent, '一本值得读的书。');
  console.log('PASS: inherited frame origin, capture listener, selection survives reader clearing, translation display');
})().catch(error => {console.error(error); process.exitCode = 1;});
