# Switchyard 1.0.2: testing the results

The earlier 1.0.1 catalogue sweep mostly established that tools completed and produced nonempty files. It did not establish that every result fulfilled its promise. This audit adds decoded-content and transformation checks for all **111 tools**, including **81 batch conversion destinations across 13 families**.

The per-tool assertions and conversion evidence are listed in [outcome-coverage.json](verification/outcome-coverage.json). The 106 direct tools were exercised through the packaged application's IPC and queue; download, transcription and separation checks exercised the real engines. The batch sweep checks every advertised destination with representative fixtures.

## Bugs found and corrected

| Before | After | Verification |
| --- | --- | --- |
| PNG edits passed a quality parameter that enabled palette quantization. Cropping, rotation and other edits could change colors. | PNG edits retain full color and use lossless compression. | Exact decoded pixel mappings for crop, rotation, reflection, inversion and borders. |
| Enhancement used aggressive sharpening, including flat areas, and slow palette encoding. | Gentler edge sharpening without sharpening flat areas; full-color PNG output. | Contrast/size checks, visual comparison, and three interleaved timing trials on the reported photo. |
| One-pass normalization measured about -14.22 LUFS on the test fixture despite the -16 LUFS target. | A measurement pass feeds the final normalization pass. | Independent loudness measurement of the exported audio. |
| Leading-silence removal also discarded roughly 100 ms of the first audible section. | Reduced the non-silence confirmation period to 10 ms. | Decoded waveform duration and onset checks. |
| Default JPEG-compressed TIFF output decoded with wrong colors in FFmpeg. | TIFF uses lossless LZW. | An independent FFmpeg decode preserves the source RGB values; all nine image destinations pass. |
| Title capitalization used ASCII word boundaries inside accented words. | Unicode word matching preserves accented letters and apostrophes. | Exact expected output for accented words and “don't”. |
| Image jobs showed a completion status without an in-app comparison. | New image jobs keep source references and provide before/after previews plus processing duration. | Preview decoding, slider keyboard controls, different screenshot pixels, restart persistence, and missing-source feedback. |

## Enhancement performance and quality

On the photo reported by the user, three interleaved trials measured a median of **2,950 ms before** and **744 ms after** for processing. This is not a measurement of the entire file-picker-to-result interaction. The original file was verified unchanged.

The original 1.0.1 job history recorded 2,979 ms of processing. The user experienced roughly ten seconds overall; that full duration was not captured by the old application and cannot be reconstructed from its history.

The corrected PNG is larger because it retains full color instead of reducing the image to a palette. Enhancement adjusts contrast and edges. It does **not** reconstruct motion blur, invent missing detail, or perform AI upscaling. More changed pixels alone are not proof of a better photograph.

See [enhancement-benchmark.json](verification/enhancement-benchmark.json). No photo pixels or personal file paths are included in that report.

The final installed-app run on that photo measured **881 ms processing** and **1,403 ms from Run to the completed result**. The original hash stayed unchanged, the output was full-color PNG, and both comparison images decoded. This is one local timing sample, not a general speed guarantee. See [reported-image-flow.json](verification/reported-image-flow.json).

## Visual editing and inspection

Audio/video tools now have actual media playback, waveforms, scrubbing and saved-result players. Audio trim, video trim and video-to-GIF add draggable and keyboard-accessible selection handles and selection playback. Frame extraction uses the scrubbed position. Speed tools preview the chosen playback rate. Fade tools show the export envelope while explicitly labeling playback as the source recording.

PDF tools have page navigation, visible range selection for extraction/deletion, and saved PDF previews. File-tray ordering controls determine merge/contact-sheet order. Saved image previews make QR codes and extracted frames visible, and text comparison accepts two multiline inputs.

[The per-tool visual review](VISUAL-TOOL-REVIEW.md) covers all 111 tools and records remaining opportunities. [The visual workflow report](verification/visual-workspace-flows.json) checks real playback and pause, byte-range seeking, pointer/keyboard handles, minimum-duration export, selected-range export, rate changes, vocal-separator source playback, PDF page selection, tray order, small-window/dark-theme layout and QR image decoding. These tests supplement the decoded-output audit rather than replacing it.

[Two additional stem-player checks](verification/stem-playback-flows.json) use the actual UVR outputs from the engine audit and verify that the vocal and instrumental results each decode, play, pause and hide correctly in Queue.

## What the checks establish

- Images: exact geometric mappings, color transformations, transparency, edge changes, output codecs and preservation of content.
- Audio: decoded waveforms, gain in decibels, fades, reversal, duration, pitch, frequency filtering, noise attenuation and loudness.
- Video: decoded frames, dimensions, codecs, duration, orientation and audio stream selection.
- PDFs: actual page text, order, extraction/deletion, rendered content, metadata, watermarks and pagination.
- Text/utilities: independently specified expected values, Unicode cases, CSV quoting, known hashes, UUID structure and QR decoding with a separate reader.
- Batch conversion: text and cell values, archive payloads, font character maps, mesh volume/bounds, subtitle timing and database/data values survive conversion.
- Transcription: a known sentence is recognized in source speech and in separated vocals.
- Separation: vocals remain intelligible and contain about 2.8% of an added accompaniment tone's original amplitude in the controlled fixture. This is not a universal music-separation quality score.
- Downloads: the downloaded video decodes to nonblank frames and audible sound; the MP3 decodes and matches the source duration.

The first batch audit passed 83 of 84 checks and exposed the TIFF issue. After the fix, all nine image destination checks passed. The combined report accounts for the corrected route rather than presenting the initial run as entirely successful.

## Limits

These are result-specific automated checks and visual inspection, not a claim that a human manually tested every possible setting, damaged file, codec variant, photograph, microphone or Windows machine. Image quality remains subjective. Voice hotkey behavior across all other applications and hardware remains a real-world compatibility check.

Original Messages import/export and native-dialog tests are documented in [the verification history](VERIFICATION.md); release-specific follow-up checks are saved beside this report.
