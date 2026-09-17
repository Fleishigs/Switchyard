$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$version = 'v2.9.6'
$archiveHash = '15e5300b0ba3c3695a7621d90160a746ec9e710228cee639afa9d580f6e3cd11'
$url = "https://github.com/denoland/deno/releases/download/$version/deno-x86_64-pc-windows-msvc.zip"
$stage = Join-Path $projectRoot ('.runtime-deno-' + [guid]::NewGuid().ToString('N'))
$engines = Join-Path $projectRoot 'engines'
New-Item -ItemType Directory -Path $stage,$engines -Force | Out-Null
$archive = Join-Path $stage 'deno.zip'
Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) {
    throw 'Deno archive SHA-256 mismatch; runtime was not installed.'
}
Expand-Archive -LiteralPath $archive -DestinationPath $stage
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/denoland/deno/$version/LICENSE.md" -OutFile (Join-Path $stage 'deno-LICENSE.md') -UseBasicParsing
Copy-Item -LiteralPath (Join-Path $stage 'deno.exe'),(Join-Path $stage 'deno-LICENSE.md') -Destination $engines -Force
$manifest = [ordered]@{
    version = $version
    url = $url
    archiveSha256 = $archiveHash
    executableSha256 = (Get-FileHash -LiteralPath (Join-Path $engines 'deno.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
}
[IO.File]::WriteAllText((Join-Path $engines 'deno-provenance.json'), ($manifest | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
Write-Output "Prepared verified Deno $version for YouTube downloads."
