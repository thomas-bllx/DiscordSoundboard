$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $taskRoot 'vendor\ffmpeg-source\ffmpeg-9.0.2'
$sourceArchive = Join-Path $taskRoot 'vendor\ffmpeg-source\ffmpeg-9.0.2.tar.xz'
$sourceHash = '8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e'
if ((Get-FileHash -LiteralPath $sourceArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) {
  throw 'Les sources FFmpeg ne correspondent pas a l archive attendue.'
}
$binary = Join-Path $sourceRoot 'ffmpeg.exe'
$versionOutput = (& $binary -version 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch 'ffmpeg version 9\.0\.2' -or $versionOutput -notmatch '--disable-autodetect' -or $versionOutput -match '--enable-(gpl|nonfree|version3|lib)') {
  throw 'Configuration FFmpeg inattendue : ne pas publier ce binaire.'
}
$runtimeRoot = Join-Path $taskRoot 'vendor\ffmpeg-runtime'
$bundleRoot = Join-Path $taskRoot 'vendor\ffmpeg-source-bundle'
$releaseRoot = Join-Path $taskRoot 'release'
New-Item -ItemType Directory -Path $runtimeRoot, $bundleRoot, $releaseRoot -Force | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false
$binaryHash = (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant()
$baseUrl = 'https://github.com/thomas-bllx/DiscordSoundboard/releases/download/v1.1.1'
$binaryName = 'ffmpeg-9.0.2-soundboard-win64.zip'
$sourcesName = 'ffmpeg-9.0.2-soundboard-sources.zip'
Copy-Item -LiteralPath $binary -Destination (Join-Path $runtimeRoot 'ffmpeg.exe') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'COPYING.LGPLv2.1') -Destination (Join-Path $runtimeRoot 'LICENSE') -Force
Copy-Item -LiteralPath (Join-Path $taskRoot 'docs\FFMPEG-BUILD.md') -Destination (Join-Path $runtimeRoot 'README.txt') -Force
$manifest = [ordered]@{
  version = '9.0.2'; variant = 'soundboard-audio'; license = 'LGPL-2.1-or-later';
  sha256 = $binaryHash; source = 'https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz';
  sourceSha256 = $sourceHash; correspondingSources = "$baseUrl/$sourcesName";
}
[IO.File]::WriteAllText((Join-Path $runtimeRoot 'manifest.json'), ($manifest | ConvertTo-Json), $utf8)
Copy-Item -LiteralPath $sourceArchive -Destination (Join-Path $bundleRoot 'ffmpeg-9.0.2.tar.xz') -Force
Copy-Item -LiteralPath (Join-Path $taskRoot 'scripts\build-ffmpeg.sh') -Destination (Join-Path $bundleRoot 'build-ffmpeg.sh') -Force
Copy-Item -LiteralPath (Join-Path $taskRoot 'docs\FFMPEG-BUILD.md') -Destination (Join-Path $bundleRoot 'BUILDING.md') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'COPYING.LGPLv2.1') -Destination (Join-Path $bundleRoot 'COPYING.LGPLv2.1') -Force
$runtimeFiles = @('ffmpeg.exe', 'LICENSE', 'README.txt', 'manifest.json') | ForEach-Object { Join-Path $runtimeRoot $_ }
$sourceFiles = @('ffmpeg-9.0.2.tar.xz', 'build-ffmpeg.sh', 'BUILDING.md', 'COPYING.LGPLv2.1') | ForEach-Object { Join-Path $bundleRoot $_ }
Compress-Archive -LiteralPath $runtimeFiles -DestinationPath (Join-Path $releaseRoot $binaryName) -Force
Compress-Archive -LiteralPath $sourceFiles -DestinationPath (Join-Path $releaseRoot $sourcesName) -Force
$spec = [ordered]@{
  version = '9.0.2'; variant = 'soundboard-audio'; license = 'LGPL-2.1-or-later';
  url = "$baseUrl/$binaryName";
  archiveSha256 = (Get-FileHash -LiteralPath (Join-Path $releaseRoot $binaryName) -Algorithm SHA256).Hash.ToLowerInvariant();
  binarySha256 = $binaryHash;
  sourcesUrl = "$baseUrl/$sourcesName";
  sourcesSha256 = (Get-FileHash -LiteralPath (Join-Path $releaseRoot $sourcesName) -Algorithm SHA256).Hash.ToLowerInvariant();
  upstreamSource = $manifest.source; upstreamSourceSha256 = $sourceHash;
}
[IO.File]::WriteAllText((Join-Path $taskRoot 'resources\ffmpeg-runtime.json'), (($spec | ConvertTo-Json) + "`n"), $utf8)
Copy-Item -LiteralPath (Join-Path $releaseRoot $binaryName) -Destination (Join-Path $taskRoot 'vendor\ffmpeg-soundboard.zip') -Force
Write-Output 'Paquets FFmpeg binaire et sources crees, empreintes enregistrees.'
