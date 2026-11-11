# Validation — 20261111.001

## Passed on Windows (john)

- 15 unit tests: GLB headers/chunk limits, malformed data, URI traversal/schemes/alternate streams, symlink escape, glTF embedding, b3dm headers, date/revision version comparison, fixed update URL, draft/prerelease/malicious URL filtering, HTTP/offline errors.
- Real RC390: 42,369,996 bytes, 993,122 triangles, EXT_texture_webp; portable EXE loaded its actual model and materials (not a demo). Three loads in one process, camera movement/zoom, clay→PBR restore and screenshot passed.
- Secondary GLB: 5,956,996 bytes, 127,639 triangles, WebP + KHR_mesh_quantization, loaded successfully.
- Portable executable fixtures: standard GLB, Draco GLB, Meshopt+quantization GLB, external .gltf+.bin, standard b3dm with RTC_CENTER, malformed GLB (expected readable error), KTX2/BasisU external glTF, KTX2/BasisU embedded GLB. Additional real Cesium city b3dm (120 triangles) and a Chinese/spaced uppercase-extension path passed. Each valid fixture was loaded three times; frame loop, camera movement and material switching were exercised.
- KTX2/BasisU screenshot visually checked against the expected brass lamp form/material. The Basis decoder is a static local worker; renderer CSP retains no unsafe-eval.
- npm audit: zero vulnerabilities at validation time.

## Explicit limitations / not claimed

- CUA Windows window inventory timed out during manual button/gesture QA; physical mouse gesture and Windows default-app chooser testing is not claimed. Renderer controls and command-line file loading have programmatic integration coverage. The user chooses default association once in Windows.
- OpenWith registration scripts are supplied and inspected, but not run against the user's settings during automated tests.
- Not every glTF extension, every KTX2 GPU format, all animated/skeletal models, or 1GB assets have been exhaustively tested. Unknown required extensions are rejected.
- b3dm view is local geometry only: no tileset transform, georeferencing, batch-feature picking, or legacy 20/24-byte headers.
- Full public-release CI result is available on the matching GitHub Actions tag run; local testing alone is not a claim that CI has passed.

## Reproduce

`npm ci`, `node node_modules/electron/install.js`, `npm test`, `node scripts/fetch-fixture.mjs`, `node scripts/fixtures.mjs`, `npm run package`, then `node scripts/smoke.cjs release/3wa_3dviewer-20261111.001-win-x64/3wa_3dviewer.exe --packaged`.

The generated tetrahedron fixtures are project-authored. The KTX2 test asset comes from [Khronos glTF Sample Assets: AnisotropyBarnLamp](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/AnisotropyBarnLamp). It is downloaded for QA only, not included in the application or source commits. Private user models and local test logs are excluded from Git and release artifacts.

Actual b3dm source: https://github.com/CesiumGS/3d-tiles-samples/tree/main/1.0/TilesetWithRequestVolume/city (QA only, not distributed).
