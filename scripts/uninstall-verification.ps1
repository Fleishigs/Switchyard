param([string]$ProjectRoot)
$ErrorActionPreference='Stop'
$destination=Join-Path $env:LOCALAPPDATA 'SwitchyardInstallVerification'
$resolved=[IO.Path]::GetFullPath($destination)
if($resolved -ne (Join-Path $env:LOCALAPPDATA 'SwitchyardInstallVerification')){throw 'Unexpected test installation path.'}
$uninstaller=Join-Path $resolved 'Uninstall Switchyard.exe'
if(-not (Test-Path -LiteralPath $uninstaller)){throw 'Verification uninstaller is missing.'}
$entries=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -match '^Switchyard(?: \d.*)?$'}
if(-not $entries -or @($entries).Count -ne 1 -or $entries.UninstallString -notlike ('*'+$resolved+'*')){throw 'Registry does not identify the scoped verification installation.'}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;using System.Runtime.InteropServices;
public static class UninstallButton{[DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);}
"@
$process=Start-Process -FilePath $uninstaller -ArgumentList ('_?='+$resolved) -WindowStyle Normal -PassThru
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$process.Id)
$results=New-Object System.Collections.Generic.List[string]
$deadline=[DateTime]::UtcNow.AddMinutes(5)
$clicked=$null
while([DateTime]::UtcNow -lt $deadline){
 if($process.HasExited){break}
 $window=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition)
 if($window){
  $elements=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  foreach($element in $elements){
   $name=$element.Current.Name
   if($element.Current.ClassName -eq 'Button' -and $element.Current.IsEnabled -and $name -match '^(&?Next >|&?Uninstall|&?Finish)$' -and $clicked -ne $name){
    $clicked=$name;$results.Add('Clicked '+$name);Write-Output ('PASS '+$name)
    [void][UninstallButton]::PostMessage([IntPtr]$element.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)
    break
   }
  }
 }
 Start-Sleep -Milliseconds 250
}
if(-not $process.HasExited){throw 'Uninstaller did not finish.'}
if($process.ExitCode -ne 0){throw ('Uninstaller exit '+$process.ExitCode)}
if(Test-Path -LiteralPath (Join-Path $resolved 'Switchyard.exe')){throw 'Application remains after uninstall.'}
$remaining=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -match '^Switchyard(?: \d.*)?$'}
if($remaining){throw 'Uninstall registry entry remains.'}
$results.Add('Executable and uninstall registration removed')
@{passed=$true;destination=$resolved;results=$results}|ConvertTo-Json -Depth 4|Set-Content (Join-Path $ProjectRoot 'docs/verification/uninstall-flow.json') -Encoding utf8
