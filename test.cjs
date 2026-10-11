const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const KEY = 'leo-songlist-v1';
const LYRICS_KEY = 'leo-songlist-lyrics-v1';
class Element {
  constructor() { this.children = []; this.hidden = false; this.value = ''; this.checked = false; this.style = {}; this.files = []; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  get childElementCount() { return this.children.length; }
  setAttribute() {}
  reset() { for (const input of Object.values(this.elements)) { input.value = ''; input.checked = false; input.error = ''; } }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  setCustomValidity(error) { this.error = error; }
  reportValidity() { return !Object.values(this.elements).some(input => input.error); }
  click() { this.clicked = true; }
}
function load(saved, failStorage = false, savedLyrics) {
  const nodes = {};
  for (const id of ['home','lyrics','list','status','dialog','form','form-title','edit','editor','add','cancel','reset','export','import','import-file','lyrics-title','lyrics-meta','lyrics-text','lyrics-empty','lyrics-search','lyrics-edit','lyrics-form','lyrics-cancel','prev','next','smaller','larger']) nodes[id] = new Element();
  nodes.lyrics.hidden = true;
  nodes.form.elements = Object.fromEntries(['title','artist','note','sheet','category','highlight'].map(key => [key, new Element()]));
  nodes['lyrics-form'].elements = { text: new Element() };
  const store = {};
  if (saved !== undefined) store[KEY] = saved;
  if (savedLyrics !== undefined) store[LYRICS_KEY] = savedLyrics;
  let confirmed = true, blob;
  const window = {};
  const location = { hash: '', replace(hash) { this.hash = hash; window.onhashchange(); } };
  const context = vm.createContext({ window, location, navigator: {}, document: { querySelector: selector => nodes[selector.slice(1)], createElement: () => new Element() }, structuredClone, crypto: { randomUUID: () => 'new-id' }, localStorage: { getItem: key => store[key] ?? null, setItem: (key, value) => { if (failStorage) throw Error('blocked'); store[key] = value; } }, confirm: () => confirmed, Blob: class { constructor(parts) { blob = parts.join(''); } }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout: callback => callback() });
  vm.runInContext(fs.readFileSync(__dirname + '/songs.js','utf8'), context);
  vm.runInContext(fs.readFileSync(__dirname + '/app.js','utf8'), context);
  const read = name => JSON.parse(vm.runInContext('JSON.stringify(' + name + ')',context));
  return { nodes, context, stored: () => store[KEY], storedLyrics: () => store[LYRICS_KEY], exported: () => blob, confirm: value => { confirmed = value; }, go: hash => { location.hash = hash; window.onhashchange(); }, songs: () => read('songs'), lyrics: () => read('lyrics') };
}
const submit = { preventDefault() {} };
const file = text => ({ text: async () => text });
test('預設資料保留原始筆記與新增曲目', () => {
  const app = load(); const songs = app.songs();
  assert.equal(songs.length,22);
  assert.deepEqual(['personal','group','banned'].map(category => songs.filter(song => song.category === category).length),[16,5,1]);
  assert.equal(songs.find(song => song.title === '感恩的心').note,'KEY很高');
  assert.deepEqual(songs.filter(song => song.artist === '羅時豐').map(song => song.title),['小姐請你給我愛','心肝丟三下']);
  assert.deepEqual(songs.filter(song => song.artist === '李聖傑').map(song => song.title),['My Love','聽我愛妳']);
  assert.equal(songs.find(song => song.title === '做事人').artist,'美秀集團');
  assert.equal(songs.find(song => song.title === '愛情限時批').artist,'伍佰');
  assert.equal(songs.find(song => song.title === '鋼鐵男子 Iron Man').artist,'伍佰');
  assert.deepEqual(songs.filter(song => song.highlight).map(song => song.title),['My Way','衝衝衝','向前走','黃明志 Ft. 玖壹壹【Oh My God!】']);
  assert.equal(app.nodes.list.children[0].children[1].children[0].children.length,1);
});
test('新增、修改、重點、刪除、匯出、重新載入與確認還原', () => {
  const app = load(); const n = app.nodes;
  n.edit.onclick({currentTarget:n.edit}); assert.equal(n.editor.hidden,false);
  n.add.onclick(); n.form.elements.title.value = '  <測試歌>  '; n.form.elements.artist.value = '測試歌手'; n.form.elements.note.value = '備註'; n.form.elements.category.value = 'group';
  n.form.onsubmit(submit);
  assert.equal(load(app.stored()).songs().at(-1).title,'<測試歌>');
  let row = n.list.children[1].children[1].children.at(-1);
  assert.equal(row.children[0].textContent,'<測試歌>');
  row.children.at(-1).children[0].onclick(); n.form.elements.category.value = 'banned'; n.form.elements.title.value = '修改測試'; n.form.onsubmit(submit);
  row = n.list.children[2].children[1].children.at(-1); row.children.at(-1).children[1].onclick();
  assert.equal(app.songs().at(-1).highlight,true);
  n.export.onclick(); assert.deepEqual(JSON.parse(app.exported()),{songs:app.songs(),lyrics:{}});
  app.confirm(false); n.reset.onclick(); assert.equal(app.songs().length,23);
  row = n.list.children[2].children[1].children.at(-1); row.children.at(-1).children[2].onclick(); assert.equal(app.songs().length,23);
  app.confirm(true); row.children.at(-1).children[2].onclick(); assert.equal(app.songs().length,22);
  n.reset.onclick(); assert.deepEqual(app.songs(),load().songs());
});
test('損壞資料與儲存失敗提供提示，空白歌名不可儲存', () => {
  const broken = load('{broken'); assert.equal(broken.songs().length,22); assert.equal(broken.stored(),'{broken'); assert.equal(broken.nodes.status.hidden,false);
  const invalid = load(JSON.stringify([{id:'x',category:'unknown'}])); assert.equal(invalid.songs().length,22);
  const app = load(undefined,true); const n = app.nodes; n.add.onclick(); n.form.elements.title.value = '   '; n.form.onsubmit(submit); assert.equal(app.songs().length,22);
  n.form.elements.title.value = '測試'; n.form.elements.category.value = 'personal'; n.form.onsubmit(submit); assert.equal(app.songs().length,23); assert.match(n.status.textContent,/無法儲存/);
});
test('歌詞：點歌名開啟、儲存、標記、換歌、字級、清除；禁歌不開', () => {
  const app = load(); const n = app.nodes; const text = n['lyrics-form'].elements.text;
  const firstRow = () => n.list.children[0].children[1].children[0];
  const search = 'https://www.google.com/search?q=' + encodeURIComponent('愛你一萬年 歌詞');
  assert.deepEqual([firstRow().children[0].href,firstRow().children[0].target],[search,'_blank']);
  assert.equal(n.list.children[0].children[1].children[3].children[0].href,'https://www.google.com/search?q=' + encodeURIComponent('小姐請你給我愛 羅時豐 歌詞'));
  assert.equal(n.list.children[2].children[1].children[0].children[0].href,undefined);
  app.go('#l/p0');
  assert.deepEqual([n.home.hidden,n.lyrics.hidden],[true,false]);
  assert.equal(n['lyrics-title'].textContent,'愛你一萬年');
  assert.deepEqual([n['lyrics-empty'].hidden,n['lyrics-text'].hidden,n.prev.hidden],[false,true,true]);
  assert.equal(n.next.textContent,'月亮代表我的心 →');
  assert.match(n['lyrics-search'].href,/^https:\/\/www\.google\.com\/search\?q=/);
  n['lyrics-edit'].onclick(); assert.equal(n['lyrics-form'].hidden,false);
  text.value = '  第一行\r\n第二行  '; n['lyrics-form'].onsubmit(submit);
  assert.deepEqual(app.lyrics(),{p0:'第一行\n第二行'});
  assert.deepEqual([n['lyrics-text'].textContent,n['lyrics-text'].hidden,n['lyrics-form'].hidden],['第一行\n第二行',false,true]);
  assert.equal(firstRow().className,'has-lyrics');
  assert.deepEqual([firstRow().children[0].href,firstRow().children[0].target],['#l/p0',undefined]);
  assert.deepEqual(load(undefined,false,app.storedLyrics()).lyrics(),{p0:'第一行\n第二行'});
  n.next.onclick(); assert.equal(n['lyrics-title'].textContent,'月亮代表我的心');
  app.go('#l/p15'); assert.equal(n.next.textContent,'你是我的兄弟 →');
  app.go('#l/g4'); assert.equal(n.next.hidden,true);
  n.larger.onclick(); assert.equal(n['lyrics-text'].style.fontSize,'33px');
  for (let i = 0; i < 30; i++) n.smaller.onclick(); assert.equal(n['lyrics-text'].style.fontSize,'18px');
  app.go('#l/b0'); assert.deepEqual([n.home.hidden,n.lyrics.hidden],[false,true]);
  app.go('#l/%E0%A4%A'); assert.equal(n.lyrics.hidden,true);
  app.go('#l/p0'); n['lyrics-edit'].onclick(); assert.equal(text.value,'第一行\n第二行');
  text.value = '   '; n['lyrics-form'].onsubmit(submit);
  assert.deepEqual(app.lyrics(),{}); assert.equal(n['lyrics-empty'].hidden,false);
  const blocked = load(undefined,true); blocked.go('#l/p0'); blocked.nodes['lyrics-edit'].onclick();
  blocked.nodes['lyrics-form'].elements.text.value = '詞'; blocked.nodes['lyrics-form'].onsubmit(submit);
  assert.match(blocked.nodes.status.textContent,/無法儲存歌詞/);
  assert.equal(load(undefined,false,'{broken').nodes.status.hidden,false);
});
test('匯出含歌詞、匯入取代、舊格式保留歌詞、壞檔與取消不變動、刪歌連同歌詞', async () => {
  const app = load(undefined,false,JSON.stringify({p0:'詞A',gone:'已刪除歌曲的歌詞'}));
  app.nodes.export.onclick(); const data = JSON.parse(app.exported());
  assert.deepEqual(data.lyrics,{p0:'詞A'}); assert.equal(data.songs.length,22);
  const other = load(); const input = other.nodes['import-file'];
  const pick = async text => { input.files = [file(text)]; await input.onchange(); };
  await pick(app.exported());
  assert.deepEqual(other.lyrics(),{p0:'詞A'}); assert.deepEqual(JSON.parse(other.storedLyrics()),{p0:'詞A'}); assert.equal(JSON.parse(other.stored()).length,22);
  await pick(JSON.stringify(data.songs.slice(0,3)));
  assert.equal(other.songs().length,3); assert.deepEqual(other.lyrics(),{p0:'詞A'});
  await pick('{"songs":[{"id":"x"}]}');
  assert.equal(other.songs().length,3); assert.match(other.nodes.status.textContent,/匯入失敗/);
  await pick(JSON.stringify({songs:data.songs,lyrics:{p0:1}}));
  assert.equal(other.songs().length,3);
  other.confirm(false); await pick(app.exported()); assert.equal(other.songs().length,3);
  other.confirm(true); other.nodes.edit.onclick({currentTarget:other.nodes.edit});
  other.nodes.list.children[0].children[1].children[0].children.at(-1).children[2].onclick();
  assert.equal(other.songs().length,2); assert.deepEqual(other.lyrics(),{}); assert.deepEqual(JSON.parse(other.storedLyrics()),{});
});
test('我的歌譜連結：只收 http(s)、顯示於歌單、舊資料相容；編輯模式可直接貼歌詞', () => {
  const app = load(); const n = app.nodes; const f = n.form.elements;
  n.edit.onclick({currentTarget:n.edit});
  const firstRow = () => n.list.children[0].children[1].children[0];
  firstRow().children.at(-1).children[0].onclick(); assert.equal(f.sheet.value,'');
  f.sheet.value = 'javascript:alert(1)'; n.form.onsubmit(submit);
  assert.equal(app.songs()[0].sheet,undefined); assert.match(f.sheet.error,/http/);
  f.sheet.value = '  https://drive.google.com/file/d/abc/view  '; f.sheet.oninput(); n.form.onsubmit(submit);
  assert.equal(app.songs()[0].sheet,'https://drive.google.com/file/d/abc/view');
  const link = firstRow().children[1];
  assert.deepEqual([link.textContent,link.href,link.target,link.rel],['我的歌譜','https://drive.google.com/file/d/abc/view','_blank','noopener']);
  assert.equal(load(app.stored()).songs()[0].sheet,'https://drive.google.com/file/d/abc/view');
  const bad = app.songs(); bad[1].sheet = 'javascript:alert(1)';
  assert.equal(load(JSON.stringify(bad)).nodes.status.hidden,false);
  const words = firstRow().children.at(-1).children[3];
  assert.equal(words.textContent,'貼上歌詞');
  assert.equal(n.list.children[2].children[1].children[0].children.at(-1).children.length,3);
  words.onclick(); app.go('#l/p0');
  assert.deepEqual([n.lyrics.hidden,n['lyrics-form'].hidden],[false,false]);
  app.go(''); app.go('#l/p0'); assert.equal(n['lyrics-form'].hidden,true);
});
