param(
  [string]$Key = "shift+space",
  [string]$AppName = "Codex",
  [string]$LogPath,
  [int]$PollSeconds = 2,
  [int]$UpdateCheckMinSeconds = 300,
  [string]$SelfUpdateCommandBase64,
  [string]$ListenerCommandBase64,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ListenerCommand
)

$ErrorActionPreference = "Stop"

if ($PollSeconds -lt 1) {
  $PollSeconds = 1
}

$maxBackoffSeconds = 30
$script:LastUpdateCheckTick = 0
$script:UpdateProcess = $null

if (-not $LogPath) {
  if ($env:LOCALAPPDATA) {
    $LogPath = Join-Path $env:LOCALAPPDATA "LazyCopy\appshot-hotkey.log"
  } else {
    $LogPath = Join-Path $HOME "AppData\Local\LazyCopy\appshot-hotkey.log"
  }
}

function Write-LazyCopyLog([string]$Message) {
  $parent = Split-Path -Parent $LogPath
  if ($parent) {
    New-Item -ItemType Directory -Force $parent | Out-Null
  }
  $timestamp = (Get-Date).ToString("o")
  Add-Content -Path $LogPath -Value "$timestamp $Message" -Encoding UTF8
}

function ConvertFrom-LazyCopyCommandBase64([string]$Value, [string]$Label) {
  try {
    $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
    $decoded = ConvertFrom-Json -InputObject $json
    return @($decoded | ForEach-Object { [string]$_ })
  } catch {
    Write-LazyCopyLog "watcher-failed invalid-$Label-command message=$($_.Exception.Message)"
    throw
  }
}

if ($ListenerCommandBase64) {
  $ListenerCommand = ConvertFrom-LazyCopyCommandBase64 $ListenerCommandBase64 "listener"
}

$SelfUpdateCommand = @()
if ($SelfUpdateCommandBase64) {
  $SelfUpdateCommand = ConvertFrom-LazyCopyCommandBase64 $SelfUpdateCommandBase64 "update"
}

function Test-LazyCopyCodexVisible {
  $escaped = [regex]::Escape($AppName)
  $matches = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match $escaped -or $_.MainWindowTitle -match $escaped)
  }
  return @($matches).Count -gt 0
}

function Start-LazyCopyListener {
  if ($ListenerCommand.Count -eq 0) {
    Write-LazyCopyLog "watcher-failed missing-listener-command"
    throw "Missing listener command."
  }

  Write-LazyCopyLog "listener-start key=$Key"
  if ($ListenerCommand.Count -eq 1) {
    $process = Start-Process -FilePath $ListenerCommand[0] -WindowStyle Hidden -PassThru
  } else {
    $process = Start-Process -FilePath $ListenerCommand[0] -ArgumentList $ListenerCommand[1..($ListenerCommand.Count - 1)] -WindowStyle Hidden -PassThru
  }
  Write-LazyCopyLog "listener-started pid=$($process.Id)"
  return $process
}

function Write-LazyCopyListenerExited($Process) {
  if ($null -eq $Process) {
    return
  }
  $exitCode = $null
  try {
    if ($Process.HasExited) {
      $exitCode = $Process.ExitCode
    }
  } catch {
    $exitCode = "unknown"
  }
  Write-LazyCopyLog "listener-exited pid=$($Process.Id) exit=$exitCode"
}

function Stop-LazyCopyListener($Process) {
  if ($null -eq $Process) {
    return
  }
  if (-not $Process.HasExited) {
    Write-LazyCopyLog "listener-stop-requested pid=$($Process.Id)"
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    try {
      $Process.WaitForExit(5000) | Out-Null
    } catch {
    }
  }
  Write-LazyCopyListenerExited $Process
}

function Start-LazyCopySelfUpdate {
  if ($SelfUpdateCommand.Count -eq 0) {
    return
  }
  if ($null -ne $script:UpdateProcess -and -not $script:UpdateProcess.HasExited) {
    Write-LazyCopyLog "update-check-skip reason=already-running pid=$($script:UpdateProcess.Id)"
    return
  }

  $now = [Environment]::TickCount64
  if ($script:LastUpdateCheckTick -ne 0) {
    $elapsedSeconds = [Math]::Floor(($now - $script:LastUpdateCheckTick) / 1000)
    if ($elapsedSeconds -lt $UpdateCheckMinSeconds) {
      Write-LazyCopyLog "update-check-skip reason=recent elapsed=$elapsedSeconds"
      return
    }
  }

  $script:LastUpdateCheckTick = $now
  try {
    if ($SelfUpdateCommand.Count -eq 1) {
      $script:UpdateProcess = Start-Process -FilePath $SelfUpdateCommand[0] -WindowStyle Hidden -PassThru
    } else {
      $script:UpdateProcess = Start-Process -FilePath $SelfUpdateCommand[0] -ArgumentList $SelfUpdateCommand[1..($SelfUpdateCommand.Count - 1)] -WindowStyle Hidden -PassThru
    }
    Write-LazyCopyLog "update-check-started pid=$($script:UpdateProcess.Id)"
  } catch {
    Write-LazyCopyLog "update-check-failed message=$($_.Exception.Message)"
  }
}

Write-LazyCopyLog "watcher-start key=$Key app=$AppName poll=$PollSeconds"

$listenerProcess = $null
$wasVisible = $false
$restartDelay = $PollSeconds

try {
  while ($true) {
    $visible = Test-LazyCopyCodexVisible

    if ($visible -and -not $wasVisible) {
      Write-LazyCopyLog "codex-visible app=$AppName"
      $restartDelay = $PollSeconds
      Start-LazyCopySelfUpdate
    } elseif (-not $visible -and $wasVisible) {
      Write-LazyCopyLog "codex-hidden app=$AppName"
    }

    if ($visible) {
      if ($null -eq $listenerProcess) {
        $listenerProcess = Start-LazyCopyListener
      } elseif ($listenerProcess.HasExited) {
        Write-LazyCopyListenerExited $listenerProcess
        Write-LazyCopyLog "listener-restart delay=$restartDelay"
        Start-Sleep -Seconds $restartDelay
        $listenerProcess = Start-LazyCopyListener
        $restartDelay = [Math]::Min($restartDelay * 2, $maxBackoffSeconds)
        $wasVisible = $visible
        continue
      } else {
        $restartDelay = $PollSeconds
      }
    } elseif ($null -ne $listenerProcess) {
      Stop-LazyCopyListener $listenerProcess
      $listenerProcess = $null
      $restartDelay = $PollSeconds
    }

    $wasVisible = $visible
    Start-Sleep -Seconds $PollSeconds
  }
} catch {
  Write-LazyCopyLog "watcher-failed message=$($_.Exception.Message)"
  throw
} finally {
  Stop-LazyCopyListener $listenerProcess
  Write-LazyCopyLog "watcher-stop"
}
