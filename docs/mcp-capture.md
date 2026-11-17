# 3WA 3D Viewer MCP：模型體檢與圖片比對

## 已有能力

- `inspect_model`：唯讀 GLB/VRM，不啟動 GPU；回傳 SHA-256、來源 mesh 面數、節點／材質／動畫名稱、內嵌圖片數與擴充資訊。來源授權未提供就明示，不推定可公開。貼圖尺寸目前標示未檢查。
- `capture_model_views`：六固定視角或自訂鏡位，原圖、3×3／4×4 格線、局部裁圖、本機參考圖並排；回傳 PNG 與證據目錄。只觀察，不修改模型。
- 截圖回報實際場景包圍盒與尺寸（模型單位，非確認的真實公尺）、相機位置／觀看中心／FOV／投影與世界矩陣。

## 本機設定

已在家用 Codex 註冊 `threewa_3dviewer`，stdio，允許根目錄僅 `D:\mytools\3wa_3D_Assets`。本次不重啟 Codex，也沒有開 HTTP/TCP 服務、建立憑證或改 sandbox。

```json
{"command":"C:\\Program Files\\nodejs\\node.exe","args":["D:\\mytools\\3wa_3dviewer\\scripts\\mcp-server.cjs","D:\\mytools\\3wa_3D_Assets"]}
```

阿寶／谷寶寶的 MCP 客戶端都須各自讀入 stdio 設定；目前真正驗證的是直接 MCP 協定端到端呼叫，不代表兩個 AI 客戶端都已熱載入。若客戶端有工具逾時設定，單次建議至少 120 秒；server 在 95 秒內終止、不盲目重試。

## 體檢

```json
{"modelPath":"D:\\mytools\\3wa_3D_Assets\\vehicles\\kymco-quannon-150-fi\\glb\\quannon150-v1.glb"}
```

## 自訂鏡位＋格線＋局部圖

```json
{
  "modelPath":"D:\\mytools\\3wa_3D_Assets\\vehicles\\kymco-quannon-150-fi\\glb\\quannon150-v1.glb",
  "forwardAxis":"-Z",
  "views":["custom"],
  "camera":{"azimuth":28,"elevation":12,"distanceScale":0.85,"fov":42,"targetOffset":[0,0,0]},
  "width":960,"height":720,
  "grid":3,
  "crop":{"x":0.25,"y":0.2,"width":0.5,"height":0.6},
  "background":"light","material":"original",
  "returnImages":"all"
}
```

- azimuth 方位角 ±180°，elevation 仰角 ±89°，fov 10～100°。
- distanceScale 為自動全景取景距離的倍率 0.1～10；targetOffset 三軸以模型包圍球半徑為單位，各 ±2。可放大看車殼／輪胎，不代表自動辨認部件。
- 酷龍 v1 車頭為 **-Z**，必須指定 `forwardAxis:"-Z"`；預設 +Z 只是 glTF 座標慣例，不猜實車前後。視角 left/right 也隨 forwardAxis 轉向。
- crop 是畫面左上起算的正規化矩形，不可越界。原圖不覆蓋；裁圖與格線圖另存。
- 格線用 A1、A2…標區塊，方便說明，不是測量座標。
- material 可選 original／clay／wire；background 可選 dark／light。
- 不填 camera 時預設六視角；填 camera 時預設 custom。固定視角不套用自訂 camera。

## 參考圖並排

參考照預設不開放；須以啟動參數 `--reference-root=已明確允許的圖片資料夾` 獨立指定，可重複指定多個。現有家用註冊未擴大圖片讀取權限。設定後額外傳 `referencePath`（圖片白名單根目錄內 PNG/JPEG）與 `referenceNote`（來源／授權／說明）。不擷取網站圖片，不讀白名單以外路徑，不自動上傳或納入 git。

目前是左參考、右模型，保留比例置中。透過調整模型相機去配合照片角度；沒有自動辨識焦距、透視校正、畸變修正或尺寸測量。任意照片不一定能由單一模型鏡位完美重合。使用者仍須確認參考照片是否可分享；本機有檔案不是公開授權。

## 證據與重拍

每次獨立建立 `%TEMP%\3wa-viewer-capture-*`，保留：

- `custom.png`／`front.png` 等原圖，精確指定像素。
- `*-grid.png`、`*-crop.png`、`*-compare.png`（按需求產出）。
- `manifest.json`：模型 hash、時間、要求參數、實際像素、相機矩陣、包圍盒、照片 hash／來源註記。
- `inspection.json`、`camera-preset.json`。

重拍時將 camera-preset 的欄位合併進新請求，另指定明確 `modelPath`；參考照路徑不存進 preset，需再次指定。hash 改變會警告，需先看尺寸／原點是否改變。模型在截圖過程遭修改會報錯，不把不同版本混成同一證據。

鏡位可重現，已驗證窄 FOV／直式畫面／10 倍距離不被控制器夾限；但不同 GPU／驅動或 WebGL 舍入不保證像素逐 bit 相同。已觀察相同矩陣重拍只差 1 色階的少數像素；非精密測量用途。

`returnImages` 可選 all／original／none，none 只回報檔案位置；inline 圖片總量上限 24 MiB，超過仍留在證據目錄。證據沒有自動上傳、push 或清除。

## 安全與限制

- 模型根目錄 realpath/junction 邊界檢查；僅本機完整 GLB/VRM，256 MiB 上限，不讀外部資源。
- 參考照採獨立白名單，16 MiB／24 百萬像素上限，PNG/JPEG 尺寸先查再解碼，不接受 SVG/URL。
- 相機和裁圖參數有界；沒有任意 JS／shell／輸出路徑參數。
- 隔離 sandbox Electron、封鎖網路、獨立快取，不操控 Blender 或使用者 viewer。
- 每個 server 上限 8 筆在途／排隊要求，取消排隊請求不會啟動渲染，stdin 關閉後停止後續工作；不同 AI 客戶端同時發動仍可能並行佔 GPU，現階段請錯開批次。暫不做無界大批次／影片。
- 原始照片不額外複製進證據，但並排圖會含照片內容，分享前仍須審查。
- 已建立本機 portable 20261116.001，尚未發佈 GitHub，也未完成所有 AI 客戶端的工具載入驗證。

## 測試

`npm test`、`npm run build`。

真實 stdio 整合驗證：

```
node scripts/test-mcp-evidence.cjs "D:\models\example.glb" "D:\models"
```

此 QA 會用模型截圖作合成參考圖（不是實車照片），驗證相同鏡位、不同角度、3/4 格線、局部圖、並排及安全負例；像素比較使用現有 Python Pillow，產品 runtime 不需要 Python。

## Portable 20261116.001

可見視窗與 MCP server 是不同入口。直接啟動 `3wa_3dviewer.exe` 可看模型；stdio MCP 使用已安裝的 Node.js 執行 `resources/app/scripts/mcp-server.cjs`，後面傳入明確允許的模型絕對根目錄。Server 會啟動封裝內的 viewer 進行隔離截圖，portable 不需要開發目錄的 Electron npm 套件。參考照預設禁用，須明確指定 `--reference-root=...`。打開視窗不代表 MCP 已註冊或已出現在 AI 客戶端工具清單。本版尚未發佈 GitHub。
