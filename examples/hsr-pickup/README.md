# E8 腳本寶｜烏日高鐵站一樓載客區

19 秒合成場景，呈現車輛進場、減速靠邊、乘客從月台側開門上車、關門後駛離。腳本以同一時間軸驅動四段運鏡、車輛路徑、乘客步行、開關門及說明。可暫停、前後拖曳、跳段落，以及切換地圖和導演視角。

場景以 WGS84 `120.61630, 24.11245` 為錨點。+X 指向行車方向，朝向為從北順時針 185.8°。+Y 向上，+Z 指向車道右側月台。單位為公尺，高度採一樓示意零面。場景尺寸、建物、車輛、人物與動線皆用合成資產。

- 場址與紅色一樓導引參考 [臺中市政府高鐵接送說明](https://www.taichung.gov.tw/2951706/post) 和 [7 號出口東側載客區說明](https://www.taichung.gov.tw/8868/8872/9962/1081009/)。
- 錨點及朝向取自 [OpenStreetMap 站側一樓車道](https://www.openstreetmap.org/way/346720975)。底圖採 [國土測繪中心 EMAP WMTS](https://maps.nlsc.gov.tw/S09SOA/pro/Wmts_ajax_main.jsp)。

## 重跑

```powershell
blender -b --factory-startup --python-exit-code 1 --python examples/hsr-pickup/generate_fixture.py
npm run build:e8-pickup -- W:/var/www/html/inc/javascript/easymap8
python -m http.server 18794 --bind 127.0.0.1 --directory web-hsr-pickup
```

以 `http://127.0.0.1:18794/` 開啟展示。也可直接在 3wa_3dviewer 開啟 `pickup.scene.json`。舞台、車輛和乘客三個 GLB 由上面的產生器匯出。部署保留 `web-hsr-pickup` 的相對目錄結構。
