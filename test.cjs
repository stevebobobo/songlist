const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
class Element {
  constructor() { this.children = []; this.hidden = false; this.value = ''; this.checked = false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  get childElementCount() { return this.children.length; }
  setAttribute() {}
  reset() { for (const input of Object.values(this.elements)) { input.value = ''; input.checked = false; input.error = ''; } }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  setCustomValidity(error) { this.error = error; }
  reportValidity() { return !this.elements.title.error; }
  click() { this.clicked = true; }
}
function load(saved, failStorage = false) {
  const nodes = {};
  for (const id of ['list','status','dialog','form','form-title','edit','editor','add','cancel','reset','export']) nodes[id] = new Element();
  nodes.form.elements = Object.fromEntries(['title','artist','note','category','highlight'].map(key => [key, new Element()]));
  let stored = saved, confirmed = true, blob;
  const context = vm.createContext({ window: {}, document: { querySelector: selector => nodes[selector.slice(1)], createElement: () => new Element() }, structuredClone, crypto: { randomUUID: () => 'new-id' }, localStorage: { getItem: () => stored ?? null, setItem: (_, value) => { if (failStorage) throw Error('blocked'); stored = value; } }, confirm: () => confirmed, Blob: class { constructor(parts) { blob = parts.join(''); } }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout: callback => callback() });
  vm.runInContext(fs.readFileSync(__dirname + '/songs.js','utf8'), context);
  vm.runInContext(fs.readFileSync(__dirname + '/app.js','utf8'), context);
  return { nodes, context, stored: () => stored, exported: () => blob, confirm: value => { confirmed = value; }, songs: () => JSON.parse(vm.runInContext('JSON.stringify(songs)',context)) };
}
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
  n.form.onsubmit({preventDefault(){}});
  assert.equal(load(app.stored()).songs().at(-1).title,'<測試歌>');
  let row = n.list.children[1].children[1].children.at(-1);
  assert.equal(row.children[0].textContent,'<測試歌>');
  row.children.at(-1).children[0].onclick(); n.form.elements.category.value = 'banned'; n.form.elements.title.value = '修改測試'; n.form.onsubmit({preventDefault(){}});
  row = n.list.children[2].children[1].children.at(-1); row.children.at(-1).children[1].onclick();
  assert.equal(app.songs().at(-1).highlight,true);
  n.export.onclick(); assert.deepEqual(JSON.parse(app.exported()),app.songs());
  app.confirm(false); n.reset.onclick(); assert.equal(app.songs().length,23);
  row = n.list.children[2].children[1].children.at(-1); row.children.at(-1).children[2].onclick(); assert.equal(app.songs().length,23);
  app.confirm(true); row.children.at(-1).children[2].onclick(); assert.equal(app.songs().length,22);
  n.reset.onclick(); assert.deepEqual(app.songs(),load().songs());
});
test('損壞資料與儲存失敗提供提示，空白歌名不可儲存', () => {
  const broken = load('{broken'); assert.equal(broken.songs().length,22); assert.equal(broken.stored(),'{broken'); assert.equal(broken.nodes.status.hidden,false);
  const invalid = load(JSON.stringify([{id:'x',category:'unknown'}])); assert.equal(invalid.songs().length,22);
  const app = load(undefined,true); const n = app.nodes; n.add.onclick(); n.form.elements.title.value = '   '; n.form.onsubmit({preventDefault(){}}); assert.equal(app.songs().length,22);
  n.form.elements.title.value = '測試'; n.form.elements.category.value = 'personal'; n.form.onsubmit({preventDefault(){}}); assert.equal(app.songs().length,23); assert.match(n.status.textContent,/無法儲存/);
});
