param(
  [Parameter(Mandatory = $true)][string]$TargetPath,
  [ValidateSet("active-window", "fullscreen", "region")][string]$Mode = "active-window",
  [string]$AppName = "Codex"
)

$ErrorActionPreference = "Stop"

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

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@{
  type = $sourceType
  hwnd = $hwndText
  nativeCapture = $true
} | ConvertTo-Json -Compress
