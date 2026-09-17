param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$installerPath=(Resolve-Path -LiteralPath $Installer).Path
$work=Join-Path $root '.runtime-compression-check'
if(Test-Path -LiteralPath $work){throw 'Prior .runtime-compression-check exists; review and clean it before rerunning.'}
New-Item -ItemType Directory -Path $work | Out-Null
$cache=Join-Path $env:LOCALAPPDATA 'electron-builder/Cache'
$compiler=Get-ChildItem -LiteralPath (Join-Path $cache 'nsis-3.0.4.1') -Recurse -Filter makensis.exe | Where-Object {$_.Directory.Name -eq 'Bin'} | Select-Object -First 1
$plugin=Get-ChildItem -LiteralPath (Join-Path $cache 'nsis-resources-3.4.1') -Recurse -Filter nsis7z.dll | Where-Object {$_.Directory.Name -eq 'x86-unicode'} | Select-Object -First 1
if(-not $compiler -or -not $plugin){throw 'Run the installer build first to populate the NSIS tool cache.'}
$sevenZip=Join-Path $root 'engines/7zip/7z.exe'
& $sevenZip t $installerPath
if($LASTEXITCODE -ne 0){throw 'NSIS archive integrity failed.'}
& $sevenZip e $installerPath "-o$work" '$PLUGINSDIR/app-64.7z' -y
if($LASTEXITCODE -ne 0){throw 'Could not extract the embedded payload.'}
$payload=Join-Path $work 'app-64.7z'
if(-not(Test-Path -LiteralPath $payload)){throw 'Installer has no x64 payload.'}
$extracted=Join-Path $work 'app'
$smokeExe=Join-Path $work 'extract-test.exe'
& $compiler.FullName '-V2' "-DSMOKE_EXE=$smokeExe" "-DEXTRACTED_DIR=$extracted" "-DPAYLOAD=$payload" "-DPLUGIN_DIR=$($plugin.Directory.FullName)" (Join-Path $PSScriptRoot 'installer-extraction.nsi')
if($LASTEXITCODE -ne 0){throw 'Could not compile extraction harness.'}
$process=Start-Process -FilePath $smokeExe -WindowStyle Hidden -PassThru
$process.WaitForExit()
if($process.ExitCode -ne 0){throw 'Installer extractor did not restore the application.'}
& node (Join-Path $root 'scripts/verify-installer-payload.mjs') (Join-Path $root 'release-final/win-unpacked') $extracted (Join-Path $work 'verification.json')
if($LASTEXITCODE -ne 0){throw 'Extracted file inventory or SHA-256 mismatch.'}
Write-Output "Verified installer extraction: $extracted"
