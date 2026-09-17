# Switchyard 1.1.1

The Windows installer now includes Deno 2.9.6 beside yt-dlp. YouTube extraction needs a supported JavaScript runtime; the 1.1.0 installer omitted one, causing a missing-runtime warning and potentially unavailable formats or failed downloads. The official yt-dlp executable already includes its EJS challenge scripts.

Deno is detected automatically beside yt-dlp on Windows, including when Switchyard ignores user yt-dlp configuration. No system runtime installation or user PATH change is needed. Deno's MIT license and a manifest containing its upstream download URL and SHA-256 hashes are included.

For a fresh build environment, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-youtube-runtime.ps1` to download and verify the pinned runtime before packaging.

This fixes the packaged runtime dependency. Videos can still be unavailable because of removal, account requirements, geographic restrictions, or changes to YouTube.

Validation: both Download audio and Download video completed for the reported YouTube Music link in the packaged application, with system JavaScript runtimes excluded from PATH. The MP3 duration was 148.600 seconds and the MP4 duration was 148.621 seconds; both results played in the application. The upstream Deno archive checksum was verified before packaging. The repeatable network integration check is `node tests/youtube-download.mjs <YouTube URL>`.
