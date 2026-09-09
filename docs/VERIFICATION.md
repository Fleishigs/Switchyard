# Switchyard 1.0.1 verification

The release contains 111 registered tools, a Messages workspace, and 13 conversion families with 121 recognized input extensions. The family matrix contains 81 destination choices in total; that is not a claim that every possible input variant or file type is supported.

## Completed checks

| Area | Evidence |
| --- | --- |
| Backend and converter suite | 202 tests passed in `verification/full-tests-final.txt` |
| Catalogue coverage | All 111 registered tools mapped to passing processing evidence in `verification/tool-coverage.json` |
| Office regression after fixing long paths | 11 conversion tests passed in `verification/office-regression.txt`; the additional path-over-250-characters regression passed in `verification/office-long-path.txt` |
| General tool UI | 107 tool, output, and recovery flows passed in `verification/all-flows-final.txt` |
| Packaged conversion engines | All 13 families and the local OCR worker/model passed in `verification/packaged-converters.json` |
| Integrated Messages | 15 flows in `verification/messages-flows.json`, 8 additional edge/media flows in `verification/messages-edge-flows.json`, and 6 real Windows dialog/restart flows against the installed app in `verification/messages-native-dialogs.json` |
| Batch converter and crop UI | 6 flows in `verification/workshop-flows.json` |
| Queue | Queued cancellation, running cancellation, recovery, and restart persistence in `verification/queue-flows.json` |
| Window sizes | Every category and main navigation control checked at 900×650, 1100×760, and 1440×960 in `verification/navigation-flows.json` |
| Local/download engines | Packaged Whisper, vocal separation, YouTube video/audio downloads, and recorder flow in `verification/engine-flows.json` |
| Native voice controls | Real engine/model pickers, mode/toggle persistence, copying, recording, Cancel, and Stop/transcription in `verification/voice-ui.json` |
| Microphone and command boundaries | Capture/restart/disposal, all nine command names, rejection of compound commands, and executable-path checks in `verification/voice-device-check.txt` |
| Voice launcher | The packaged launcher opens a visible companion window, verified in `verification/voice-launch.json` |
| Interactive installer | Welcome, license, Back/Next, directory selection, Browse cancellation, installation, Finish, and cleanup exit passed in `verification/installer-flow.json` |
| Installed application | Catalogue, favorites, processing/output, tool finder, engine detection, and laptop layout passed in `verification/installed-ui.txt` |
| Remaining controls | 18 native picker, settings, search, suggestion, and persistence checks passed in `verification/controls-flows.json` |
| Drag and drop / favorites | Native Chromium file drops, duplicate suppression, clearing, favorite restart persistence, and removal passed in `verification/drop-flows.json` |
| Uninstaller | Interactive Next/Finish flow, executable removal, and uninstall registration removal passed in `verification/uninstall-flow.json` |
| Delivery installation | Per-user installation to `%LOCALAPPDATA%/Programs/Switchyard`, desktop shortcut target, and archive consistency passed in `verification/delivery-install.json`; final installed-copy UI checks passed in `verification/delivery-ui.txt` |
| Source consistency | 14 source/published artifacts match the installed application in `verification/source-package-hashes.json`; installer SHA-256 is in `verification/installer-sha256.json` |

The UI checks are automated interactions with the actual application, including native Windows file and save dialogs. They are not a claim that a human manually inspected every combination of settings. Tests use isolated profiles and synthetic files. Microphone checks briefly exercise the current device; no captured audio or device-test transcript is included in the source repository.

## Fixes found during verification

- Moved Fig message functionality into the main React interface with no separate Recall window or branding.
- Removed the redundant contact-export action. Export XML converts Fig messages to SMS Backup & Restore XML.
- Added an initialization guard to backup actions and verified both opening buttons through real Windows dialogs.
- Preserved previous imports when new backups fail; stopped silently skipping malformed messages or missing XML attachments.
- Extracted message ZIPs asynchronously into a fresh, bounded staging directory.
- Preserved international contact prefixes and accepted numeric as well as string MMS direction flags.
- Corrected small-image crop defaults and verified drag selection and all three presets.
- Kept navigation scrollable and file/voice controls available at the minimum window size.
- Staged Office conversions in short temporary paths, including their private profile and input/output files.
- Corrected the Calculator command path, made command matching stricter, and made the voice-launch action show its window.

## Practical limits

File formats contain many variants, damaged inputs, optional codecs, and encryption schemes. Tests exercise the implemented routes and representative files, not every possible file. PDFs need embedded text for text extraction; PDF-to-document conversion does not reconstruct original page layout. Some phone-specific audio/video formats cannot play directly in Chromium even when FFmpeg can convert them.

English dictation was checked with a known speech fixture, current-device recording, and the native controls. Physical hotkey behavior across other apps, unusual keyboard drivers, other microphones, accents, and other Windows machines still needs real-world use. The voice command matcher deliberately rejects requests outside its small exact-command list.

The installer is unsigned. It bundles offline runtimes and models, so the full toolbox is substantially larger than the voice component alone. Network-dependent downloads can fail when the source site, authentication requirements, or connectivity changes.

The installer bundles substantial local runtimes. Its first extraction and cleanup exceeded the initial automation waits; the resumed test verified the completed installation and process exit. The reusable installer test now allows longer waits for both phases.
