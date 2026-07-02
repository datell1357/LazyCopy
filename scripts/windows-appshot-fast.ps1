param(
  [string]$TargetPath = "",
  [ValidateSet("active-window", "fullscreen", "region")][string]$Mode = "active-window",
  [string]$AppName = "Codex",
  [string]$SoundPath = "",
  [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"
$CaptureFlashMilliseconds = 120
$CapturePostFlashDelayMilliseconds = 30
$CaptureSoundKeepAliveMilliseconds = 700

if (-not $SoundPath) {
  $SoundPath = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\appshot.mp3"
}

if ($Mode -eq "region") {
  throw "Windows region capture is not implemented. Use active-window or fullscreen."
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class LazyCopyWin32AppShot {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern IntPtr SetActiveWindow(IntPtr hWnd);

  [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
  public static extern int mciSendString(string command, StringBuilder returnValue, int returnLength, IntPtr winHandle);
}
"@

$createdTemporaryTarget = $false
if (-not $TargetPath) {
  $TargetPath = Join-Path ([System.IO.Path]::GetTempPath()) ("lazycopy-appshot-" + [System.Guid]::NewGuid().ToString("N") + ".png")
  $createdTemporaryTarget = $true
}

function Get-LazyCopyTickMilliseconds {
  return [int64]([Math]::Floor(([double][System.Diagnostics.Stopwatch]::GetTimestamp() * 1000.0) / [double][System.Diagnostics.Stopwatch]::Frequency))
}

function Write-LazyCopyFastLog([string]$Message) {
  if (-not $LogPath) {
    return
  }

  try {
    $parent = Split-Path -Parent $LogPath
    if ($parent) {
      New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $timestamp = (Get-Date).ToString("o")
    Add-Content -Path $LogPath -Value "$timestamp $Message" -Encoding UTF8
  } catch {
  }
}

function Start-LazyCopyCaptureSound {
  param(
    [string]$Path
  )

  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  try {
    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    $alias = "lazycopy_appshot_$PID"
    [LazyCopyWin32AppShot]::mciSendString("close $alias", $null, 0, [IntPtr]::Zero) | Out-Null
    $openResult = [LazyCopyWin32AppShot]::mciSendString("open `"$resolvedPath`" type mpegvideo alias $alias", $null, 0, [IntPtr]::Zero)
    if ($openResult -ne 0) {
      return $null
    }
    $playResult = [LazyCopyWin32AppShot]::mciSendString("play $alias", $null, 0, [IntPtr]::Zero)
    if ($playResult -ne 0) {
      [LazyCopyWin32AppShot]::mciSendString("close $alias", $null, 0, [IntPtr]::Zero) | Out-Null
      return $null
    }
    return $alias
  } catch {
    return $null
  }
}

function Close-LazyCopyCaptureSound {
  param(
    $Player
  )

  if ($null -eq $Player) {
    return
  }

  try {
    [LazyCopyWin32AppShot]::mciSendString("close $Player", $null, 0, [IntPtr]::Zero) | Out-Null
  } catch {
  }
}

function Invoke-LazyCopyCaptureFlash {
  param(
    [int]$Left,
    [int]$Top,
    [int]$Width,
    [int]$Height,
    [string]$SoundPath
  )

  $form = New-Object System.Windows.Forms.Form
  $soundPlayer = Start-LazyCopyCaptureSound -Path $SoundPath
  try {
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    $form.ShowInTaskbar = $false
    $form.TopMost = $true
    $form.BackColor = [System.Drawing.Color]::White
    $form.Opacity = 0.38
    $form.Bounds = New-Object System.Drawing.Rectangle -ArgumentList $Left, $Top, $Width, $Height
    $form.Show()
    $form.Refresh()
    Start-Sleep -Milliseconds $CaptureFlashMilliseconds
  } catch {
    Close-LazyCopyCaptureSound -Player $soundPlayer
    throw
  } finally {
    $form.Close()
    $form.Dispose()
  }

  return $soundPlayer
}

function Test-LazyCopyForegroundWindow {
  param(
    [IntPtr]$Handle
  )

  return [LazyCopyWin32AppShot]::GetForegroundWindow() -eq $Handle
}

function Set-LazyCopyForegroundWindow {
  param(
    [IntPtr]$Handle
  )

  $currentThreadId = [LazyCopyWin32AppShot]::GetCurrentThreadId()
  $foregroundHandle = [LazyCopyWin32AppShot]::GetForegroundWindow()
  $targetProcessId = [uint32]0
  $foregroundProcessId = [uint32]0
  $targetThreadId = [LazyCopyWin32AppShot]::GetWindowThreadProcessId($Handle, [ref]$targetProcessId)
  $foregroundThreadId = [LazyCopyWin32AppShot]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundProcessId)
  $attachedTarget = $false
  $attachedForeground = $false

  try {
    if ($targetThreadId -ne 0 -and $targetThreadId -ne $currentThreadId) {
      $attachedTarget = [LazyCopyWin32AppShot]::AttachThreadInput($currentThreadId, $targetThreadId, $true)
    }
    if ($foregroundThreadId -ne 0 -and $foregroundThreadId -ne $currentThreadId -and $foregroundThreadId -ne $targetThreadId) {
      $attachedForeground = [LazyCopyWin32AppShot]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
    }

    [LazyCopyWin32AppShot]::BringWindowToTop($Handle) | Out-Null
    [LazyCopyWin32AppShot]::SetActiveWindow($Handle) | Out-Null
    [LazyCopyWin32AppShot]::SetForegroundWindow($Handle) | Out-Null
  } finally {
    if ($attachedForeground) {
      [LazyCopyWin32AppShot]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false) | Out-Null
    }
    if ($attachedTarget) {
      [LazyCopyWin32AppShot]::AttachThreadInput($currentThreadId, $targetThreadId, $false) | Out-Null
    }
  }

  $deadline = (Get-LazyCopyTickMilliseconds) + 500
  while ((Get-LazyCopyTickMilliseconds) -lt $deadline) {
    if (Test-LazyCopyForegroundWindow -Handle $Handle) {
      return $true
    }
    Start-Sleep -Milliseconds 10
  }

  return Test-LazyCopyForegroundWindow -Handle $Handle
}

function Invoke-LazyCopyAppActivate {
  param(
    [int]$ProcessId
  )

  try {
    $shell = New-Object -ComObject WScript.Shell
    return [bool]$shell.AppActivate($ProcessId)
  } catch {
    return $false
  }
}

if ($Mode -eq "fullscreen") {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $left = $bounds.Left
  $top = $bounds.Top
  $width = $bounds.Width
  $height = $bounds.Height
  $sourceType = "windows-fullscreen"
  $hwndText = $null
} else {
  $hwnd = [LazyCopyWin32AppShot]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) {
    throw "No foreground window is available."
  }
  $rect = New-Object LazyCopyWin32AppShot+RECT
  if (-not [LazyCopyWin32AppShot]::GetWindowRect($hwnd, [ref]$rect)) {
    throw "Could not read the foreground window rectangle."
  }
  $left = $rect.Left
  $top = $rect.Top
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  $sourceType = "windows-front-window"
  $hwndText = $hwnd.ToInt64().ToString()
}

if ($width -le 0 -or $height -le 0) {
  throw "The capture area is empty."
}

Write-LazyCopyFastLog "appshot-start mode=$Mode app=$AppName"

$captureSoundPlayer = $null
try {
  $captureSoundPlayer = Invoke-LazyCopyCaptureFlash -Left $left -Top $top -Width $width -Height $height -SoundPath $SoundPath
} catch {
  # Visual feedback is best-effort; keep the capture and paste flow alive.
}
Start-Sleep -Milliseconds $CapturePostFlashDelayMilliseconds

$parent = Split-Path -Parent $TargetPath
if ($parent) {
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
}

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
  $bitmap.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $clipboardBitmap = New-Object System.Drawing.Bitmap($bitmap)
  [System.Windows.Forms.Clipboard]::SetImage($clipboardBitmap)
} catch {
  Close-LazyCopyCaptureSound -Player $captureSoundPlayer
  throw
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

$escaped = [regex]::Escape($AppName)
$process = Get-Process |
  Where-Object {
    $_.MainWindowHandle -ne 0 -and
    ($_.ProcessName -match $escaped -or $_.MainWindowTitle -match $escaped)
  } |
  Select-Object -First 1

if ($null -eq $process) {
  Write-LazyCopyFastLog "appshot-foreground-failed reason=missing-app app=$AppName"
  throw "Could not find a visible window for $AppName."
}

if (-not (Set-LazyCopyForegroundWindow -Handle $process.MainWindowHandle)) {
  Invoke-LazyCopyAppActivate -ProcessId $process.Id | Out-Null
}

if (-not (Set-LazyCopyForegroundWindow -Handle $process.MainWindowHandle)) {
  Write-LazyCopyFastLog "appshot-foreground-failed reason=not-foreground app=$AppName pid=$($process.Id)"
  throw "Could not bring $AppName to the foreground; refusing to paste into the current window."
}
Write-LazyCopyFastLog "appshot-foreground-ok app=$AppName pid=$($process.Id)"
[System.Windows.Forms.SendKeys]::SendWait("^v")
Write-LazyCopyFastLog "appshot-pasted app=$AppName"
if ($null -ne $captureSoundPlayer) {
  Start-Sleep -Milliseconds $CaptureSoundKeepAliveMilliseconds
  Close-LazyCopyCaptureSound -Player $captureSoundPlayer
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@{
  type = $sourceType
  hwnd = $hwndText
  nativeCapture = $true
} | ConvertTo-Json -Compress

if ($createdTemporaryTarget) {
  Remove-Item -LiteralPath $TargetPath -Force -ErrorAction SilentlyContinue
}
