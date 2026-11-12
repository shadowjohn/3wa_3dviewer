# 3WA 3D Viewer — 20261111.001

Windows x64 portable 模型檢視器。開啟自己的模型，不拿範例取代失敗檔案，不上傳模型。

## 使用

保留 portable 資料夾完整內容，啟動 **3wa_3dviewer.exe**，點「開啟模型」或拖入檔案。支援 GLB 2.0、glTF 2.0 和標準 b3dm v1 封裝。本機開發預覽新增 OBJ（MTL／本地貼圖）與 STL（ASCII／binary）；FBX / STEP 尚未實作。

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

## 格式支援與完成度（2026-11-12 盤點）

本機設定預覽新增「設定 → 檔案關聯」與「關於」（版本、作者、阿寶、檢查更新）。勾選/全選只註冊 Open With 候選，Windows 預設仍需在系統介面選擇，詳見 [SETTINGS.md](docs/SETTINGS.md)。尚未發布。

以 `main 37136b2` 原始碼為準，**不是宣稱現有 Release 已新增所有格式**。初版上方列出的範圍仍是初版能力；以下擴充目前只列 tasks。
完成度採可核實狀態，不填推估百分比；「套件內有 loader」不等於本產品已支援。「已驗證」僅涵蓋所列樣本，不代表全規格相容。

| 格式 | 現在可開啟 | 完成度 | 驗證範圍／限制 |
| --- | --- | --- | --- |
| DGN | 否 | 未實作 | V7/V8 與引擎授權待評估 |
| DWG | 否 | 未實作 | 版本、xref、字型、solid 與授權待評估 |
| IFC | 否 | 未實作 | 幾何、構件屬性與 WASM 整合待做 |
| DXF | 否 | 未實作 | 先規劃 2D 圖元/圖層；不承諾 3D solid |
| B3DM | 有限 | 部分實作，限定範圍已驗證 | 標準 v1 28-byte header/內嵌 GLB；歷史 smoke/樣本通過；無完整 tileset/地理定位/batch picking |
| glTF | 是，2.0 | 已實作，限定範圍已驗證 | 本地 bin/貼圖、壓縮樣本有歷史測試；非全部 extensions；本次未重做視覺驗收 |
| GLB | 是，2.0 | 已實作，限定範圍已驗證 | RC390/燈具與 Draco/Meshopt/KTX2/WebP 有歷史驗證；本次視覺複驗未完 |
| FBX | 否 | 未實作 | Three.js loader 尚未接入本產品 |
| OBJ | 本機預覽可開 | 已實作，待視覺驗證 | OBJ/MTL/受限制本地貼圖；安全依賴與解析測試通過，未發布 |
| STEP | 否 | 未實作 | CAD kernel、三角化、單位/組裝與授權待做 |
| STP | 否 | 未實作 | STEP 別名，共用未來 loader，但需別名開檔測試 |
| STL | 本機預覽可開 | 已實作，待視覺驗證 | ASCII/binary 解析測試通過；STL 無標準貼圖與單位，未發布 |
| VRM | 預覽版可開 | 已實作，限定範圍已驗證 | 0.x/1.0 歷史驗證；本次公司已目視 VRM0 正常，VRM1/互動複驗未完；未發布新版 |

目前照明是環境光、曝光及 VRM 固定補光；**自然太陽光開關、方向調整、陰影控制均未實作**。
本次公司重跑 17 項單元測試與 build 通過，不將其冒充所有格式視覺驗收。
詳細分階段任務、候選技術、授權閘門及驗收條件見 [TASKS.md](docs/TASKS.md)；歷史證據見 [VALIDATION.md](docs/VALIDATION.md) 與 [VRM.md](docs/VRM.md)。

## 本機格式擴充進度（2026-11-12，未發布）
| 格式 | 完成度（可核實狀態，不以百分比推估） | 尚待 |
|---|---|---|
| OBJ | 實作：多邊形、MTL、同目錄/子目錄貼圖；單元與安全測試通過 | portable 實際貼圖/大檔視覺驗證 |
| STL | 實作：ASCII/binary 與內容/長度驗證 | portable 視覺驗證；不含標準單位/貼圖 |
| PLY | 實作：ASCII/little-endian/big-endian 一般網格/點雲，頂點色與法線；拒絕 Gaussian Splat schema | portable 視覺驗證；僅 vertex/face element |
| DAE | 實作：受限 COLLADA 1.4.0/1.4.1、相對本地貼圖；嚴格 XML 驗證 | portable 視覺、動畫/骨架/複雜材質相容性，不保證完整 COLLADA |
| tileset.json | 規劃，未實作 | 階層/transform/LOD/安全依賴與實際樣本 |
| SKP | 調查，未實作 | 原生 SDK 整合與散布授權確認 |

OBJ/STL/PLY 單檔上限256MB、DAE32MB；數量/列表/XML深度另有限制，外部相對資源總量1GB。遇缺檔/越界/不支援資源會報錯，不默默上網取材質。這些是防護與已測範圍，不是保證任意惡意檔安全。

## 統一工作版
使用 `npm run package:working`，固定輸出到 `release/3wa_3dviewer-working-win-x64/3wa_3dviewer.exe`。後續不再產生 r8/r9 等工作副本；更新前須關閉這個工作版，腳本發現它執行中會拒絕。`portable-data` 保留不覆蓋。正式 `npm run package` 仍採版本目錄且禁止覆寫；這次未發 Release。EXE 顯示名稱已烙入 PE 資源，但仍未申請程式碼簽章，Windows 舊的開啟方式清單可能快取舊名稱。
