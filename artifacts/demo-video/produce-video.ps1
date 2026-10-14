$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$env:DEMO_TRUTH = 'H1'
$env:TWINSLEUTH_DB = ':memory:'
$env:GEMINI_API_KEY = ''
$server = $null
Push-Location $repo
try {
  $server = Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', 'npm run dev') -WorkingDirectory $repo -WindowStyle Hidden -PassThru
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-RestMethod -Uri 'http://127.0.0.1:5174/api/cases' -TimeoutSec 2 | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $ready) { throw 'TwinSleuth practice service did not become ready.' }

  node 'artifacts/demo-video/capture-demo.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'The browser capture failed.' }
  & (Join-Path $PSScriptRoot 'generate-audio.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Voice generation failed.' }
  python (Join-Path $PSScriptRoot 'generate-captions.py')
  if ($LASTEXITCODE -ne 0) { throw 'Caption generation failed.' }

  $raw = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'raw') -Filter '*.webm' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $raw) { throw 'No Playwright recording was produced.' }
  $offset = (Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'raw\timeline-offset.txt')).Trim()
  $inputs = @('-y', '-ss', $offset, '-i', $raw.FullName)
  1..7 | ForEach-Object { $inputs += @('-i', (Join-Path $PSScriptRoot ('assets\audio\scene-{0:D2}.wav' -f $_))) }
  $inputs += @('-loop', '1', '-i', (Join-Path $PSScriptRoot 'assets\title-card.png'))
  $starts = @(0, 12000, 35000, 130000, 185000, 250000, 280000)
  $parts = @()
  for ($i = 0; $i -lt 7; $i++) { $index = $i + 1; $delay = $starts[$i]; $parts += "[$index`:a]adelay=${delay}|${delay}[voice$i]" }
  $mix = ((0..6 | ForEach-Object { "[voice$_]" }) -join '') + 'amix=inputs=7:duration=longest:normalize=0,apad=whole_dur=300,atrim=duration=300,loudnorm=I=-16:TP=-1:LRA=11[audio]'
  $filter = ($parts -join ';') + ';' + $mix
  $zoom = "1+0.10*if(between(in_time,57,60),(in_time-57)/3,if(between(in_time,60,70),1,if(between(in_time,70,73),(73-in_time)/3,0)))+0.10*if(between(in_time,94,97),(in_time-94)/3,if(between(in_time,97,108),1,if(between(in_time,108,111),(111-in_time)/3,0)))"
  $zoomPan = "zoompan=z='$zoom':x='if(lt(zoom,1.001),(iw-iw/zoom)/2,iw*0.75-iw/zoom/2)':y='ih*0.49-ih/zoom/2':d=1:s=1920x1080:fps=30"
  $videoFilter = "[0:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1,$zoomPan[base];[8:v]format=rgba,fade=t=in:st=0:d=0.5:alpha=1,fade=t=out:st=4.2:d=0.8:alpha=1[card];[base][card]overlay=0:0:enable='between(t,0,5)'[merged];[merged]subtitles=artifacts/demo-video/captions.ass[video]"
  $filter = $filter + ';' + $videoFilter
  $output = Join-Path $PSScriptRoot 'demo.mp4'
  & ffmpeg @inputs -filter_complex $filter -map '[video]' -map '[audio]' -frames:v 9000 -t 300 -r 30 -fps_mode cfr -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart $output
  if ($LASTEXITCODE -ne 0) { throw 'FFmpeg encoding failed.' }
  & ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,duration -of json $output
  if ($LASTEXITCODE -ne 0) { throw 'FFprobe verification failed.' }
} finally {
  if ($server -and -not $server.HasExited) { & taskkill.exe /PID $server.Id /T /F | Out-Null }
  Pop-Location
}
