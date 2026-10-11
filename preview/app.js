const KEY = 'leo-songlist-v1';
const LYRICS_KEY = 'leo-songlist-lyrics-v1';
const SIZE_KEY = 'leo-songlist-lyrics-size';
const categories = { personal: '個人曲目', group: '團體曲目', banned: '禁歌 · 不能唱' };
const home = document.querySelector('#home');
const view = document.querySelector('#lyrics');
const list = document.querySelector('#list');
const status = document.querySelector('#status');
const dialog = document.querySelector('#dialog');
const form = document.querySelector('#form');
const lyricsText = document.querySelector('#lyrics-text');
const lyricsEmpty = document.querySelector('#lyrics-empty');
const lyricsForm = document.querySelector('#lyrics-form');
const importFile = document.querySelector('#import-file');
let songs = structuredClone(window.DEFAULT_SONGS);
let lyrics = {};
let editing = false;
let selectedId = null;
let current = null;
let homeScroll = 0;
let wake = null;
let size = 30;
function notify(message) { status.textContent = message; status.hidden = false; }
function validSongs(value) {
  return Array.isArray(value) && value.every(song => song && typeof song.id === 'string' && Object.hasOwn(categories, song.category) && typeof song.title === 'string' && song.title.trim() && typeof song.artist === 'string' && typeof song.note === 'string' && typeof song.highlight === 'boolean') && new Set(value.map(song => song.id)).size === value.length;
}
function validLyrics(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(text => typeof text === 'string');
}
try {
  const saved = localStorage.getItem(KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (!validSongs(parsed)) throw new Error('Invalid data');
    songs = parsed;
  }
} catch { notify('無法讀取已存歌單，暫時顯示預設歌單。原有儲存資料未被覆寫；編輯後儲存會取代它。'); }
try {
  const saved = localStorage.getItem(LYRICS_KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (!validLyrics(parsed)) throw new Error('Invalid data');
    lyrics = parsed;
  }
} catch { notify('無法讀取已存歌詞。原有儲存資料未被覆寫；儲存任何一首歌詞後會取代它。'); }
try { size = Math.min(72, Math.max(18, Number(localStorage.getItem(SIZE_KEY)) || size)); } catch {}
function save() {
  let ok = true;
  try { localStorage.setItem(KEY, JSON.stringify(songs)); notify('已儲存於此瀏覽器。'); }
  catch { ok = false; notify('瀏覽器無法儲存，重新載入後可能遺失變更。請立即匯出歌單備份。'); }
  render();
  return ok;
}
function saveLyrics() {
  try { localStorage.setItem(LYRICS_KEY, JSON.stringify(lyrics)); return true; }
  catch { notify('瀏覽器無法儲存歌詞，重新載入後可能遺失。請立即匯出備份。'); return false; }
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
      const li = element('li', undefined, [song.highlight && 'highlight', lyrics[song.id] && 'has-lyrics'].filter(Boolean).join(' '));
      // 禁歌不能唱，編輯中點歌名也不該跳走，所以這兩種情況不做成連結
      const linked = !editing && category !== 'banned';
      const title = element(linked ? 'a' : 'div', song.title, 'song-title');
      if (linked) title.href = '#l/' + encodeURIComponent(song.id);
      li.append(title);
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
          if (!confirm('確定刪除「' + song.title + '」' + (lyrics[song.id] ? '和它的歌詞' : '') + '？')) return;
          songs = songs.filter(item => item.id !== song.id);
          if (lyrics[song.id]) { delete lyrics[song.id]; saveLyrics(); }
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
function singable() {
  return Object.keys(categories).filter(category => category !== 'banned').flatMap(category => songs.filter(song => song.category === category));
}
function showLyrics(song) {
  current = song;
  const text = lyrics[song.id] ?? '';
  document.querySelector('#lyrics-title').textContent = song.title;
  document.querySelector('#lyrics-meta').textContent = [song.artist, song.note].filter(Boolean).join(' · ');
  lyricsText.textContent = text;
  lyricsText.hidden = !text;
  lyricsEmpty.hidden = Boolean(text);
  lyricsForm.hidden = true;
  document.querySelector('#lyrics-search').href = 'https://www.google.com/search?q=' + encodeURIComponent([song.title, song.artist, '歌詞'].filter(Boolean).join(' '));
  document.querySelector('#lyrics-edit').textContent = text ? '編輯歌詞' : '貼上歌詞';
  const order = singable();
  const index = order.indexOf(song);
  for (const [id, target, label] of [['#prev', order[index - 1], title => '← ' + title], ['#next', order[index + 1], title => title + ' →']]) {
    const button = document.querySelector(id);
    button.hidden = !target;
    button.textContent = target ? label(target.title) : '';
    // 用 replace 換歌，這樣按一次「上一頁」就回到歌單，不必一首首退
    button.onclick = target ? () => location.replace('#l/' + encodeURIComponent(target.id)) : null;
  }
}
async function keepAwake() {
  try { wake = await navigator.wakeLock?.request('screen') ?? null; } catch { wake = null; }
}
function releaseWake() {
  wake?.release().catch(() => {});
  wake = null;
}
function route() {
  let song = null;
  try { if (location.hash.startsWith('#l/')) song = singable().find(item => item.id === decodeURIComponent(location.hash.slice(3))) ?? null; } catch {}
  if (song && view.hidden) homeScroll = window.scrollY ?? 0;
  home.hidden = Boolean(song);
  view.hidden = !song;
  if (song) { showLyrics(song); window.scrollTo?.(0, 0); keepAwake(); }
  else { current = null; releaseWake(); window.scrollTo?.(0, homeScroll); }
}
function setSize(value) {
  size = Math.min(72, Math.max(18, value));
  lyricsText.style.fontSize = size + 'px';
  try { localStorage.setItem(SIZE_KEY, String(size)); } catch {}
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
  if (!confirm('確定還原成預設歌單？此瀏覽器中的新增、修改及刪除紀錄將被取代（已存的歌詞會保留）。建議先匯出備份。')) return;
  songs = structuredClone(window.DEFAULT_SONGS);
  save();
};
document.querySelector('#export').onclick = () => {
  const data = { songs, lyrics: Object.fromEntries(songs.filter(song => lyrics[song.id]).map(song => [song.id, lyrics[song.id]])) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'text/plain;charset=utf-8' }));
  const link = element('a');
  link.href = url;
  link.download = 'Leo歌單.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('已匯出歌單與歌詞（JSON 文字）。這個檔案可在另一台裝置用「編輯歌單 → 匯入」載入。');
};
document.querySelector('#import').onclick = () => importFile.click();
importFile.onchange = async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    // 舊版匯出檔是單純的歌曲陣列、沒有歌詞，匯入時保留這台裝置原有的歌詞
    const nextSongs = Array.isArray(data) ? data : data?.songs;
    const nextLyrics = Array.isArray(data) ? lyrics : data?.lyrics ?? {};
    if (!validSongs(nextSongs) || !validLyrics(nextLyrics)) throw new Error('Invalid data');
    if (!confirm('確定匯入？這台裝置目前的歌單與歌詞會被檔案內容取代。')) return;
    songs = nextSongs;
    lyrics = nextLyrics;
    if (saveLyrics() & save()) notify('已匯入 ' + songs.length + ' 首歌，其中 ' + songs.filter(song => lyrics[song.id]).length + ' 首有歌詞。');
  } catch { notify('匯入失敗：這不是本網頁匯出的歌單檔。這台裝置的資料沒有變動。'); }
};
document.querySelector('#smaller').onclick = () => setSize(size - 3);
document.querySelector('#larger').onclick = () => setSize(size + 3);
document.querySelector('#lyrics-edit').onclick = () => {
  lyricsForm.elements.text.value = lyrics[current.id] ?? '';
  lyricsForm.hidden = false;
  lyricsText.hidden = true;
  lyricsEmpty.hidden = true;
  lyricsForm.elements.text.focus();
};
document.querySelector('#lyrics-cancel').onclick = () => showLyrics(current);
lyricsForm.onsubmit = event => {
  event.preventDefault();
  const text = lyricsForm.elements.text.value.replace(/\r\n?/g, '\n').trim();
  if (text) lyrics[current.id] = text;
  else delete lyrics[current.id];
  if (saveLyrics()) notify(text ? '歌詞已儲存於這台裝置。' : '已清除這首歌的歌詞。');
  showLyrics(current);
  render();
};
window.onhashchange = () => { status.hidden = true; route(); };
document.onvisibilitychange = () => { if (current && document.visibilityState === 'visible') keepAwake(); };
lyricsText.style.fontSize = size + 'px';
render();
route();
navigator.serviceWorker?.register('sw.js').catch(() => {});
