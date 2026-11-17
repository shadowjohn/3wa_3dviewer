# Building the portable viewer

Renderer source requires bundling; Electron then packages it into a Windows x64 portable directory. No C++ compiler is needed.

Install Node.js/npm. For a first checkout run `npm ci` with the committed lockfile, then `build.bat` from any directory. The batch runs unit tests, renderer build and portable packaging, stopping on any failure.

Set a NEW display version in `src/version.cjs` before a new build. Output is `release/3wa_3dviewer-<VERSION>-win-x64/`. Existing destinations are refused, never overwritten. The script does not start or replace an installed viewer, alter MCP registration or change file associations. A failed partial output is retained for inspection.

The owner's release policy is one current version. Before removing/moving older outputs, verify running processes, MCP/shortcut references and `portable-data`. Do not delete user data. This batch intentionally does not auto-clean unverified older installations. After reviewing them, move obsolete outputs to a recoverable archive outside release, or explicitly approve deletion.

Launch the new folder's `3wa_3dviewer.exe` manually. Keep the full folder together. MCP uses Node with `resources/app/scripts/mcp-server.cjs` and explicit model/reference roots; building does not switch existing MCP registrations. See REFERENCE-LAYERS.md and mcp-capture.md.

`npm start` is development mode; run `npm run build` after renderer source edits. Generated web/, release/, qa/ and node_modules/ are excluded from Git. Never commit private reference images, capture artifacts or local MCP configurations.
