# Reference media layers (2026-11-17, local development)

## Desktop usage
- Use **加入圖片／影片** for multiple PNG, WebP, JPG/JPEG, GIF or WebM files, or drag multiple files into the viewport.
- The original **開啟模型** remains dedicated to 3D formats. Mixed drag/drop loads media plus the first 3D file, preserving the original single-model behavior.
- Select a layer or use 上一張／下一張. 單張切換 shows the selected enabled layer; 多層疊圖 shows all enabled references. Top list row is the topmost layer. Checkboxes, arrows and × control visibility, stacking and removal.
- Opacity, uniform scale and horizontal/vertical offsets are per layer. Images fit without stretching. All references stay in screen space, above the 3D model, and never modify model geometry.
- WebM is muted, paused initially, and offers playback/pause. GIF/WebP animation uses Chromium's image decoder; GIF has no pause/frame-seeking control.
- The reference grid supports 3×3, 4×4 and 10×10 (100 cells). It is independent of the ground grid.
- 記住對照視角／還原對照視角 records the exact camera position, target, FOV and matrices plus existing layer transforms and selection for the current app session. Removed files are not recreated. This is not automatic photo perspective matching or real-world measurement.
- Collapse 參考圖層 to regain the original 3D controls. Snapshot includes the UI and visible overlays, as before.
- Desktop bounds: 16 layers, 64 MB/file, 256 MB total, decoded dimensions ≤24 megapixels. Errors do not erase previously loaded references; a bad file does not prevent later files in the batch from loading. Removing files releases object URLs and stops video.

## MCP (additive; old tools unchanged)
MCP remains offline stdio. No HTTP service, remote URL loading, shell endpoint or uploads. Existing `--reference-root=...` restrictions apply. Real paths and junction targets must remain inside configured roots.

New tools:
1. `load_reference_layers {paths:[...]}` creates an isolated session and returns its `id` and layer list.
2. `list_reference_layers {sessionId}` returns the current state.
3. `set_reference_layer {sessionId, layer:0, opacity:0.5, scale:1, x:0, y:0, visible:true, order:1, selected:0, mode:"overlay", time:0}` updates only supplied fields. Index 0 is the bottom layer; x/y are percentages of the viewport, time is the paused WebM timestamp in seconds.
4. `capture_reference_layers {sessionId, modelPath, views:["custom"], camera:{azimuth:60,elevation:15,fov:40}, grid:10}` uses the existing bounded camera contract and returns original/grid plus `layers` evidence, hashes and exact camera matrices. GLB/VRM model is required. A WebM seek past its duration clamps to its final available moment. GIF capture is an animation frame, not deterministic frame seeking.
5. `close_reference_layers {sessionId}` frees session state. Source files remain untouched.

These sessions do **not** control an already open desktop window. They create isolated capture processes, so agents cannot disturb the user's working view. They last for the MCP server lifetime. Limit: 4 sessions, 8 references/session, 16 MB/file, 64 MB/session. Reads and dimensions are revalidated at capture time. Close sessions after use.

## Validation
- `npm test`: 89 unit tests.
- `npm run build`.
- `node scripts/test-media-layers.cjs` must be launched with Electron (see command below): generated image/video multi-select, layer controls, corrupt-file continuation, cleanup, camera restore, original 3D controls.
- `node scripts/test-mcp-media.cjs`: actual stdio session lifecycle, allowed-root restrictions, WebM seek, 100-cell capture and camera matrices.
- Existing `scripts/test-mcp-protocol.cjs` and `scripts/test-mcp-evidence.cjs` remain the compatibility checks; tool inventory now has 7 tools.

Fixtures: place a generated `qa/media-layers/test.webm` (VP8) and `red.png` plus existing `qa/fixtures/plain.glb` before running media integration tests. QA assets are generated, not user photos. Run:

```powershell
node -e "const r=require('child_process').spawnSync(require('electron'),['scripts/test-media-layers.cjs'],{stdio:'inherit',windowsHide:true});process.exitCode=r.status"
node scripts/test-mcp-media.cjs
```

The source is committed separately from generated outputs; no push, GitHub release or replacement of a running portable is performed by build.bat. See BUILD.md.

## Isolated portable preview

Built in `release/3wa_3dviewer-preview-media20261117-win-x64/3wa_3dviewer.exe`. Double-click this separate executable, then use 加入圖片／影片. The existing working installation and MCP registration were not replaced. The product version remains 20261116.001 (not a new published release); PREVIEW.txt identifies this media build. MCP server reports 0.3.0.

For a separately configured MCP, point Node at this preview folder’s `resources/app/scripts/mcp-server.cjs` and retain the existing model roots and `--reference-root=...` permissions. No TCP port is opened. Source and packaged MCP processes were tested concurrently and both passed.

Final verification: 89 unit tests, 12 model smoke cases, 10 desktop-media assertions, legacy MCP reproducible pixel-identical capture and negative cases, new source/packaged concurrent MCP session tests, and packaged 3D smoke all passed. Native multi-selection dialog clicks were not manually tested; the renderer FileList and drop event paths were exercised in Electron. GIF decoding is covered; animated GIF timing/frame selection is not certified.

## Current build
Version 20261117.002 includes these features. build.bat now safely updates release/3wa_3dviewer-working-win-x64; see BUILD.md. Earlier preview paths above document the original verification only.
