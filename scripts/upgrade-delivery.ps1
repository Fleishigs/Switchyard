param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
$version=(Get-Content (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
$destination=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\Switchyard'))
$executable=Join-Path $destination 'Switchyard.exe'
if(-not (Test-Path -LiteralPath $executable)){throw 'The expected installed application is missing.'}
if(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $executable}){throw 'Close the running application before upgrading.'}
$statePath=Join-Path $env:APPDATA 'Switchyard\state.json'
$stateHash=if(Test-Path -LiteralPath $statePath){(Get-FileHash -LiteralPath $statePath -Algorithm SHA256).Hash}else{$null}
$installer=Join-Path $ProjectRoot ('release-final\Switchyard-Setup-'+$version+'.exe')
if(-not (Test-Path -LiteralPath $installer)){throw 'The finished installer is missing.'}
$process=Start-Process -FilePath $installer -ArgumentList '/S','/currentuser',('/D='+$destination) -WindowStyle Hidden -PassThru
Write-Output ('Upgrading Switchyard using its full installer, process '+$process.Id)
$deadline=[DateTime]::UtcNow.AddMinutes(25)
while(-not $process.HasExited){if([DateTime]::UtcNow -gt $deadline){throw 'Installer exceeded its expected duration.'};Start-Sleep -Seconds 2}
if($process.ExitCode -ne 0){throw ('Installer exit code '+$process.ExitCode)}
$installedHash=(Get-FileHash -LiteralPath (Join-Path $destination 'resources\app.asar') -Algorithm SHA256).Hash
$packagedHash=(Get-FileHash -LiteralPath (Join-Path $ProjectRoot 'release-final\win-unpacked\resources\app.asar') -Algorithm SHA256).Hash
if($installedHash -ne $packagedHash){throw 'Installed archive differs from the verified package.'}
if($stateHash -and (Get-FileHash -LiteralPath $statePath -Algorithm SHA256).Hash -ne $stateHash){throw 'Saved application state changed during installation.'}
$shortcutPath=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Switchyard.lnk'
$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
if($shortcut.TargetPath -ne $executable){throw 'Desktop shortcut does not point to the upgraded application.'}
$entry=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -match '^Switchyard(?: \d.*)?$' -and $_.UninstallString -like ('*'+$destination+'*')}
if(@($entry).Count -ne 1 -or $entry.DisplayVersion -ne $version){throw 'Installed version registration is incorrect.'}
@{passed=$true;version=$version;installedArchiveMatches=$true;savedStateUnchanged=$true;desktopShortcutCorrect=$true;registeredVersion=$entry.DisplayVersion;installerSha256=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash}|ConvertTo-Json|Set-Content (Join-Path $ProjectRoot 'docs/verification/installer-upgrade.json') -Encoding utf8
Write-Output ('PASS full installer upgrade to '+$version+', archive integrity, saved state and desktop shortcut')
