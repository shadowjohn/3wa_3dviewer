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

## 部位註記

桌面開啟 GLB，輸入 1–80 字純文字，按「選取模型表面」再點指定部位，最多 4 則。按 Esc 取消選取。「移除最後一則」可逐則復原；換模型會清除本次註記，不修改 GLB。桌面另選右側 GLB 時，已點的註記屬於主要模型；MCP 可分別指定左右。

`capture_model_views`（PNG）與 `record_model_turntable`（MP4/GIF）均接受 `notes`，例如 `[{"text":"前輪固定座","point":[0,0.8,1.2],"pane":0}]`。座標是各 GLB 自己根節點的 [X,Y,Z]，不是螢幕像素；單圖的 pane 只接受 0，並排接受 0/1。匯出會將線和泡泡燒進畫面，超出視野或被自己的模型遮住時不顯示。不解析 HTML、沒有點擊連結、不上傳。遇到兩重疊泡泡會嘗試改放，空間仍不足則優先顯示先設定的註記。註記以模型根節點為參考，不追個別骨架關節的變形。

定時字幕與部位註記獨立。桌面「旋轉錄影」可填一則字幕及顯示／結束秒數；留白不加字幕，結束留白可顯示至錄影結束。MCP 的兩個工具均接受 `captions: [{"text":"材質比較","start":0.6,"end":1.4}]`，最多 6 則，每則 1–80 字；時間不重疊，含起始、不含結束。錄影依輸出幀時戳顯示，切換不會延長影片；GIF 的字幕依 0.01 秒幀延遲判定。PNG 可另指定 `captionTime` 選擇截圖時刻（預設 0 秒）。字幕固定在畫面底部，沒有 HTML 或連結行為。

完整本機查核：`npm run build` 後跑 `node scripts/test-model-notes.cjs`；會逐像素核對 PNG 正背面及字幕時刻，和並排 MP4/GIF 註記遮蔽、字幕起訖。

## 旋轉錄影 MP4 / GIF
桌面開啟 GLB 後按「旋轉錄影」，可選水平／垂直一整圈，或再選右側 GLB 形成左右比較。兩邊以各自中心取景，以較大的模型定出同一個相機距離，保留模型單位間的相對比例；沒有自動對齊模型的前方或校準真實單位。只錄 3D 畫布，不含操作面板、參考圖層、地板格線或聲音。桌面沿用視角方向、視野、模型旋轉、背景、材質、曝光；另行取景以保證整圈不裁切，原視窗及模型檔不受修改。

MCP：`record_model_turntable` 的 `modelPath` 和可選的 `secondModelPath` 都須在既有允許的本機 GLB 根目錄內。傳入 `axis: "horizontal"` 或 `"vertical"`，`seconds` 預設 5，介於 1 至 20 秒且須對齊 30 fps 的整數幀；`format` 省略為 `mp4`，或指定 `gif`。回傳 `file`、`format`、`seconds`、`requestedSeconds`、`frameCount` 等；不回傳影片內容、不上傳。影片會用新名字寫入本機暫存資料夾。

水平繞世界鉛直軸，垂直繞起始視角右軸（可過頂、過底）；兩種格式都不重複最後角度。MP4／H.264 是預設，逐幀固定 30 fps，5 秒為 150 幀，單畫面 640×480、左右 1280×480。GIF 無限循環，約 15 fps、5 秒為 75 幀，單畫面 480×360、左右 960×360，採 128 色調色盤控制大小；GIF 幀延遲以 0.01 秒為單位，總秒數四捨五入到最接近的 0.01 秒。需要電腦已安裝且 PATH 可找到 FFmpeg（MP4 另需 libx264）；本工具不安裝、不攜帶外部執行檔，也不改用 WebM。桌面輸出選擇支援硬連結的本機檔案系統（如 NTFS）以確保完成後才發布且不覆蓋現有檔案。

完整本機測試：`npm run build` 後跑 `node scripts/test-turntable.cjs`（需 ffmpeg／ffprobe），檢查 MP4／GIF 各四種模式的幀數、長度、GIF 循環標記及兩個畫面是否實際繪製。

## Portable 20261116.001

可見視窗與 MCP server 是不同入口。直接啟動 `3wa_3dviewer.exe` 可看模型；stdio MCP 使用已安裝的 Node.js 執行 `resources/app/scripts/mcp-server.cjs`，後面傳入明確允許的模型絕對根目錄。Server 會啟動封裝內的 viewer 進行隔離截圖，portable 不需要開發目錄的 Electron npm 套件。參考照預設禁用，須明確指定 `--reference-root=...`。打開視窗不代表 MCP 已註冊或已出現在 AI 客戶端工具清單。本版尚未發佈 GitHub。

## 場景導演

`record_director_scene` 可將同一場景中的多個 GLB、獨立物件軌跡與各註記時間範圍錄成 MP4。參見 [場景導演](DIRECTOR.md)。

## Scripted camera path (MCP)

`record_model_camera_path` exports a silent H.264 MP4 for one allowed local GLB. It
does not edit the GLB or alter the viewer's current camera. It has no collision
detection: use an actual opening for a doorway tour, or deliberately pass through
the mesh for a cutaway shot. It uses the same existing FFmpeg and offline capture
pipeline as turntable, with the same optional `notes` and `captions`.

Provide 2–48 `keyframes` with `time`, `position`, `lookAt`, and `fov`. XYZ is
relative to the model bounding-box center, in units of its bounding sphere radius
(Three.js Y-up; each component from -12 to +12). FOV is vertical, 10–100°.
Time starts at 0, strictly increases (at least 1/30 second apart), and the last
time determines the duration, 1–20 seconds in 30 fps increments. Position, look
target and FOV interpolate linearly. Frames sample from time 0 up to but excluding
the final endpoint, keeping the exact duration. Add intermediate points to arc
around a model instead of cutting across it. A path that aims through its own
camera position is rejected.

```json
{
  "modelPath": "D:/work/assets/doorway.glb",
  "keyframes": [
    {"time":0, "position":[0,0,3], "lookAt":[0,0,-0.7], "fov":45},
    {"time":2, "position":[0,0,-0.3], "lookAt":[0,0,-0.7], "fov":63}
  ],
  "captions": [{"text":"Entering the room","start":0.5,"end":1.5}]
}
```

## Public E8 demo capture

Choose an item under **核准的 E8 圖台** and click **開啟圖台預覽**. The
default is the [public 3WA Ride ICC demo](https://3wa.tw/demo/php/3wa_ride/icc-preview.html).
Use its **擷取** menu to save a page PNG or a silent 10-second MP4. Start
the page's own **沿站側試走** control if you want movement in a desktop
recording. No model-viewer controls or system desktop are captured.

MCP tool `capture_public_e8_demo` launches a fresh anonymous preview and returns
local paths. Example arguments: `{"seconds":10,"snapshots":3,"motion":"ride"}`.
Use `motion:"still"` to keep the initial overview. Choose 0–10 whole seconds
and 0–3 PNGs (not both zero); recording is 1280×720 H.264, 10 fps, no audio.
Snapshots from a recording are spaced across its frames. Existing FFmpeg is
needed only for MP4. Local captures are never automatically uploaded.

The active preset fixes the target. This is not a general browser: no URL input or user-supplied
script, sign-in, prior browser session, or navigation to another page. The
sandboxed page has no desktop renderer bridge. HTTPS/TLS remains enabled and
network requests are restricted to the public E8 SDK, ICC assets and explicit
public vector/terrain tile sources on the same approved origin. If a future
demo changes its paths or tile provider, review the allowlist before updating it.

### Reviewed preview presets

Use the **核准的 E8 圖台** desktop selector, or list IDs with MCP
`list_approved_e8_presets`. `capture_public_e8_demo` accepts
`preset: "icc"` (default) or `preset: "icc-ramp"`. Both use fixed, distinct
navigation targets, reviewed dependencies, no credentials and no arbitrary
browser input. Diagnostics are limited to blocked host/category pairs.
The 3wa ICC scenes use 3wa resources. Two separately reviewed Focusit
HTTPS origins allow tile-shaped XYZ or WMTS GetTile requests only, never
used as navigation targets.

The built-in registry is source-maintained, not browser- or MCP-editable.
The loopback declaration type is opt-in, requires an exact literal
localhost / 127.0.0.1 / [::1] URL with explicit port and path, and has a
separate same-origin exact resource list. No local preset is bundled
until an exact page is selected and reviewed. Public presets cannot
cross into loopback, and local presets cannot fetch public or LAN destinations.
