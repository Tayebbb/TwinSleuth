$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'TwinSleuth-Kokoro'
$venvPython = Join-Path $installRoot 'Scripts\python.exe'
$modelDir = Join-Path $installRoot 'models'
New-Item -ItemType Directory -Force -Path $modelDir | Out-Null

if (-not (Test-Path -LiteralPath $venvPython)) {
  & py -3 -m venv $installRoot
  if ($LASTEXITCODE -ne 0) { throw 'Python 3 is required to create the isolated Kokoro environment.' }
}

& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare pip in the isolated Kokoro environment.' }
& $venvPython -m pip install 'kokoro-onnx==0.6.1' 'soundfile==0.13.1'
if ($LASTEXITCODE -ne 0) { throw 'Could not install Kokoro in the isolated environment.' }

$files = @(
  @{ Name = 'kokoro-v1.0.onnx'; Url = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx' },
  @{ Name = 'voices-v1.0.bin'; Url = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin' }
)
foreach ($file in $files) {
  $target = Join-Path $modelDir $file.Name
  if (-not (Test-Path -LiteralPath $target)) {
    & curl.exe --fail --location --show-error --output $target $file.Url
    if ($LASTEXITCODE -ne 0) { throw "Could not download $($file.Name)." }
  }
}

Write-Host "Kokoro is ready at $installRoot"
