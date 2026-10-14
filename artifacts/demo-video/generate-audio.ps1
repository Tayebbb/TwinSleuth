$ErrorActionPreference = 'Stop'
$python = Join-Path $env:LOCALAPPDATA 'TwinSleuth-Kokoro\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  throw 'Kokoro is not installed. Run artifacts/demo-video/setup-kokoro.ps1 first.'
}
& $python (Join-Path $PSScriptRoot 'generate-audio-kokoro.py')
if ($LASTEXITCODE -ne 0) { throw 'Kokoro voice generation failed.' }
