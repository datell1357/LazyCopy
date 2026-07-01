param(
  [string]$AppName = "Codex"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class LazyCopyWin32Paste {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

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

[LazyCopyWin32Paste]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("^v")
