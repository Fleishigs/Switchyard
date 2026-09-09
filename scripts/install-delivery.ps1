param([string]$ProjectRoot)
$ErrorActionPreference='Stop'
$destination=Join-Path $env:LOCALAPPDATA 'Programs\Switchyard'
if(Test-Path -LiteralPath (Join-Path $destination 'Switchyard.exe')){throw 'An installation already exists at the delivery path; inspect before replacing it.'}
$installer=Join-Path $ProjectRoot 'release-final\Switchyard-Setup-1.0.1.exe'
$process=Start-Process -FilePath $installer -ArgumentList '/S','/currentuser',('/D='+$destination) -WindowStyle Hidden -PassThru
Write-Output ('Installing delivery copy, process '+$process.Id)
$deadline=[DateTime]::UtcNow.AddMinutes(25)
while(-not $process.HasExited){if([DateTime]::UtcNow -gt $deadline){throw 'Delivery installation exceeded its expected duration.'};Start-Sleep -Seconds 3}
if($process.ExitCode -ne 0){throw ('Delivery installer exit '+$process.ExitCode)}
$executable=Join-Path $destination 'Switchyard.exe'
if(-not (Test-Path -LiteralPath $executable)){throw 'Delivery executable missing.'}
$shortcutPath=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Switchyard.lnk'
if(-not (Test-Path -LiteralPath $shortcutPath)){throw 'Installer did not create the desktop shortcut.'}
$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
if($shortcut.TargetPath -ne $executable){throw 'Desktop shortcut points to an unexpected installation.'}
$installedHash=(Get-FileHash -LiteralPath (Join-Path $destination 'resources\app.asar') -Algorithm SHA256).Hash
$testedHash=(Get-FileHash -LiteralPath (Join-Path $ProjectRoot 'release-final\win-unpacked\resources\app.asar') -Algorithm SHA256).Hash
if($installedHash -ne $testedHash){throw 'Installed app archive differs from tested package.'}
@{passed=$true;destination=$destination;shortcut=$shortcutPath;appArchiveSha256=$installedHash;results=@('Silent per-user installation exits successfully','Desktop shortcut points to delivery executable','Installed archive matches tested package')}|ConvertTo-Json -Depth 4|Set-Content (Join-Path $ProjectRoot 'docs/verification/delivery-install.json') -Encoding utf8
Write-Output 'PASS delivery installation and desktop shortcut'
