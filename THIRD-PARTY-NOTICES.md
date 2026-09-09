# Third-party components

Switchyard's MIT license applies to its own code, not to every bundled engine. Runtime distributions retain their included license files and package metadata.

| Component | Origin | Included location |
| --- | --- | --- |
| Electron / Chromium | https://github.com/electron/electron | Electron runtime licenses |
| FFmpeg 8.0 essentials | https://www.gyan.dev/ffmpeg/builds/ and https://ffmpeg.org/ | engines/ffmpeg |
| whisper.cpp b4938 | https://github.com/ggml-org/whisper.cpp | engines/whisper/LICENSE |
| Whisper tiny.en weights | https://huggingface.co/ggerganov/whisper.cpp | engines/ggml-tiny.en.bin |
| yt-dlp | https://github.com/yt-dlp/yt-dlp | engines/yt-dlp-LICENSE |
| Python 3.13 embedded runtime | https://www.python.org/ | engines/separator/LICENSE.txt |
| audio-separator and dependencies | https://github.com/nomadkaraoke/python-audio-separator | engines/separator/Lib/site-packages |
| UVR MDX Inst HQ 3 weights | https://github.com/TRvlvr/model_repo | engines/models |
| Tesseract.js and English trained data | https://github.com/naptha/tesseract.js and https://github.com/naptha/tessdata | node_modules and engines/ocr |
| LibreOffice | https://www.libreoffice.org/ | engines/office/LICENSE.html, license.txt, NOTICE |
| Pandoc | https://pandoc.org/ | engines/pandoc/COPYING.rtf and COPYRIGHT.txt |
| 7-Zip | https://www.7-zip.org/ | engines/7zip/License.txt |
| FontTools / Brotli / trimesh | https://github.com/fonttools/fonttools and https://github.com/mikedh/trimesh | Python package metadata |

Additional JavaScript and native dependencies, including React, Sharp, PDF.js, pdf-lib, canvas, QRCode, YAML, TOML, XML parsing, and ZIP reading retain their package license files. Exact installed versions are recorded in package-lock.json. The voice companion uses NAudio and .NET.

FFmpeg, Pandoc, LibreOffice, and other components have licensing terms distinct from Switchyard's MIT license. This local build is assembled for this workstation. Before publishing a redistributed installer, provide the corresponding source and notices required by each included build and verify the redistribution terms for model weights. No public distribution is performed by this project setup.

Message parsing and XML conversion were adapted from the user's existing Fig message-backup application. Its original project is unchanged.
