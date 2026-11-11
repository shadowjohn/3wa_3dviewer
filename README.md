# 3WA 3D Viewer — 20261111.001

Windows x64 portable 模型檢視器。開啟自己的模型，不拿範例取代失敗檔案，不上傳模型。

## 使用

保留 portable 資料夾完整內容，啟動 **3wa_3dviewer.exe**，點「開啟模型」或拖入檔案。支援 GLB 2.0、glTF 2.0 和標準 b3dm v1 封裝。OBJ / FBX / STL / STEP 不在這版範圍。

要雙擊檔案直接看：Windows 右鍵模型 → 開啟方式 → 選擇其他應用程式 → 瀏覽至本程式 exe → 選「一律」。程式不偷偷取代現有預設。可選執行同目錄 Register-OpenWith.ps1 加入 .glb/.gltf/.b3dm 候選；Unregister-OpenWith.ps1 可撤銷。搬動資料夾後需重新選擇 exe 路徑。

命令列：`3wa_3dviewer.exe "D:\models\my model.glb"`。再次啟動會在既有視窗讀入新檔。

左鍵旋轉、滾輪縮放、右鍵平移、F 完整框景、Ctrl+O 開檔。可切換材質 / 灰模 / 線框、六方向、曝光、背景、格線、動畫。X+90° 可把躺著的模型轉正。所有操作只影響檢視，不改寫模型。

## 格式與限制

- 內附 Draco、Meshopt、KTX2/Basis 解碼器；支援 WebP、標準 PBR 與常見 glTF 材質擴充。
- 已測 Draco、EXT_meshopt_compression、KHR_mesh_quantization、WebP、KTX2/BasisU；不是宣稱所有 glTF 壓縮/材質擴充都支援。未知必要擴充會明確報錯。
- GLB 必須內嵌資源。glTF 可讀取同目錄及子目錄的外部 .bin / 圖片；阻擋越界、外部連結、網路 URL。網路分享檔案請先複製至本機。
- b3dm 支援 28-byte 標準 v1 header，解析 feature/batch table 後讀取內嵌 GLB；RTC_CENTER 保留為資訊，檢視以模型中心為原點。不套用未知 tileset transform、不顯示完整 Tileset、不做地理定位、不提供 batch feature 選取。舊式非標準 header 不支援。
- 大模型受 RAM / GPU 限制；單檔與外部資源合計上限 1 GB，但不保證所有 1 GB 模型皆能流暢開啟。glTF 外部資源整合會暫時使用較多記憶體。
- 六方向使用 glTF 的 Y-up / +Z-front，不猜測生成器的車頭方向。
- PNG 截圖包含控制面板。
- 內含 Chromium，不需要額外 .NET / WebView2；代價是 portable 包較大。快取放 portable-data；目錄不可寫時用一般使用者快取位置。
- 未簽章自製程式可能顯示 Windows 來源提示，不要因此停用防護。

## 檢查更新

介面顯示 **20261111.001**。「檢查更新」只有按下時才查詢本專案 GitHub Releases；可開啟官方版本頁，由使用者自行下載/解壓。沒有自動下載、安裝或背景更新。離線/限流/尚無 release 會明確提示，不影響模型檢視。

## 開發與發佈

Node.js 24：`npm ci` → `node node_modules/electron/install.js` → `npm test` → `npm run build` → `npm start`。

測試：`node scripts/fetch-fixture.mjs`、`node scripts/fixtures.mjs`、`node scripts/smoke.cjs`。官方 Khronos KTX2 樣本只用於測試，不進 Git / release。

`npm run package` 產生版本化 portable 資料夾，不覆寫既有 release。產品版號在 src/version.cjs（日期.流水號），npm package 保留合法 SemVer 0.1.0。tag 必須與產品版號一致。

GitHub Actions 在版本 tag 推送後執行單元測試、生成標準/壓縮樣本、Windows portable 封裝、packaged smoke、ZIP / SHA256，成功後建立 release。程式原始碼與建置步驟在 repo；release 是可用包。

## 安全與授權

Electron sandbox / contextIsolation 開啟，renderer 無 Node 權限、模型網路請求被阻擋；更新 API 只在明確點擊時由主程序呼叫固定 GitHub endpoint。主頁 CSP 不允許 unsafe-eval；官方 Basis 解碼器在固定本機 worker 內執行。

原 repository LICENSE 保留。Electron、Three.js、Draco/Basis 的授權檔隨 package 保留。測試與相容性證據見 docs/VALIDATION.md。

## VRM local preview

VRM 0.x / 1.0 support is available in this working tree. See [VRM notes](docs/VRM.md) for scope, samples, and local preview packaging. This change has not been published.
