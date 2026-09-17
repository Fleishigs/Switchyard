# Workspace maintenance

Keep this checkout small. Cleanup after completed builds, tests, and releases is part of the work; the user has authorized routine removal of obsolete generated artifacts.

- Never delete source code, tracked files, uncommitted work, `.git`, build branding, licenses, tests, or curated verification evidence. Being ignored by Git does not make a file disposable.
- Keep the newest published Windows installer locally in `release-final`, together with its checksum and small release metadata. Verify GitHub has the complete installer with a matching SHA-256 before removing older local installers.
- Once release verification is complete, remove `release-final/win-unpacked`, obsolete release artifacts, temporary `.runtime*` profiles, fixtures, downloaded test media, package staging directories, and obsolete rollback backups. Save concise verification results before removing their temporary evidence.
- Preserve files deliberately delivered to the user under `outputs`. Remove disposable test outputs only after distinguishing them from user deliverables.
- Preserve `node_modules`, the active offline engine binaries/models/licenses, and `voice/publish` so the project remains ready to rebuild. These resources are not all in Git; never assume a Git push backs them up. Remove redundant engine archives, extraction logs, and unused setup environments only after checking the build configuration and retained copies.
- `dist`, .NET `bin`/`obj`, and test-harness `bin`/`obj` are disposable build outputs. `dist` must be regenerated with `npm.cmd run build` before launching the source app.
- Use PowerShell `Remove-Item -LiteralPath` for Windows cleanup. Resolve and validate each absolute deletion target inside this workspace, reject linked/reparse paths, check for tracked descendants and active processes, and never delete anything outside this checkout as routine cleanup.
- Do not interrupt running apps, installers, tests, or builds to clean their files. Skip active artifacts until their owning process finishes.
- Report the approximate space reclaimed and what was retained. Do not leave cleanup inventories or temporary cleanup scripts behind.
