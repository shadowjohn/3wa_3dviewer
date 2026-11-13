# 格式與光影任務盤點

盤點日期：2026-11-12；基準：main `37136b2`；環境：公司 john。
本次只列 tasks，不實作新格式、不修改渲染、不發布。PLAN.md 保留初版歷史範圍；後續擴充以此表追蹤。

## 完成度定義

不以主觀百分比冒充驗收。採用「未實作」「部分實作」「已實作／限定範圍已驗證」，並將本次實測與歷史紀錄分開。
「已有候選套件」不代表本產品支援；STEP 與 STP 是同格式別名，不重複算成果。沒有宣稱任何格式全規格相容。

## 逐格式現況

| 格式 | 完成度（非百分比估計） | 已有能力及驗證證據 | 尚缺／邊界 |
| --- | --- | --- | --- |
| DGN | 未實作 | 沒有入口、解析器或樣本測試 | 分 V7/V8、2D/3D、cell/reference、單位；先授權與樣本評估 |
| DWG | 未實作 | 沒有入口、解析器或樣本測試 | 版本、字型、xref、proxy entity、3D solid；先選合法離線轉換路線 |
| IFC | 未實作 | 沒有入口或 IFC 引擎 | 幾何、樓層/構件、屬性、單位、大座標；不能把看到網格等同完整 BIM |
| DXF | 未實作 | 沒有入口或 parser | 先 2D 基本圖元/圖層，再 block、文字；3D solid 另評估 |
| B3DM | 部分實作；本地幾何已驗證 | core.unpackB3dm：v1 28-byte header、內嵌 GLB、RTC_CENTER；VALIDATION.md 有標準與 Cesium 樣本紀錄 | 不處理 tileset.json、tileset transform、地理定位、batch picking、舊 20/24-byte header |
| glTF | 已實作；限定範圍已驗證 | 2.0；同目錄/子目錄 bin、貼圖安全內嵌；單元與歷史 packaged smoke | 非所有 extensions；不允許網路 URL/路徑逃逸；本次未重做 glTF 視覺驗證 |
| GLB | 已實作；限定範圍已驗證 | 2.0；Draco、Meshopt、KTX2/Basis、WebP；歷史 RC390/燈具實際渲染與 smoke | 非所有擴充與大檔保證；本次 GLB 視覺複驗尚待完成 |
| FBX | 未實作 | node_modules 有 Three.js FBXLoader，但產品未接入 | 格式版本、骨架動畫、材質/貼圖、座標單位、外部資源安全 |
| OBJ | 已實作，待視覺驗證 | OBJLoader/MTLLoader + 本地安全依賴預載，解析測試通過 | 貼圖解碼／中文路徑／大檔視覺驗證待完成；不宣稱所有 MTL 方言相容 |
| STEP | 未實作 | 沒有 CAD kernel/轉換器 | B-rep 三角化、誤差/單位/顏色/組裝樹、大檔 worker；不是 CAD 編輯器 |
| STP | 未實作 | STEP 別名，尚無入口 | 與 STEP 共用 loader，別名也要獨立開檔驗收 |
| STL | 已實作，待視覺驗證 | ASCII/binary STLLoader，無效/截斷輸入拒絕測試通過 | 真實大檔與法線／方向視覺驗證待完成；無通用貼圖 |
| VRM（已有額外格式） | 已實作；預覽版限定範圍已驗證 | 0.x/1.0、MToon；VRM.md 歷史驗證；本次公司實際看見 VRM0 Alicia Solid 正常全身與材質 | 本次 VRM1/互動複驗未完；無表情控制、追蹤或外掛動作功能；未發布新版 Release |

本次已重新通過 17 項單元測試、build、獨立 portable VRM preview 打包。這不等於逐格式視覺驗收。
公司 UI 複驗遇到使用者輸入即停止，不將未看見的 VRM1、GLB 畫面記成通過。舊證據見 VALIDATION.md、VRM.md。
實作依據：src/core.cjs 的 SUPPORTED、src/main.cjs 開檔 filter、src/viewer.js 的 GLTFLoader/decoder/VRM plugin；現有入口只有 glb/gltf/b3dm/vrm。

## 候選路線、難度與授權閘門

下列難度是工程評估，不是進度、工時或支援承諾。未安裝任何新格式依賴。

- **OBJ / STL（較低）、FBX（中）**：優先既有 Three.js addon，MIT，保留授權。FBX 官方載明 ASCII >=7.0、binary >=6400，部分 morph normals 尚不足。不要為讀檔擴大 renderer Node 權限或允許任意 URL。[Three.js FBXLoader](https://threejs.org/docs/pages/FBXLoader.html)、[LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)。
- **DXF（中高）**：候選 dxf-parser，MIT；解析與畫出是兩個步驟。官方列多數 2D 圖元、圖層、blocks/insert、文字，不支援 3DSolids，不能當完整 DWG 替代。[官方說明](https://github.com/gdsestimating/dxf-parser)。
- **IFC（高）**：候選 web-ifc WASM，MPL-2.0；需核對選定版本/來源、保留 notices，發布修改過的 MPL 檔案時處理對應原始碼義務，不直接改整個產品授權。schema/geometry 覆蓋以樣本驗證。[官方專案](https://github.com/ThatOpen/engine_web-ifc)。
- **STEP/STP（高）**：候選 occt-import-js，官方提供 STEP 三角化與單位/誤差參數，LGPL-2.1。需另檢視所帶 OCCT 與依賴授權、WASM 再散布/替換與源碼義務，確認後才納入 release。[官方專案](https://github.com/kovacsv/occt-import-js)。
- **DWG（高，授權先行）**：LibreDWG 是 GPLv3+，官方說部分較新進階物件會略過；不能把「可讀版本」當完整保真。另可評估 ODA Drawings 商用 SDK；未核准採購或簽任何條款。不因外掛/獨立程序就推定豁免 GPL 義務。[LibreDWG](https://github.com/LibreDWG/libredwg)、[ODA](https://www.opendesign.com/products/drawings)。
- **DGN（高，版本先行）**：GDAL 舊 DGN 路線僅部分圖元，complex/cell 語意會損失；DGNv8 driver 依賴非開源 ODA Teigha。GDAL 可讀不等於完整 3D CAD renderer。與 DWG 一起先決定接受轉檔或付費引擎，保真不足要明示。[DGN](https://gdal.org/en/stable/drivers/vector/dgn.html)、[DGNv8](https://gdal.org/en/stable/drivers/vector/dgnv8.html)。

以上為技術/合規初步篩選，不是法律保證；鎖版本後逐依賴確認再散布條件與樣本使用權。私人模型不進 Git，不上傳外部轉檔服務。

## 可執行 backlog

每項完成後記錄 commit、樣本來源、測試指令、畫面與未支援情況；只有符合驗收才能打勾。

### P0：基線與共同入口
- [x] BASE-01 核對公司 main 37136b2、現有 loader、測試與限制，完成逐格式盤點。
- [ ] BASE-02 補公司 VRM1、GLB 視覺複驗及旋轉/縮放/材質切換，記錄與原版對照。
- [ ] DEPTH-01 調查近表面圖案閃爍：frame() near=radius/10000、far=radius*1000 深度比達 1e7；RC390 worker 回報其他較窄裁切範圍預覽正常。這是待實測假說，不直接更改；比較近距檢視、遠裁切、圖案共面與 GPU 深度精度，避免裁掉模型。
- [ ] CORE-01 設計格式 adapter，統一 main IPC、選檔/拖放/CLI、資訊、錯誤、dispose；不僅增加副檔名。
- [ ] CORE-02 統一附件 containment、symlink/UNC/URL 拒絕、檔案/資源總量限制、取消與進度；較重解析放 worker/受控程序，不阻塞 UI。
- [ ] CORE-03 每格式建立有效/毀損/中文空白路徑/大小寫/缺附件樣本矩陣；打包後離線 smoke 與真人可見畫面驗收。

### P1：先可用的模型格式（建議順序，未開始實作）
- [ ] OBJ-01 接 OBJ 幾何、群組與法線，無 MTL 仍可白模；驗收幾何與框景。
- [ ] OBJ-02 MTL/貼圖安全載入，缺檔明確提示；實際 PBR 差異不得宣稱原樣還原。
- [ ] STL-01 binary/ASCII、法線與白模、單位提示；驗收兩種檔與壞檔。
- [ ] FBX-01 可支援版本的靜態網格、嵌入/旁置貼圖、Y/Z-up/比例；先不承諾所有 DCC shader。
- [ ] FBX-02 骨架/動畫、重複載入釋放、缺貼圖與不支援版本；與來源工具截圖比較。

### P2：工程格式
- [ ] DXF-01 ASCII DXF 2D line/polyline/arc/circle、圖層、正交俯視；列 unsupported entity 清單。
- [ ] DXF-02 block/insert transform、文字/字型與編碼、單位；3D solid 另列未支援，不靜默丟失。
- [ ] IFC-01 鎖 web-ifc 版本/授權，WASM 離線 worker proof-of-concept、IFC2x3/IFC4 合法樣本與記憶體基準。
- [ ] IFC-02 幾何、構件/樓層樹、單位/大座標、屬性唯讀；大檔取消/進度，先不作 BIM 編輯。
- [ ] STEP-01 決定 OCCT/WASM 打包授權，單體/組裝測試、單位、三角化精度選擇。
- [ ] STEP-02 接 .step 與 .stp，顏色/零件樹、進度/取消與失敗恢復；測兩副檔名，無須重寫兩套。

### P3：研究閘門及 B3DM 擴充
- [ ] DWG-01 用使用者代表性檔案確認版本/圖元/字型，試評估 LibreDWG vs ODA 的完整性與再散布條件；未決前維持不支援。
- [ ] DGN-01 分 V7/V8、2D/3D、reference/cell 測試，決定引擎與授權；有限轉換須顯示遺失清單。
- [ ] CAD-01 若採轉換程序：固定白名單執行檔/參數、超時/取消、隔離暫存、離線與毀損檔測試；不自動下載執行未知 converter。
- [ ] B3DM-01 先補現有標準 v1 大座標/RTC binary/錯誤表長度視覺與單元驗收。
- [ ] B3DM-02 完整 tileset、地理定位/transform、batch feature picking 另立里程碑；不混稱現有 b3dm 全支援。

## 自然太陽光 / 陰影 / 方向

**現況：全部新控制未實作。** 目前只有 RoomEnvironment/PMREM 環境、HemisphereLight、曝光；avatarLight 是僅 VRM 顯示的固定 DirectionalLight，不是可控制的自然太陽光。未見 shadowMap/castShadow/receiveShadow 或陰影 UI。

建議先做視覺日光，不包含依經緯度/日期計算真實太陽；模型沒有北向基準時，以 viewer 座標標示，避免誤稱地理方位。日光可用 DirectionalLight，但方向由 position/target 決定，不是 rotation。[官方文件](https://threejs.org/docs/pages/DirectionalLight.html)。

- [ ] LIGHT-01 日光獨立開關；預設維持舊視覺，關閉後完整還原，強度與色溫/色彩可調。
- [ ] LIGHT-02 方位角 0–360°、仰角、方向提示與重設；定義 0° 對應軸與模型方向校正後行為，不能只改 light.rotation。
- [ ] LIGHT-03 陰影獨立開關、接影地面與地面格線分開；只影響檢視，不改寫模型材質/檔案。
- [ ] LIGHT-04 開 renderer shadowMap、投/接影旗標、依包圍盒適配 shadow camera；bias/normalBias、防 acne/漂浮/裁影；保留透明件與雙面材質測試。
- [ ] LIGHT-05 陰影品質檔位、解析度/效能保護、停用釋放資源；以實測 FPS/記憶體報告，不保證所有 GPU 同速。
- [ ] LIGHT-06 與環境照明、曝光及 VRM MToon 驗證；unlit/烘焙陰影材質不會自然重新打光，UI 說明，不偷偷替換材質。
- [ ] LIGHT-07 同一模型同鏡位比較開/關、三方向、陰影、灰模/PBR/VRM、大小尺度與重複載入；保存視覺基準，確保關閉回到原狀。

## 發布門檻
- [ ] REL-01 每新增格式/光影完成後同步 README 狀態，不以 checkbox 數量推算百分比。
- [ ] REL-02 逐依賴 notices、再散布義務、樣本權利檢查；不混入私人模型/設定。
- [ ] REL-03 全既有 GLB/glTF/b3dm/VRM regression、離線 packaged smoke、視覺確認、版號/Release 對照；得到發布指示才簽入/發布。

## 後續候選（未實作，版本／授權待核）
- [ ] PLY：普通網格／點雲已實作與單元驗證，待視覺；Gaussian Splat PLY 另案，尚未支援。
- [ ] PCD：點雲、色彩／強度與大檔策略。
- [ ] 3MF：壓縮容器安全、單位、多物件與材質。
- [ ] DAE：1.4.x 安全子集已實作與單元驗證，待軸向/動畫/貼圖視覺驗證。
- [ ] LAS/LAZ：分階段點雲解碼、座標／精度與串流。
- [ ] tileset.json：整套 3D Tiles 階層與資源，不等同現有單一 b3dm。
- [ ] 3DM：版本、曲面三角化及授權評估。

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

### TILESET-01：直接選 tileset.json（待實作）
- [ ] 只接受明確選取且通過 asset/root/boundingVolume/geometricError schema 驗證的 tileset；不把所有 .json 註冊關聯。
- [ ] 安全本機資源 broker：基準為所選目錄、realpath 越界阻擋、拒絕網路 URI，nested tileset 循環/深度/總數/快取限額。
- [ ] 正確累積 column-major transform、bounding volume、geometric error、ADD/REPLACE 與相機 screen-space error LOD；取消舊請求並釋放 GPU 資源。
- [ ] 分階段支持 glb/b3dm tile，i3dm/pnts/cmpt/implicit tiling 明確拒絕或後續實作，不假裝完整 3D Tiles。
- [ ] 用兩層實際樣本檢查父子 transform、LOD、缺檔、循環、越界、過大宣告；README 列實測版本。

### SKP-01（調查，未實作）
官方 C API 可直接讀寫 .skp，Windows64 原生程式需 SketchUpAPI.dll、SketchUpCommonPreferences.dll 與 VC++ runtime；API 主執行緒限制。它不是現有 Three.js loader，需原生 helper 或合法轉檔流程。未查得本次可採用的完整 SDK 散布授權條款，因此不打包/不宣稱可自由再散布。
來源：https://extensions.sketchup.com/developers/sketchup_c_api/sketchup/index.html （2026-11-12 查證）
- [ ] 取得/閱讀官方 SDK 散布協議，確認商用/離線/redistribution 條款後再決策。

### TILESET implementation update
- [x] Explicit local tileset entry and non-blanket JSON association behavior.
- [x] Bounded hierarchy preload, safe dependency boundary and explicit unsupported diagnostics.
- [x] Renderer transform/RTC/Y-up conversion and ADD/REPLACE SSE selection unit tests.
- [ ] Native visual validation with parent/child material and geometry differences; real sample verification.
- [ ] Region/ECEF local tangent frame, streaming/frustum/cache and large datasets remain unsupported.
