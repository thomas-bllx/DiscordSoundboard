$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ffmpegDirectory = Join-Path $taskRoot 'vendor\ffmpeg'
$ffmpegExe = Join-Path $ffmpegDirectory 'ffmpeg.exe'
$manifestPath = Join-Path $ffmpegDirectory 'manifest.json'
$spec = Get-Content -LiteralPath (Join-Path $taskRoot 'resources\ffmpeg-runtime.json') -Raw | ConvertFrom-Json
$archiveHash = $spec.archiveSha256
function Get-SoundboardSha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}
if ((Test-Path -LiteralPath $ffmpegExe) -and (Test-Path -LiteralPath $manifestPath)) {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.variant -eq $spec.variant -and $manifest.version -eq $spec.version -and $spec.binarySha256 -eq (Get-SoundboardSha256 $ffmpegExe)) {
    Write-Output 'FFmpeg audio 9.0.2 verifie et deja disponible.'
    exit 0
  }
}
New-Item -ItemType Directory -Path $ffmpegDirectory -Force | Out-Null
$archivePath = Join-Path $taskRoot 'vendor\ffmpeg-soundboard.zip'
$url = $spec.url
if (!(Test-Path -LiteralPath $archivePath)) {
  Write-Output 'Telechargement de FFmpeg audio 9.0.2 (Windows x64)...'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archivePath
}
if ((Get-SoundboardSha256 $archivePath) -ne $archiveHash) {
  throw 'Archive FFmpeg non conforme au SHA-256 publie. Installation interrompue.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $files = @{ 'ffmpeg.exe' = 'ffmpeg.exe'; 'LICENSE' = 'LICENSE'; 'README.txt' = 'README.txt'; 'manifest.json' = 'manifest.json' }
  foreach ($suffix in $files.Keys) {
    $entry = $archive.Entries | Where-Object { $_.FullName -eq $suffix } | Select-Object -First 1
    if (!$entry) { throw ('Fichier absent de FFmpeg : ' + $suffix) }
    $destination = Join-Path $ffmpegDirectory $files[$suffix]
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
  }
} finally { $archive.Dispose() }
if ((Get-SoundboardSha256 $ffmpegExe) -ne $spec.binarySha256) {
  throw 'Binaire FFmpeg non conforme a l empreinte attendue.'
}
Write-Output 'FFmpeg audio 9.0.2 installe, archive et binaire verifies.'
