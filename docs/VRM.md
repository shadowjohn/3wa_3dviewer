# VRM 本地預覽版

在原 20261111.001 基礎上加入 VRM，尚未發布新的正式Release。UI 尾端顯示 VRM preview。

## 使用

執行 `release/3wa_3dviewer-20261111.001-win-x64-vrm-preview/3wa_3dviewer.exe`，拖入 `.vrm`，或按「開啟模型」。命令列亦可傳入 VRM 路徑。
`Register-OpenWith.ps1` 已加入 `.vrm` 候選，需由使用者選擇 Windows 預設程式；本次沒有執行註冊或變更預設。

## 支援範圍

- pixiv 官方 `@pixiv/three-vrm` 3.5.5，離線打包，MIT；Three.js 0.187.0。
- VRM 0.x / VRM 1.0、MToon 材質、skinned mesh、VRM0 正面方向校正。
- 播放動畫選項也控制 VRM spring bones / node constraints 更新；沒有外加動作時維持模型原始姿勢。
- 資訊欄顯示角色名稱、作者及VRM版本，不執行metadata或開啟其中連結。
- 灰模、線框、框景、六方向、截圖及縮放沿用。
- 同時保留 GLB / glTF / b3dm。VRM使用原GLB檢查，拒絕外部資源；檔案不會上傳。

不是VTuber工具：尚未加入表情控制、動作重定向、VRMA/BVH匯入、攝影機追蹤、編輯或匯出。未宣稱支持所有自訂shader、VRM1草案版本或全部角色規格邊界案例。角色授權仍屬於原作者，程式不附帶測試角色。

## 驗證

- 17項Node單元測試通過。
- 官方VRM0 Alicia Solid（7.88MB、31798面）及官方VRM1 Constraint Twist Sample（10.78MB、36470面）在本機Electron實際載入、渲染、框景、縮放、灰模切換後還原。
- VRM0 / VRM1 均連續重載三次，GPU幾何與貼圖數穩定，已補MToon uniforms與骨架貼圖釋放。
- 樣本在被Git忽略的qa/fixtures，沒有加入發行包。
- 命令列及封裝smoke有驗證；Windows預設程式選擇器與實體雙擊未手動驗收。

官方樣本來源：
- https://github.com/vrm-c/UniVRM/blob/efd20f62f1bf0ac3fcc34de1e497324c5197d146/Tests/Models/Alicia_vrm-0.51/AliciaSolid_vrm-0.51.vrm
- https://github.com/pixiv/three-vrm/blob/ff42fae4fcee1fcbca2cd262c7f5f8cbddeaf5ab/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm

重跑：`npm test`、`npm run build`、`node scripts/smoke.cjs`。
本地另包：`node scripts/package.cjs --preview-vrm`（目的目錄已存在時會拒絕覆蓋）。
- 最終本地portable封裝共12項smoke通過：標準GLB、Draco、Meshopt、外部glTF、b3dm、損毀檔案、未知必要擴充、KTX2 glTF/GLB、含空白中文路徑，以及VRM0/VRM1。
- 額外測試把普通GLB改成.vrm，程式明確回報缺少VRM擴充，沒有誤認成功。
- npm audit無漏洞；語法檢查及git diff --check通過。VRM改動為開發版本，尚未建立新Release。
