; Test-only harness: no installation registration, shortcuts, or app launch.
; Paths are supplied by installer-extraction.ps1.
Unicode true
Name "Switchyard installer payload verification"
OutFile "${SMOKE_EXE}"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
!addplugindir "${PLUGIN_DIR}"
Section
  SetOutPath "${EXTRACTED_DIR}"
  Nsis7z::Extract "${PAYLOAD}"
  IfFileExists "$OUTDIR\Switchyard.exe" success
  SetErrorLevel 1
  Quit
  success:
  SetErrorLevel 0
SectionEnd
