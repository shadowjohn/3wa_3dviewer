# 3wa_3dviewer 看板娘與 icon 設計紀錄

## 來源與狀態
- 日期：2026-11-12
- 設計：阿寶；需求與審稿：羽山。
- 原圖：`3wa_3dviewer_avatar_concept.png`
- 工具：內建 image_gen；一次文字生成，沒有輸入參考圖，沒有後製或重新生成。
- 工具參數：`transparent_background=false`；未提供 referenced_image_paths 或 num_last_images_to_include。
- 以下英文是本次生成工具呼叫的實際 prompt 原文，取自同一設計工作對話的工具呼叫記錄，不是事後重構。
- 原圖 SHA256：`c01ff50235e45153c56d38bf4b2ee1112cfee6797063d4aa23c302350a68e44f`
- 原圖為 1536 × 1024 PNG，大小 1,535,906 bytes。從核准的 Library 原圖取回，下載後 SHA256 相同。
- 這是已通過方向審查的概念板，不是已拆分的透明角色素材或 Windows ICO；未整合到程式、未發布。

## 設計意圖
以親切、俐落的 3D 工作坊導覽員作為看板娘，深藍與青綠為主色，珊瑚色小點綴。立方體髮飾、手上的模型與 icon 的立方體／環繞軌道呼應模型檢視及旋轉操作。
右下角同一角色捧著缺邊的線框模型，作為未來讀取失敗或空狀態的友善表情方向；錯誤仍需保留明確文字與可採取的下一步，不能只展示角色。
應用 icon 採簡單幾何而不使用完整人物，意圖讓小尺寸較容易辨識；正式製作仍須另外測試 16／32／48／256 px。

## 實際生成 prompt
```text
Create an original polished brand concept sheet for a Windows 3D model viewer called 3wa_3dviewer. Wide composition on clean very pale blue background. Two carefully separated areas: left 65% a full-body friendly adult anime female mascot, right 35% a large matching app icon and a small friendly empty/error-state bust illustration of the SAME character. The mascot is a capable cheerful 3D workshop guide: short dark navy bob with turquoise tips, small geometric cube hair clip, teal eyes, practical white and navy cropped utility jacket over full coverage dark shirt, navy shorts with leggings, comfortable sneakers. Tasteful professional all-ages anime design, no sexualization. She holds a hovering cyan isometric cube in one hand and casually waves with the other. Clean confident linework, elegant cel shading, restrained navy/cyan palette and tiny warm coral accents. Icon: very simple bold isometric cyan cube enclosed by an open navy orbital arc, one tiny coral sparkle; strong silhouette readable at 32px, no character face in icon, no letters. Error-state bust: same character with a gently sheepish apologetic smile, holding an empty wireframe cube with one missing edge, inviting rather than alarmed. Minimal high-quality branding presentation, strong negative space, sharp shapes. Only text at top: '3wa_3dviewer'. No extra text, no watermarks, no bees, no existing copyrighted characters. This is a review concept sheet, not a software screenshot.
```

## 後續素材化注意
- 保持角色髮型、髮飾、服裝和配色一致。
- 另行製作透明底正常／讀取失敗角色素材，以及獨立 icon；不要把概念板直接當 ICO。
- 目前尚未命名角色。未核准自動套用到程式。
