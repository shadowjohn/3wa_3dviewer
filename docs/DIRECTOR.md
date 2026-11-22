# 場景導演（第一階段）

在 3WA 3D Viewer 點「開啟導演腳本」，選擇本機 `.json`。另開預覽視窗，可播放、暫停並拖動影格。MCP `record_director_scene` 接受 `{"scenePath":"D:/models/demo.scene.json"}`，回傳本機的無聲 H.264 MP4 路徑（640×480、30 fps）。匯出需自備 FFmpeg/libx264；預覽不需要。影片不改任何原始 GLB，也不會自動上傳。

腳本最多 64 KiB、1 至 20 秒、最多 4 個 GLB。模型以腳本所在目錄為相對根，只能使用內嵌資源的 GLB，不能用上層、連結到根之外、URL 或絕對路徑。單一 GLB 至多 96 MiB，合計至多 192 MiB。MCP 腳本本身須在既有允許的根目錄內。

```json
{
  "version": 1,
  "seconds": 5,
  "camera": [
    {"time": 0, "position": [8, 4, 9], "lookAt": [0, 1, 0], "fov": 42},
    {"time": 5, "position": [3, 4, 9], "lookAt": [0, 1, 0], "fov": 42}
  ],
  "objects": [
    {"id": "station", "file": "station.glb", "position": [-2, 0, 0]},
    {"id": "bike", "file": "bike.glb", "position": [2, 0, 0], "pivot": [0.15, 0, 0], "spin": {"axis": [0, 1, 0], "degreesPerSecond": 72}},
    {"id": "cart", "file": "models/cart.glb", "movement": [
      {"time": 0, "position": [3, 0, 2], "rotation": [0, 0, 0]},
      {"time": 5, "position": [-3, 0, 2], "rotation": [0, 30, 0]}
    ]}
  ],
  "notes": [
    {"object": "station", "text": "月台", "point": [0, 2, 1]},
    {"object": "bike", "text": "獨立旋轉", "point": [0, 1, 0], "start": 1, "end": 3}
  ],
  "captions": [{"text": "站前小景", "start": 0, "end": 1}]
}
```

場景使用同一組 Y 軸向上的 3D 座標。相機位置、注視點（各分量 ±12）和物件位置都使用場景單位，旋轉使用角度（XYZ 歐拉角）。物件 `movement` 為絕對放置關鍵影格，有設定時取代固定位置／角度；旋轉可與 `spin` 同時套用。支點使用該模型的局部單位，沒有設定時是模型原點。所有關鍵軌首幀在零秒，末幀為總秒數；中間線性插值。每幀的時間是影格索引除以 30，末端不重複取樣。

每個部位註記以 `object` 選模型，`point` 是該 GLB 根節點的局部位置。開始包含、結束不包含；沒有時間範圍就全程有效。定位會跟隨模型，超出畫面或被場景中的物件擋住就隱藏。字幕是獨立軌道，固定在畫面下方。

### 各物件的內嵌 GLB 動畫

可在物件加上 `"animation": {"clip":"Flap","start":0.5,"rate":1.5,"loop":"repeat"}`。每一個物件依同一個時間軸，分別選一個**精確名稱**的片段、開始秒數、播放倍率（0.1～4），以及循環 `repeat` 或播完停在最後一幀 `once`。開始前保留原模型姿勢。預設遇到找不到的名稱就報錯；若確定可靜止替代，可明確設定 `"missing":"static"`。重名或空片段不會靜默選用。

物件的場景放置、支點與自轉由外層變換控制，內嵌片段只作用於模型自身。如果片段含根位移，運動會疊加在外層場景放置上；需要路徑完全由腳本控制時，請用原地循環的片段。氣泡仍是模型根節點局部錨點，不會自動綁各骨骼。此階段不提供碰撞。

導演氣泡可設 `notes[].labelOffsetY`，以畫面高度的比例指定文字框與錨點的垂直間距，範圍為 −0.45～0.45。負值向上，正值向下，省略或設為 0 沿用預設配置。引線仍指向原本的 `point`。

### 方向光與實際陰影

省略 `lighting` 保留原本的環境光和外觀，不開啟陰影。可用 `"lighting":{"direction":[-4,5,3],"intensity":2,"color":"#fff2d9","shadows":true}` 增加一盞方向光；方向向量是**由場景朝光源**，Y 分量至少 0.05，`intensity` 範圍為 0～4，顏色為六碼 sRGB。開啟陰影時，場景中受光材質的網格共用一張 1024×1024 陰影圖；未受光材質（unlit）不顯示接收的陰影。

如需變化，可改用 `"lighting":{"shadows":true,"keyframes":[{"time":0,"direction":[-4,5,3],"intensity":2,"color":"#fff2d9"},{"time":5,"direction":[4,5,3],"intensity":2,"color":"#fff2d9"}]}`。最多 12 幀，首尾必須和場景開始與結束一致。方向（正規化前）、色彩通道與強度隨共同時間軸線性插值。實際品質視模型比例及陰影包圍範圍而定；特別大的內嵌根位移可能超出陰影覆蓋。

### 鏡頭清單與短轉場

原本的單一 `camera` 保持相容。也可改用 `shots`（二選一），最多八段：

```json
[
  {"end":2.5,"camera":[{"time":0,"position":[-5,5,10],"lookAt":[0,1,0],"fov":42},{"time":2.5,"position":[-3,5,10],"lookAt":[0,1,0],"fov":42}]},
  {"end":5,"dissolveInFrames":12,"camera":[{"time":0,"position":[4,3,7],"lookAt":[0,1,0],"fov":45},{"time":2.5,"position":[3,3,7],"lookAt":[0,1,0],"fov":45}]}
]
```

`end` 是全片上的截止時間，必須是 30 fps 整數影格，逐段增加，末段等於場景總秒數。各鏡頭的相機關鍵影格使用段內時間，從 0 到該段長度。未設轉場時，新的鏡頭在切點的第一幀立即生效。

可選 `dissolveInFrames`（2～15 幀、短於所屬鏡頭）：在後一鏡頭開始時，以前一鏡頭的末端相機姿勢疊到新鏡頭。兩邊取景的物件、動畫、燈光和標註仍是**同一個全片影格的時間**，不倒回或重設；畫面淡疊不延長影片。第一鏡頭不能設定疊化。這是同一個場景的相機轉場，不是跨場景合成。


### 流向軌道

`flows` 可省略，最多 4 條。每條需要 `id`、`medium`（`air`／`water`）、2–64 個 `points` 和 1–8 段 `stages`。路徑使用 Y-up 場景單位。填 `object` 時，路徑與閥座改用指定 GLB 根節點的局部座標，跟隨物件擺放與轉動。

```json
{
  "id": "pipe",
  "object": "valve",
  "medium": "water",
  "points": [[-2, 0, 0], [0, 0, 0], [2, 0, 0]],
  "stages": [
    {"start": 1, "end": 4, "direction": "forward", "speed": 1.5},
    {"start": 4, "end": 6, "direction": "forward", "speed": 0},
    {"start": 6, "end": 12, "direction": "reverse", "speed": 1.2,
     "stop": {"distance": 2, "normal": [1, 0, 0]}}
  ]
}
```

`speed` 的單位是每秒場景單位（0–100），`direction` 決定沿路徑正向或反向。每段顯示時間包含開始並排除結束，段與段之間可留空。連續同向且截止設定相同時，停流段承接粒子位置。截止位置 `stop.distance` 是從第一點沿折線量到閥座的距離，`normal` 指向正向出口。箭頭和粒子的可見幾何會留在閥座來流側。

`arrows`／`particles` 可各自設為 `false`，`arrowCount` 可設 1–12（預設 7），`particleCount` 可設 1–96（預設 48）。`seed` 以固定整數選定粒子分布。開關閥由物件的動畫片段控制，在同一份腳本排好過流與停流段。桌面預覽與 MCP 的 `record_director_scene` 使用相同的取樣時間和輸入格式。

可用 `appearance` 調整粒子輪廓和色澤，速度仍由 `stages` 設定。`shape` 支援 `drop`（原本的水滴）、`bead`（圓粒）、`viscous`（延展的濃液滴）與 `mist`（半透明霧粒）。`arrowColor` 和 `particleColor` 分別接受 `#RRGGBB`，`opacity` 控制粒子透明度，範圍大於 0 且不超過 1。三款同鏡位樣片見 [style-comparison.scene.json](../examples/view-flow1/style-comparison.scene.json)。

`appearance.arrowStyle: "schematic"` 使用工程圖式寬箭頭。在路徑位於 XY 平面時，由 +Z 方向看可見箭頭正面。`appearance.trace` 可選 `ribbon`（半透明流帶）或 `streamline`（細流線），顯示於有效階段，並受同一截止平面約束。箭頭、粒子和流線可疊加，也可以只畫流線。

`appearance.scale` 是箭頭、粒子、粒子橫向散布和流線寬度的倍率，可設 0.001–10，預設 1。管徑較小時可縮小效果，路徑座標、模型比例與 `stages.speed` 仍按原本的場景單位設定。

流線和流帶預設沿用粒子顏色。要顯示相對流速，可加 `traceValues`，為每個 `points` 路徑點提供一筆 0–1 數值。顏色從低值的藍色漸變至高值的暖色，粒子移動速度仍由 `stages` 決定。方向箭頭與合流見 [junction.scene.json](../examples/view-flow1/reference-styles/junction.scene.json)，相對流速與回流見 [recirculation.scene.json](../examples/view-flow1/reference-styles/recirculation.scene.json)。兩組路徑與相對值均為合成示意。

在倉庫根目錄執行 `python examples/view-flow1/reference-styles/generate_fixtures.py` 即可生成這兩段樣片用的 GLB。

合成驗證場景在 [examples/view-flow1/check-valve.scene.json](../examples/view-flow1/check-valve.scene.json)。用同目錄的 [generate_fixture.py](../examples/view-flow1/generate_fixture.py) 匯出合成 GLB，將該 GLB 與腳本放在同一目錄即可預覽或出片。

[check-valve-real.scene.json](../examples/view-flow1/check-valve-real.scene.json) 對應 VIEW-VALVE1 v1.0.2。將該工單的 `check_valve_cutaway.glb` 放在腳本旁即可預覽或出片。路徑以公尺設定，小蝌蚪先流到閥片前，在開閥後沿可見剖面經過導流籠開孔。反向在關閉後停於閥片下游面前。路徑和開關行程均為展示用。

[check-valve-assembly.scene.json](../examples/view-flow1/assembly/check-valve-assembly.scene.json) 示範 19 秒的拆解、零件說明和回裝。從倉庫根目錄執行 `node examples/view-flow1/assembly/generate_assembly.cjs` 生成樣片用 GLB。如資產倉庫放在別處，將含有 v1.0.2 組裝及拆解 GLB 的目錄作為命令參數。

### 匯出網頁展示包

以原有 Director JSON 匯出新的靜態展示目錄。先把核准的自含資源 GLB 放到場景指定位置，再執行下列命令。封面接受 PNG／JPEG，備援接受 MP4，兩者都可省略。

```powershell
npm run export:director-web -- examples/view-flow1/check-valve-real.scene.json ./release/valve-web --cover ./valve-cover.png --mp4 ./valve.mp4 --chapter-label 反向截止 --chapter-seconds 6.233333333333333
```

輸出目錄的上層須已存在。使用靜態 HTTP(S) 服務整個輸出目錄，或本機執行 `python -m http.server 8080 --bind 127.0.0.1 --directory ./release/valve-web`。入口 `index.html` 使用相對路徑，可搬到任意子目錄。模型名稱會轉成 `assets/model-N.glb`，`scene.json` 保留原本的場景版本和時間軸。

播放器載入時暫停。拖動進度條可逐幀跳播，`?t=6.233333333333333` 可直接定位章節。按「自由轉視角」時固定當前影格，按「回到導演視角」會恢復該影格的導演鏡頭。MP4 匯出與網頁播放共用渲染取樣。

`blog-example.html` 是可直接部署到測試目錄的 3WA Blog 嵌入範例。按「載入 3D」或章節按鈕後，才建立同目錄播放器的 iframe。設定封面及 MP4 時，兩者會和 3D 按鈕一起提供。將範例整合到同來源其他頁面時，HTML 區塊的兩個靜態資源引用需指向展示包內的 `blog-example.css` 與 `blog-example.js`。

桌面和網頁都把驗證後的場景交給 `createDirectorStage`。此模組接收場景、渲染器和 GLB 載入器，以整數影格取樣動畫、路徑、流向、燈光和標註。日後由圖台接入時，可以用相同場景定義及時間軸。
