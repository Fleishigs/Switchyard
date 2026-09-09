# Switchyard

User direction: Material 3 Expressive for Windows; roughly seventy useful tools in one app; image enhancement/cropping, YouTube downloads, UVR vocal separation, local dictation and explicit voice commands. Match installer branding and test every implemented flow. Preserve existing projects.

Architecture: isolated Electron renderer, narrow IPC, allowlisted processing operations, shared job queue, unique output folders. React interface with searchable catalogue, file tray, favorites, history, local command routing. No arbitrary shell execution from chat. Optional local model engines are separate from the lightweight interface.

Release gates: registry-wide processing tests with real fixture files, failure/cancellation tests, native Electron interaction tests, visual review at desktop/laptop sizes, packaged executable smoke test, installer inspection. Record unverified third-party/network/model flows explicitly.

Sources: https://github.com/ggml-org/whisper.cpp ; https://github.com/nomadkaraoke/python-audio-separator ; https://github.com/yt-dlp/yt-dlp ; https://sharp.pixelplumbing.com ; https://www.electronjs.org/docs/latest/tutorial/security
