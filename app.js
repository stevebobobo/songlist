const KEY = 'leo-songlist-v1';
const categories = { personal: '個人曲目', group: '團體曲目', banned: '禁歌 · 不能唱' };
const list = document.querySelector('#list');
const status = document.querySelector('#status');
const dialog = document.querySelector('#dialog');
const form = document.querySelector('#form');
let songs = structuredClone(window.DEFAULT_SONGS);
let editing = false;
let selectedId = null;
function notify(message) { status.textContent = message; status.hidden = false; }
function validSongs(value) {
  return Array.isArray(value) && value.every(song => song && typeof song.id === 'string' && Object.hasOwn(categories, song.category) && typeof song.title === 'string' && song.title.trim() && typeof song.artist === 'string' && typeof song.note === 'string' && typeof song.highlight === 'boolean') && new Set(value.map(song => song.id)).size === value.length;
}
try {
  const saved = localStorage.getItem(KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (!validSongs(parsed)) throw new Error('Invalid data');
    songs = parsed;
  }
} catch { notify('無法讀取已存歌單，暫時顯示預設歌單。原有儲存資料未被覆寫；編輯後儲存會取代它。'); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(songs)); notify('已儲存於此瀏覽器。'); }
  catch { notify('瀏覽器無法儲存，重新載入後可能遺失變更。請立即匯出歌單備份。'); }
  render();
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function openForm(song) {
  selectedId = song?.id ?? null;
  form.reset();
  document.querySelector('#form-title').textContent = song ? '修改歌曲' : '新增歌曲';
  for (const key of ['title', 'artist', 'note', 'category']) form.elements[key].value = song?.[key] ?? (key === 'category' ? 'personal' : '');
  form.elements.highlight.checked = song?.highlight ?? false;
  dialog.showModal();
  form.elements.title.focus();
}
function render() {
  list.replaceChildren();
  for (const [category, label] of Object.entries(categories)) {
    const section = element('section', undefined, category === 'banned' ? 'banned' : '');
    section.append(element('h2', label));
    const ul = element('ul');
    for (const song of songs.filter(song => song.category === category)) {
      const li = element('li', undefined, song.highlight ? 'highlight' : '');
      li.append(element('div', song.title, 'song-title'));
      if (song.artist) li.append(element('div', song.artist, 'details'));
      if (song.note) li.append(element('div', song.note, 'details note'));
      if (editing) {
        const actions = element('div', undefined, 'actions');
        const modify = element('button', '修改');
        modify.setAttribute('aria-label', '修改 ' + song.title);
        modify.onclick = () => openForm(song);
        const highlight = element('button', song.highlight ? '取消重點' : '標為重點');
        highlight.setAttribute('aria-pressed', String(song.highlight));
        highlight.setAttribute('aria-label', (song.highlight ? '取消重點 ' : '標為重點 ') + song.title);
        highlight.onclick = () => { song.highlight = !song.highlight; save(); };
        const remove = element('button', '刪除');
        remove.setAttribute('aria-label', '刪除 ' + song.title);
        remove.onclick = () => {
          if (!confirm('確定刪除「' + song.title + '」？')) return;
          songs = songs.filter(item => item.id !== song.id);
          save();
        };
        actions.append(modify, highlight, remove);
        li.append(actions);
      }
      ul.append(li);
    }
    section.append(ul.childElementCount ? ul : element('p', '尚無曲目', 'empty'));
    list.append(section);
  }
}
document.querySelector('#edit').onclick = event => {
  editing = !editing;
  event.currentTarget.textContent = editing ? '完成編輯' : '編輯歌單';
  event.currentTarget.setAttribute('aria-pressed', String(editing));
  document.querySelector('#editor').hidden = !editing;
  render();
};
document.querySelector('#add').onclick = () => openForm();
document.querySelector('#cancel').onclick = () => dialog.close();
form.onsubmit = event => {
  event.preventDefault();
  const title = form.elements.title.value.trim();
  form.elements.title.setCustomValidity(title ? '' : '請輸入歌名');
  if (!form.reportValidity()) return;
  const song = { id: selectedId ?? crypto.randomUUID(), category: form.elements.category.value, title, artist: form.elements.artist.value.trim(), note: form.elements.note.value.trim(), highlight: form.elements.highlight.checked };
  if (selectedId) songs = songs.map(item => item.id === selectedId ? song : item);
  else songs.push(song);
  dialog.close();
  save();
};
form.elements.title.oninput = () => form.elements.title.setCustomValidity('');
document.querySelector('#reset').onclick = () => {
  if (!confirm('確定還原成預設歌單？此瀏覽器中的新增、修改及刪除紀錄將被取代。建議先匯出備份。')) return;
  songs = structuredClone(window.DEFAULT_SONGS);
  save();
};
document.querySelector('#export').onclick = () => {
  const text = JSON.stringify(songs, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = element('a');
  link.href = url;
  link.download = 'Leo歌單.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('已匯出完整歌單（JSON 文字），包含分類、歌手、備註與重點標記。');
};
render();
