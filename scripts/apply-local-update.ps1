param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
$destination=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\Switchyard'))
$source=Join-Path $ProjectRoot 'release-final\win-unpacked'
$executable=Join-Path $destination 'Switchyard.exe'
if(-not (Test-Path -LiteralPath $executable)){throw 'Expected installed application is missing.'}
$running=Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $executable}
if($running){throw 'Installed Switchyard is still running; no files were changed.'}
$entry=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -match '^Switchyard(?: \d.*)?$' -and $_.UninstallString -like ('*'+$destination+'*')}
if(@($entry).Count -ne 1){throw 'Cannot identify this installation registration.'}
$version=(Get-Content (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
$backup=Join-Path $ProjectRoot ('.runtime-update-backup-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
[void](New-Item -ItemType Directory -Path (Join-Path $backup 'resources') -Force)
$files=@('Switchyard.exe','resources\app.asar','resources\app.asar.unpacked')
foreach($file in $files){Copy-Item -LiteralPath (Join-Path $destination $file) -Destination (Join-Path $backup (Split-Path $file -Parent)) -Recurse -Force}
@{DisplayName=$entry.DisplayName;DisplayVersion=$entry.DisplayVersion;PSPath=$entry.PSPath}|ConvertTo-Json|Set-Content (Join-Path $backup 'registration.json') -Encoding utf8
try{
 foreach($file in $files){Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $destination (Split-Path $file -Parent)) -Recurse -Force}
 foreach($file in @('Switchyard.exe','resources\app.asar')){if((Get-FileHash -LiteralPath (Join-Path $source $file)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $destination $file)).Hash){throw ('Update hash mismatch: '+$file)}}
 Set-ItemProperty -LiteralPath $entry.PSPath -Name DisplayVersion -Value $version
 Set-ItemProperty -LiteralPath $entry.PSPath -Name DisplayName -Value ('Switchyard '+$version)
}catch{
 foreach($file in $files){Copy-Item -LiteralPath (Join-Path $backup $file) -Destination (Join-Path $destination (Split-Path $file -Parent)) -Recurse -Force}
 Set-ItemProperty -LiteralPath $entry.PSPath -Name DisplayVersion -Value $entry.DisplayVersion
 Set-ItemProperty -LiteralPath $entry.PSPath -Name DisplayName -Value $entry.DisplayName
 throw
}
@{passed=$true;version=$version;destination=$destination;backup=$backup;method='Local application-content update with rollback backup; existing engines and uninstaller retained'}|ConvertTo-Json|Set-Content (Join-Path $ProjectRoot 'docs/verification/local-update-1.0.2.json') -Encoding utf8
Write-Output ('PASS installed application updated to '+$version)
