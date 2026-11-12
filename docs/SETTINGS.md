# 設定、關於與工作版

## 檔案關聯
- 設定僅列目前實作的 GLB/glTF/b3dm/VRM/OBJ/STL/PLY/DAE，預設不勾選；可全選、清除或個別選擇。
- 確認只註冊所選類型的 HKCU OpenWith 候選，不改 UserChoice/hash、不強制改預設。
- Windows 預設應用程式仍由使用者選擇；顯示註冊成功不代表預設已變更。取消不套用。
- 開發 Electron 模式禁止註冊；工作版路徑固定後不必每次更換候選路徑。

## 關於
- 版本、作者：阿寶、出張嘴：羽山秋人（https://3wa.tw），另列 GitHub 官網文字連結。
- 檢查更新與關閉同列靠右；查詢時不定量進度條，不編造百分比。
- 成功與失敗都停止進度、顯示結果並可重試；不自動安裝。
- 兩個網站的 IPC 只開固定 URL，不接受任意網址。

## 驗證與限制
- 自動測試包含關聯白名單/命令邊界、更新 pending/成功/失敗、作者/網站內容與 PE 產品名稱。
- EXE FileDescription/ProductName 已改 3wa_3dviewer；原 Electron 圖示尚保留，工作版未簽章。
- 使用者正在操作桌面時不搶焦點；本批 native UI、實際 OpenWith 名稱刷新及新增格式視覺驗證仍待完成。
- 沒有改 Windows 預設程式或替使用者勾選其他副檔名。

## 打包
`npm run package:working` 固定更新 `release/3wa_3dviewer-working-win-x64`，檢查工作版未執行、保留 portable-data。正式發行仍走版本目錄且禁止覆寫，不自動發 Release。
舊 preview 可重建程式已移回收站；portable-data 另備份，仍被 Windows 開啟方式引用的舊包保留，避免雙擊失效。
