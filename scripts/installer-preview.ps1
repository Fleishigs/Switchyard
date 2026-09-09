param([string]$Installer,[string]$Screenshot,[int]$ExistingProcessId=0)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class InstallerWindow {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int message,IntPtr w,IntPtr l);
}
"@
$process=if($ExistingProcessId){Get-Process -Id $ExistingProcessId}else{Start-Process -FilePath $Installer -WindowStyle Normal -PassThru}
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$process.Id)
$deadline=[DateTime]::UtcNow.AddSeconds(90)
$window=$null
while([DateTime]::UtcNow -lt $deadline){$window=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition);if($window -and $window.Current.Name.Trim() -eq 'Switchyard Setup'){break};Start-Sleep -Milliseconds 200}
if(-not $window){throw 'Installer window did not appear.'}
Start-Sleep -Milliseconds 700
[void][InstallerWindow]::SetThreadDpiAwarenessContext([IntPtr](-4))
$rect=New-Object InstallerWindow+Rect
$handle=[IntPtr]$window.Current.NativeWindowHandle
[void][InstallerWindow]::GetWindowRect($handle,[ref]$rect)
$bitmap=New-Object System.Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
$dc=$graphics.GetHdc()
try{[void][InstallerWindow]::PrintWindow($handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
$bitmap.Save($Screenshot,[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose();$bitmap.Dispose()
Write-Output ('Installer window rendered: '+$window.Current.Name)
# Close only the preview installer owned by this test. No install has begun.
[void][InstallerWindow]::PostMessage($handle,16,[IntPtr]::Zero,[IntPtr]::Zero)
Start-Sleep -Milliseconds 500
if ($process.HasExited) { exit 0 }
$children=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
foreach($child in $children){if($child.Current.ClassName -eq 'Button' -and $child.Current.Name -match '^(&?Yes|&?OK)$'){[void][InstallerWindow]::PostMessage([IntPtr]$child.Current.NativeWindowHandle,245,[IntPtr]::Zero,[IntPtr]::Zero)}}
if(-not $process.WaitForExit(10000)){throw 'Installer preview did not close.'}
