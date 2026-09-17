# Repository privacy review — 2026-09-17

This is a scoped inspection, not a guarantee that every possible secret or identifying detail has been detected. The repository was already public when checked.

## Inspected

- All 10 reachable commits and 272 unique historical file blobs, including UTF-16 verification logs; current tracked filenames and Git author metadata.
- Credential/token/private-key patterns, sensitive assignments, personal email addresses, and Windows user-profile paths. The package lock's email belongs to upstream dependency metadata; commit authors use a nonpersonal placeholder identity.
- Tracked screenshots and branding. Messages screenshots match synthetic fixtures in `tests/recall-flows.mjs`; the displayed test contact and messages are not imported personal conversations.
- Gitleaks 8.30.1, downloaded from its official release and checked against the published archive SHA-256, scanned all reachable commits with redacted reporting.
- Current documentation also passed a Gitleaks directory scan. The older v1.1.0 verification ZIP's text entries were checked for user paths and common credential patterns.

## Findings and changes

No apparent real credentials were identified in the inspected source/history. Gitleaks reported one JWT in `tests/fixtures.mjs`: an unsigned synthetic decoder fixture with header `{"alg":"none"}`, payload `{"sub":"test"}`, and an empty signature. It is not an authenticated service token. This finding was reviewed rather than silently suppressed.

Personal Windows profile paths were present in eight current text reports. Their usernames were replaced with `USER`, preserving test outcomes and recorded hashes. Those original paths still exist in earlier commits and release tags.

Two current screenshots, `docs/verification/workbench-small.png` and `docs/verification/workbench-video.png`, still display the original test workspace path. They are retained verification evidence; the new README and HTML guide use a screenshot without that path. Sanitizing current text does not remove historical copies, screenshots, release assets, caches, or other people's clones.

The v1.1.0 release's `Switchyard-1.1.0-verification.zip` also contains original user-profile paths in its `source-package-hashes.json` report and its build/test logs. It includes historical workbench screenshots as well. That published archive was not replaced. No common credential patterns were found in its text entries; this was a pattern check, not a full binary-asset audit.

The ignore rules now exclude common local environment/credential files. Ignore rules do not remove already tracked files, and they do not replace a secret scan.

GitHub's secret-scanning API reported that repository secret scanning was disabled at review time. That is not a clean GitHub scan result.

## Scope limits

Installed app data, ignored local files, and the complete contents of published EXE installers were not audited by this source-history scan. No history was rewritten and no releases were deleted or replaced. A full historical removal would be a separate coordinated change affecting commits and release tags.

The third-party notices also contain an outstanding redistribution checklist for bundled engines and models. This privacy review does not establish completion of license, notice, or corresponding-source requirements.
