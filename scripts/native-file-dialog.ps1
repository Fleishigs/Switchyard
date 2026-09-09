param([int]$AppProcessId,[string]$FilePath,[switch]$Cancel)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeDialogControl {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h,int message,IntPtr w,string text);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int message,IntPtr w,IntPtr l);
}
"@
$deadline = [DateTime]::UtcNow.AddSeconds(25)
$condition = New-Object System.Windows.Automation.AndCondition(
 (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$AppProcessId)),
 (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770')))
$dialog = $null
while ([DateTime]::UtcNow -lt $deadline) {
 $ownerCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$AppProcessId)
 $owner = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$ownerCondition)
 if ($owner) { $dialog = $owner.FindFirst([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Window))) }
 if (-not $dialog) { $dialog = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition) }
 if ($dialog) { break }
 Start-Sleep -Milliseconds 150
}
if (-not $dialog) { $items=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition); foreach($item in $items){if($item.Current.ProcessId -eq $AppProcessId -or $item.Current.Name -eq 'Open Fig backup') {Write-Output ($item.Current.Name+' / '+$item.Current.ClassName+' / '+$item.Current.ProcessId)}};throw 'Native file dialog did not open.' }
$readyDeadline = [DateTime]::UtcNow.AddSeconds(15)
do {
 $elements = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $hasCancel = $false
 foreach ($element in $elements) { if ($element.Current.ClassName -eq 'Button' -and $element.Current.AutomationId -eq '2') { $hasCancel = $true; break } }
 if (-not $hasCancel) { Start-Sleep -Milliseconds 200 }
} while (-not $hasCancel -and [DateTime]::UtcNow -lt $readyDeadline)
if (-not $Cancel) {
 $edit = $null
 foreach ($element in $elements) {
  if ($element.Current.ClassName -eq 'Edit' -and ($element.Current.Name -match '^File name' -or $element.Current.AutomationId -in @('1148','1001'))) { $edit = $element; break }
 }
 if (-not $edit) { foreach($element in $elements){if($element.Current.ClassName -eq 'Edit'){Write-Output ('Edit label: '+$element.Current.Name+' / '+$element.Current.AutomationId)}};throw 'File name field was not found.' }
 [void][NativeDialogControl]::SendMessage([IntPtr]$edit.Current.NativeWindowHandle,12,[IntPtr]::Zero,$FilePath)
}
$button = $null
foreach ($element in $elements) {
 if ($element.Current.ClassName -eq 'Button') {
  if (($Cancel -and ($element.Current.Name -match 'Cancel' -or $element.Current.AutomationId -eq '2')) -or (-not $Cancel -and $element.Current.AutomationId -eq '1')) { $button=$element;break }
 }
}
if (-not $button) { Write-Output ('Dialog: '+$dialog.Current.Name+' / '+$dialog.Current.ClassName);foreach($element in $elements){if($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button){Write-Output ($element.Current.Name+' / '+$element.Current.AutomationId)}};throw 'Dialog action button was not found.' }
Write-Output ('Selected '+$button.Current.Name+' / '+$button.Current.ClassName+' / '+$button.Current.ControlType.ProgrammaticName+' / '+$button.Current.AutomationId)
[void][NativeDialogControl]::PostMessage([IntPtr]$button.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)
Write-Output ('Native dialog verified: '+$dialog.Current.Name)
