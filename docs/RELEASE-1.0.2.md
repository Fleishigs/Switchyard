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
