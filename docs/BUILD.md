# Building the portable viewer

Renderer source requires bundling; Electron packages it into a Windows x64 portable directory. No C++ compiler is needed.

First checkout: install Node.js/npm and run npm ci, then build.bat. The batch tests, bundles and packages, stopping on failure.

The normal build output is always release/3wa_3dviewer-working-win-x64/3wa_3dviewer.exe. Update src/version.cjs for each new version; the directory stays fixed. Close that working viewer and any MCP server using that directory before building.

Packaging first creates a separate staged directory. A running-process check and build lock prevent normal overlapping builds. Only after packaging succeeds does it copy portable-data, move the complete previous working directory to the sibling 3wa_3dviewer-build-archive/, and promote the staged directory. If promotion fails it attempts to restore the old directory. Nothing in the old directory is permanently deleted. User-added files other than portable-data remain in the archive, not the new package.

Do not launch the working viewer during packaging. On a locked file, permission error or unexpected failure, retain the staging/archive directories for inspection. A stale release/.working-build.lock after forced termination must only be removed after confirming no build is running.

Existing version-named releases, shortcuts, MCP configuration and file associations are untouched. The archive is recoverable and may grow; review user data and references before cleaning it. npm run package still creates a separate version-named release and refuses overwrite.

MCP can use the fixed folder's resources/app/scripts/mcp-server.cjs with existing explicit allowed roots. Building does not update registrations. See REFERENCE-LAYERS.md and mcp-capture.md. Generated web/, release/, qa/ and node_modules/ are excluded from Git.
