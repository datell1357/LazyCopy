param(
  [string]$Key = "shift+space",
  [string]$AppName = "Codex",
  [string]$LogPath,
  [int]$PollSeconds = 2,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ListenerCommand
)

$ErrorActionPreference = "Stop"

if ($PollSeconds -lt 1) {
  $PollSeconds = 1
}

$maxBackoffSeconds = 30

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
