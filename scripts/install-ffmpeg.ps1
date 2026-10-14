$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ffmpegDirectory = Join-Path $taskRoot 'vendor\ffmpeg'
$ffmpegExe = Join-Path $ffmpegDirectory 'ffmpeg.exe'
$manifestPath = Join-Path $ffmpegDirectory 'manifest.json'
$archiveHash = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
function Get-SoundboardSha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}
if ((Test-Path -LiteralPath $ffmpegExe) -and (Test-Path -LiteralPath $manifestPath)) {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.version -eq '9.0.2' -and $manifest.sha256 -eq (Get-SoundboardSha256 $ffmpegExe)) {
    Write-Output 'FFmpeg 9.0.2 verifie et deja disponible.'
    exit 0
  }
}
New-Item -ItemType Directory -Path $ffmpegDirectory -Force | Out-Null
$archivePath = Join-Path $taskRoot 'vendor\ffmpeg-9.0.2.zip'
$url = 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip'
if (!(Test-Path -LiteralPath $archivePath)) {
  Write-Output 'Telechargement de FFmpeg 9.0.2 (Windows x64)...'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archivePath
}
if ((Get-SoundboardSha256 $archivePath) -ne $archiveHash) {
  throw 'Archive FFmpeg non conforme au SHA-256 publie. Installation interrompue.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $files = @{ 'bin/ffmpeg.exe' = 'ffmpeg.exe'; 'LICENSE' = 'LICENSE'; 'README.txt' = 'README.txt' }
  foreach ($suffix in $files.Keys) {
    $entry = $archive.Entries | Where-Object { $_.FullName.EndsWith('/' + $suffix) } | Select-Object -First 1
    if (!$entry) { throw ('Fichier absent de FFmpeg : ' + $suffix) }
    $destination = Join-Path $ffmpegDirectory $files[$suffix]
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
  }
} finally { $archive.Dispose() }
$manifest = @{
  version = '9.0.2'; url = $url; archiveSha256 = $archiveHash;
  sha256 = (Get-SoundboardSha256 $ffmpegExe);
  source = 'https://github.com/FFmpeg/FFmpeg/commit/946fcce07b';
  license = 'GPL-3.0-or-later';
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Output 'FFmpeg 9.0.2 installe, SHA-256 verifie.'
