# Switchyard

A Windows workshop for media, documents, files, and everyday tasks. React and Electron share one Material 3 inspired interface, with local processing engines and an offline dictation companion.

## What is included

- 111 registered tools: image processing, audio and video editing, PDF tools, OCR, text and developer utilities, calculators, downloads, transcription, and vocal separation.
- A batch converter with compatible destinations for images, media, office documents, PDFs, archives, fonts, 3D geometry, subtitles, SQLite tables, and structured data. Unsupported files get an explicit error; compatible files continue.
- **Messages**, built into the main interface: open a Fig ZIP/NDJSON backup, browse conversations, search globally or within a chat, view photos and play supported audio/video attachments, import vCard names, and **Export XML** for SMS Backup & Restore. “Convert another backup” exports a different source without replacing the open conversations. There is no separate Recall application or contact-converter button.
- A queue, per-job output folders, saved history, reusable outputs, favorites, light/dark themes, and a local tool finder.
- Switchyard Voice: Ctrl+Shift+Space dictation using whisper.cpp and a tiny English model, plus a limited set of exact Windows commands. No cloud transcription service is required.

## Running and building

On this workstation, run `npm.cmd start` after `npm.cmd run build`.

For a fresh checkout, install Node.js and .NET 8, run `npm.cmd ci`, and populate the engine folders listed in `package.json` under `build.extraResources`. Engines and downloaded model binaries are excluded from source control. Publish the voice project with:

```powershell
dotnet publish voice/SwitchyardVoice.csproj -c Release -r win-x64 --self-contained true -o voice/publish
npm.cmd run package
```

The current installer is produced in `release-final`. The Electron application also runs directly from that folder's `win-unpacked/Switchyard.exe`.

## Data and boundaries

Original inputs are preserved. Tool output/history live in Electron's Switchyard user-data folder; Messages keeps its own imported copy beneath that folder. Clear imported data removes that copy and imported contact names, not the source backup. Failed imports preserve the previous backup. XML export refuses missing binary attachments and preserves an existing destination if conversion fails.

Conversions are limited by the underlying engines. The format selector identifies file extensions; it is not a guarantee that every variant, codec, encrypted file, or damaged input can be read. PDF-to-document conversion extracts text rather than reconstructing the original layout. Text-only PDF creation uses a Latin font. Fonts and mesh conversions have documented preservation limits in the interface. Browser playback supports a narrower codec range than FFmpeg conversion; some phone-specific recordings may need conversion before playback.

ZIP message imports are extracted asynchronously and limited to 10,000 files, 2 GB total, and 250 MB per entry. Unsafe paths and links are rejected. XML exports can be large because binary attachments are base64 encoded.

Downloads require internet access; the bundled processing engines, OCR model, English dictation model, and vocal-separation model run locally. The tool finder matches tasks to tools; it is not a cloud chat model. Local voice accuracy and speed depend on the microphone, language, CPU, and background noise. The full toolbox is a large download because it includes offline runtimes; the voice companion is a separate, smaller component inside the same project.

## Verification

`npm.cmd test` runs backend and conversion checks. Native Electron workflow scripts are in `tests`; `messages-native-dialogs.mjs` also operates real Windows file/save dialogs using a helper restricted to its own process. Test inputs and profiles are isolated under `.runtime-*` or temporary folders. Results are under `docs/verification`.

The tests exercise synthetic files and supported flows; they do not establish compatibility with every possible file, microphone, or Windows configuration. Test windows are temporary and should not be used for personal work.

See `THIRD-PARTY-NOTICES.md` for engine origins. Switchyard's own code is MIT licensed; bundled components retain their own licenses.
