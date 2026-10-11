# Leo 歌單

純靜態網頁，直接開啟 index.html 或部署至 GitHub Pages，無建置步驟。

預設資料在 songs.js。匯出的 Leo歌單.json 是完整 JSON 文字陣列，可人工檢查後更新 songs.js 中的 window.DEFAULT_SONGS。

編輯內容只存在目前瀏覽器的 localStorage，不會跨裝置同步。清除瀏覽器資料會刪除修改，請先匯出備份。已儲存的歌單會優先於日後更新的預設資料；需要更新時可先匯出，再還原預設。

驗證：node --test test.cjs
