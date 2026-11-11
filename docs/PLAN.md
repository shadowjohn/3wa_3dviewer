# Implementation scope

Windows x64 portable read-only viewer, named 3wa_3dviewer in D:\mytools\3wa_3dviewer. The user first requested GLB, then explicitly added common compression, glTF and b3dm, the version 20261111.001, manual update checking, and GitHub Actions release publication. OBJ/FBX/STL/STEP remain out of scope.

Engineering choice: Electron plus bundled Three.js, providing a consistent offline renderer without a separate WebView2 or .NET installation, in exchange for a larger portable download. No default-app hijacking, model uploads, model edits or production 3wa_ride modifications.

Security: sandboxed isolated renderer; chosen-file IPC only; glTF resource containment checked before and after realpath; local decoder workers; fixed manual GitHub release endpoint; validate required extensions and formats before rendering. Details and validation evidence are in README.md and VALIDATION.md.
