# Switchyard 1.0.2

This release corrects output-quality defects and adds ways to inspect the source and the actual saved result.

- Trim audio/video with playback, scrubbing, selection handles and selection playback. Handles and numeric fields control the same exported interval.
- Preview the chosen video-frame position. Preview speed changes, and inspect fade envelopes.
- Listen to saved audio and vocal/instrumental stems, or watch saved videos from Queue & history.
- Navigate PDF pages, select extraction/deletion ranges visually, and inspect saved PDFs.
- Reorder the file tray before merges and contact sheets. Compare two multiline texts. View saved QR codes and extracted images in-app.
- Compare original and processed images. Image enhancement now preserves full-color PNG pixels and uses gentler edge sharpening. It is contrast/detail adjustment, not AI restoration of blurred detail.
- Correct two-pass loudness normalization, leading-silence trimming, TIFF export colors and Unicode title capitalization.

The vocal separator is **Voice & AI → Separate vocals**; Ctrl+K can find it by name. **Video → Remove video audio** removes the whole soundtrack instead.

See [the result audit](OUTCOME-AUDIT.md) for decoded-output evidence across 111 tools and 81 batch routes, and [the visual review](VISUAL-TOOL-REVIEW.md) for every tool's implemented preview and remaining opportunities. Browser playback supports fewer codecs than the conversion engines; unsupported previews show a conversion suggestion. Source playback is labeled and does not imply that an effect has been applied.

## Delivery verification

The full installer upgraded the existing installation successfully. Its installed application archive matches the verified package, the registered version is 1.0.2, the desktop shortcut is correct, and the saved-history file is unchanged. The 16 visual workspace flows and both actual UVR stem-player flows then passed through the installed executable. Seven image-comparison flows passed separately. The native installer wizard also passed navigation, folder-picker cancellation and cancellation before installation.

The installer is `release-final/Switchyard-Setup-1.0.2.exe` (1,136,712,997 bytes). Its SHA-256 is `8b73d7288177879f44017313a60ccff3b22d4bdff37108e43e6e918bba16d067`. It was packaged from the verified `win-unpacked` application using `ELECTRON_BUILDER_COMPRESSION_LEVEL=1`; the default maximum-compression attempt was stopped because it was unnecessarily slow.

Evidence: [installer upgrade](verification/installer-upgrade.json), [installer wizard](verification/installer-wizard-1.0.2.json), [installed visual flows](verification/installed-visual-workspace-1.0.2.txt), [installed stem playback](verification/installed-stem-playback-1.0.2.txt), and [source/package hashes](verification/source-package-hashes.json).
