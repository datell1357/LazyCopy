param(
  [Parameter(Mandatory = $true)][string]$TargetPath,
  [ValidateSet("active-window", "fullscreen", "region")][string]$Mode = "active-window",
  [string]$AppName = "Codex",
  [string]$SoundPath = ""
)

$ErrorActionPreference = "Stop"
$CaptureFlashMilliseconds = 120
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
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

function Start-LazyCopyCaptureSound {
  param(
    [string]$Path
  )

  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  try {
    Add-Type -AssemblyName PresentationCore
    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    $player = New-Object System.Windows.Media.MediaPlayer
    $player.Open((New-Object System.Uri -ArgumentList $resolvedPath))
    $player.Volume = 1.0
    $player.Play()
    return $player
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
    $Player.Close()
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
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

$captureSoundPlayer = $null
try {
  $captureSoundPlayer = Invoke-LazyCopyCaptureFlash -Left $left -Top $top -Width $width -Height $height -SoundPath $SoundPath
} catch {
  # Visual feedback is best-effort; keep the capture and paste flow alive.
}

$escaped = [regex]::Escape($AppName)
$process = Get-Process |
  Where-Object {
    $_.MainWindowHandle -ne 0 -and
    ($_.ProcessName -match $escaped -or $_.MainWindowTitle -match $escaped)
  } |
  Select-Object -First 1

if ($null -eq $process) {
  throw "Could not find a visible window for $AppName."
}

[LazyCopyWin32AppShot]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("^v")
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
