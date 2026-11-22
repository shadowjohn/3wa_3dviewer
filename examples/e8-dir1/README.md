# E8 腳本寶測試圖台

以 E8 實際圖台載入 Viewer 原有的 12 秒合成單向閥。模型、流向、閥片、標註和鏡頭共用 `examples/view-flow1/check-valve.scene.json`，E8 沿用同一份 Director 取樣程式。

## 在本機重跑

若尚未有合成 GLB，在專案根目錄用 Blender 生成。建置時傳入含 `easymap.js`、`easymap.css` 及 `vendor/three` 的 E8 runtime 目錄。預設從相鄰 `easymap8_sdk/third_src/maplibre-three-plugin/node_modules/three` 取同版 GLTFLoader，也可傳該 Three.js 套件目錄作為第二個參數。

```powershell
blender -b --factory-startup --python-exit-code 1 --python examples/view-flow1/generate_fixture.py
npm run build:e8-director -- W:/var/www/html/inc/javascript/easymap8
python -m http.server 18792 --bind 127.0.0.1 --directory web-e8-director
```

開啟 `http://127.0.0.1:18792/`。拖動時間軸可看 3 秒正向流過、5 秒停流和 8 秒反向截止。可拖曳或縮放圖台，相機預設留給地圖操作。選擇導演視角會跟隨腳本，回到地圖操作會恢復切換前的鏡位。卸載後可套用不同錨點再掛載。

經緯度為 WGS84。局部 `+X` 是正向，`+Y` 向上，朝向由北順時針計算。比例是每個局部單位對應的公尺數。高程空白時用此測試圖台的零面，示意底圖無 DEM，不能推論實際地表或海拔。

```powershell
node --test test/e8-director-map.test.cjs test/director.test.cjs
npm test
python scripts/check-e8-director.py http://127.0.0.1:18792/ qa/e8-dir1
```

瀏覽器檢查使用 Python Playwright 與 Chrome。輸出含正向、逆止、導演視角和卸載截圖。
