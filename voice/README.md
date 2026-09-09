# Switchyard Voice

Standalone Windows .NET companion. Ctrl+Shift+Space push-to-talk; local whisper.cpp CPU transcription; optional paste only if the original window still has focus; line breaks flattened before insertion. Windows command mode accepts only the nine displayed exact phrases. No cloud transcription or arbitrary shell instructions.

The original WisprNative project remains unchanged. Native keyboard, clipboard, and microphone helpers are adapted from that user-owned project. Models and whisper.cpp retain their upstream licenses.

Build: `dotnet publish -c Release -r win-x64 --self-contained true -o publish`.
The UI can be closed to the tray; exit from the tray menu. Settings and the latest transcript live in `%LOCALAPPDATA%/SwitchyardVoice`.

Choose whisper-cli.exe and a ggml model on first run if bundled engines are unavailable. Tiny English is small and fast, but accuracy varies with microphone, speech and CPU. A model is loaded for each utterance to keep idle memory low.
