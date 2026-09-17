# Switchyard 1.1.2

This release focuses on reducing the Windows installer download. The build now uses maximum compression and a solid 7-Zip payload, allowing repeated data across files to compress together. Differential-update packaging is disabled; Switchyard does not currently implement differential automatic updates.

All application features, offline engines, models, and the self-contained Voice companion are retained, including Deno for YouTube downloads. This is a packaging change, not a lightweight edition or an installer that downloads engines later. Installed disk usage is essentially unchanged. Building the release takes longer with stronger compression.

Future published builds use a `beforePack` hook that enforces compression level 9 and the compatible BCJ filter rather than the earlier level-1 speed override. The explicit filter avoids the [known archive-producer/NSIS-decoder mismatch](https://github.com/electron-userland/electron-builder/issues/9983), which can otherwise silently omit native helper files during extraction.

## Download size

| Installer | Bytes | Decimal size |
|---|---:|---:|
| 1.1.1, fast compression | 1,213,383,735 | 1,213.4 MB |
| 1.1.2, maximum solid BCJ compression | 952,943,430 | 952.9 MB |

The complete installer is 260,440,305 bytes smaller: a 21.46% reduction. The improvement is in the EXE itself, with no separate ZIP wrapper required.

To verify installer extraction, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/installer-extraction.ps1 -Installer release-final/Switchyard-Setup-1.1.2.exe`. This uses the same NSIS extraction plugin as the installer in an isolated workspace, then compares every extracted file with `win-unpacked` using SHA-256. It does not register an installation or replace the user's installed app.

The native extraction check passed for all 41,275 packaged files (4,040,816,764 bytes); every file's SHA-256 matched. The checked application source/build artifacts also matched the package. Size and integrity evidence is in [installer-compression-1.1.2.json](verification/installer-compression-1.1.2.json).
