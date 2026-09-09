param([string]$ProjectRoot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class VoiceControl {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,string text);
 [DllImport("user32.dll",EntryPoint="SendMessageW")] public static extern IntPtr SendNumber(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
}
"@
$env:SWITCHYARD_ENGINES=Join-Path $ProjectRoot 'engines'
$env:SWITCHYARD_VOICE_TEST_DATA=Join-Path $ProjectRoot ('.runtime-voice-ui-'+[guid]::NewGuid().ToString('N'))
$process=Start-Process -FilePath (Join-Path $ProjectRoot 'voice/publish/SwitchyardVoice.exe') -WindowStyle Normal -PassThru
$results=New-Object System.Collections.Generic.List[string]
try {
 $condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$process.Id)
 $deadline=[DateTime]::UtcNow.AddSeconds(20);$window=$null
 while([DateTime]::UtcNow -lt $deadline){$window=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition);if($window){break};Start-Sleep -Milliseconds 150}
 if(-not $window){throw 'Voice window did not open.'}
 [void][VoiceControl]::SendMessage([IntPtr]$window.Current.NativeWindowHandle,12,[IntPtr]::Zero,'Switchyard Voice verification - synthetic test')
 function Elements { $window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) }
 function Find-Name([string]$name){foreach($element in (Elements)){if($element.Current.Name -eq $name){return $element}};throw ('Missing control: '+$name)}
 function Click-Name([string]$name){$element=Find-Name $name;[void][VoiceControl]::PostMessage([IntPtr]$element.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)}
 foreach($name in @('Choose Whisper','Choose model','Start recording','Cancel','Copy transcript','Paste into the original app')){[void](Find-Name $name)}
 $results.Add('All voice controls render')
 Click-Name 'Choose Whisper'
 & (Join-Path $ProjectRoot 'scripts/native-file-dialog.ps1') -AppProcessId $process.Id -FilePath (Join-Path $ProjectRoot 'engines/whisper/Release/whisper-cli.exe')
 Click-Name 'Choose model'
 & (Join-Path $ProjectRoot 'scripts/native-file-dialog.ps1') -AppProcessId $process.Id -FilePath (Join-Path $ProjectRoot 'engines/ggml-tiny.en.bin')
 $results.Add('Whisper and model buttons use real Windows file pickers')
 $combo=$null;$textBox=$null
 foreach($element in (Elements)){if($element.Current.ClassName -like '*COMBOBOX*'){$combo=$element};if($element.Current.ClassName -like '*EDIT*'){$textBox=$element}}
 if(-not $combo -or -not $textBox){throw 'Voice mode or transcript control is missing.'}
 $comboHandle=[IntPtr]$combo.Current.NativeWindowHandle
 [void][VoiceControl]::PostMessage($comboHandle,256,[IntPtr]40,[IntPtr]::Zero)
 [void][VoiceControl]::PostMessage($comboHandle,257,[IntPtr]40,[IntPtr]::Zero)
 Click-Name 'Paste into the original app'
 Start-Sleep -Milliseconds 250
 $settings=Get-Content -LiteralPath (Join-Path $env:SWITCHYARD_VOICE_TEST_DATA 'settings.json') -Raw | ConvertFrom-Json
 if(-not $settings.Commands -or $settings.AutoPaste){throw 'Voice mode or auto-paste toggle did not persist.'}
 $results.Add('Mode selection and auto-paste toggle persist in an isolated profile')
 $clipboard=[System.Windows.Forms.Clipboard]::GetDataObject()
 try {
  [void][VoiceControl]::SendMessage([IntPtr]$textBox.Current.NativeWindowHandle,12,[IntPtr]::Zero,'Switchyard synthetic transcript')
  Click-Name 'Copy transcript';Start-Sleep -Milliseconds 200
  if([System.Windows.Forms.Clipboard]::GetText() -ne 'Switchyard synthetic transcript'){throw 'Copy transcript failed.'}
 } finally {if($clipboard){[System.Windows.Forms.Clipboard]::SetDataObject($clipboard,$true)}else{[System.Windows.Forms.Clipboard]::Clear()}}
 $results.Add('Copy transcript button copies synthetic text')
 Click-Name 'Start recording';Start-Sleep -Milliseconds 600
 [void](Find-Name 'Stop recording');Click-Name 'Cancel';Start-Sleep -Milliseconds 400
 [void](Find-Name 'Start recording');[void](Find-Name 'Cancelled')
 $results.Add('Start recording and Cancel reset capture without transcription')
 [void][VoiceControl]::PostMessage($comboHandle,256,[IntPtr]38,[IntPtr]::Zero)
 [void][VoiceControl]::PostMessage($comboHandle,257,[IntPtr]38,[IntPtr]::Zero)
 Start-Sleep -Milliseconds 200
 $settings=Get-Content -LiteralPath (Join-Path $env:SWITCHYARD_VOICE_TEST_DATA 'settings.json') -Raw | ConvertFrom-Json
 if($settings.Commands -or $settings.AutoPaste){throw 'Device test requires dictation mode with auto-paste disabled.'}
 Click-Name 'Start recording';Start-Sleep -Milliseconds 650;Click-Name 'Stop recording'
 $transcriptPath=Join-Path $env:SWITCHYARD_VOICE_TEST_DATA 'last-transcript.txt'
 $stopDeadline=[DateTime]::UtcNow.AddSeconds(45)
 while(-not (Test-Path -LiteralPath $transcriptPath) -and [DateTime]::UtcNow -lt $stopDeadline){Start-Sleep -Milliseconds 200}
 if(-not (Test-Path -LiteralPath $transcriptPath)){throw 'Stop recording did not finish local transcription.'}
 $results.Add('Stop recording completes local transcription with commands and auto-paste disabled')
 $report=@{passed=$results.Count;results=$results}|ConvertTo-Json -Depth 4
 Set-Content -LiteralPath (Join-Path $ProjectRoot 'docs/verification/voice-ui.json') -Value $report -Encoding utf8
 Write-Output $report
} finally {if(-not $process.HasExited){$process.Kill();$process.WaitForExit()};$process.Dispose()}
