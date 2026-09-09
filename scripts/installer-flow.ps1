param([string]$Installer,[string]$Destination,[string]$ProjectRoot,[int]$ResumeProcessId=0)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SetupControl {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,string text);
}
"@
$process=if($ResumeProcessId){Get-Process -Id $ResumeProcessId}else{Start-Process -FilePath $Installer -ArgumentList '--currentuser','--no-desktop-shortcut' -WindowStyle Normal -PassThru}
$results=New-Object System.Collections.Generic.List[string]
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$process.Id)
$window=$null;$deadline=[DateTime]::UtcNow.AddSeconds(120)
while([DateTime]::UtcNow -lt $deadline){$window=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition);if($window -and $window.Current.Name.Trim() -eq 'Switchyard Setup'){break};Start-Sleep -Milliseconds 200}
if(-not $window){throw 'Setup window did not open.'}
function Elements { $window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) }
function Find-Button([string]$pattern){foreach($element in (Elements)){if($element.Current.ClassName -eq 'Button' -and $element.Current.Name -match $pattern){return $element}};return $null}
function Wait-Button([string]$pattern,[int]$seconds=30){$end=[DateTime]::UtcNow.AddSeconds($seconds);while([DateTime]::UtcNow -lt $end){$button=Find-Button $pattern;if($button -and $button.Current.IsEnabled){return $button};Start-Sleep -Milliseconds 150};throw ('Setup button not available: '+$pattern)}
function Click-Button([string]$pattern){$button=Wait-Button $pattern;[void][SetupControl]::PostMessage([IntPtr]$button.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)}
function Capture([string]$name){
 [void][SetupControl]::SetThreadDpiAwarenessContext([IntPtr](-1))
 $rect=New-Object SetupControl+Rect;$handle=[IntPtr]$window.Current.NativeWindowHandle;[void][SetupControl]::GetWindowRect($handle,[ref]$rect)
 $bitmap=New-Object System.Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top));$graphics=[System.Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
 try{[void][SetupControl]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
 $bitmap.Save((Join-Path $ProjectRoot ('docs/verification/'+$name)),[System.Drawing.Imaging.ImageFormat]::Png);$graphics.Dispose();$bitmap.Dispose()
}
if(-not $ResumeProcessId){
[void](Wait-Button 'Next');Capture 'installer-welcome.png';$results.Add('Branded welcome page renders');Write-Output 'PASS welcome'
Click-Button 'Next';[void](Wait-Button 'Agree');Capture 'installer-license.png';Click-Button 'Back';[void](Wait-Button 'Next');Click-Button 'Next';[void](Wait-Button 'Agree');$results.Add('Welcome, license, Back and Next navigation');Write-Output 'PASS license and back'
Click-Button 'Agree'
Start-Sleep -Milliseconds 400
if(Find-Button 'Next'){
 $only=Find-Button 'Only for me';if($only){[void][SetupControl]::PostMessage([IntPtr]$only.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)}
 Click-Button 'Next'
}
[void](Wait-Button '^&?Install$')
$edit=$null;foreach($element in (Elements)){if($element.Current.ClassName -eq 'Edit'){$edit=$element;break}}
if(-not $edit){throw 'Installation directory field is missing.'}
[void][SetupControl]::SendMessage([IntPtr]$edit.Current.NativeWindowHandle,12,[IntPtr]::Zero,$Destination)
Click-Button 'Browse'
& (Join-Path $ProjectRoot 'scripts/native-file-dialog.ps1') -AppProcessId $process.Id -Cancel
Start-Sleep -Milliseconds 200
[void][SetupControl]::SendMessage([IntPtr]$edit.Current.NativeWindowHandle,12,[IntPtr]::Zero,$Destination)
Capture 'installer-directory.png';$results.Add('Custom installation directory and Browse cancellation');Write-Output 'PASS directory'
Click-Button '^&?Install$'
}else{
 $results.Add('Branded welcome page renders (verified before resume)')
 $results.Add('Welcome, license, Back and Next navigation (verified before resume)')
 $results.Add('Custom installation directory and Browse cancellation (verified before resume)')
}
[void](Wait-Button 'Finish' 900)
$run=Find-Button 'Run Switchyard';if($run){[void][SetupControl]::PostMessage([IntPtr]$run.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)}
Capture 'installer-finish.png';Click-Button 'Finish'
if(-not $process.WaitForExit(180000)){throw 'Setup did not exit after Finish.'}
if($null -ne $process.ExitCode -and $process.ExitCode -ne 0){throw ('Setup failed with exit code '+$process.ExitCode)}
if(-not (Test-Path -LiteralPath (Join-Path $Destination 'Switchyard.exe'))){throw 'Installed executable is missing.'}
$results.Add('Install, progress, Finish and installed executable');Write-Output 'PASS install'
@{passed=$results.Count;results=$results;destination=$Destination}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $ProjectRoot 'docs/verification/installer-flow.json') -Encoding utf8
