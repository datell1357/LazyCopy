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
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern IntPtr SetActiveWindow(IntPtr hWnd);
}
"@

function Test-LazyCopyForegroundWindow {
  param(
    [IntPtr]$Handle
  )

  return [LazyCopyWin32Paste]::GetForegroundWindow() -eq $Handle
}

function Set-LazyCopyForegroundWindow {
  param(
    [IntPtr]$Handle
  )

  $currentThreadId = [LazyCopyWin32Paste]::GetCurrentThreadId()
  $foregroundHandle = [LazyCopyWin32Paste]::GetForegroundWindow()
  $targetProcessId = [uint32]0
  $foregroundProcessId = [uint32]0
  $targetThreadId = [LazyCopyWin32Paste]::GetWindowThreadProcessId($Handle, [ref]$targetProcessId)
  $foregroundThreadId = [LazyCopyWin32Paste]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundProcessId)
  $attachedTarget = $false
  $attachedForeground = $false

  try {
    if ($targetThreadId -ne 0 -and $targetThreadId -ne $currentThreadId) {
      $attachedTarget = [LazyCopyWin32Paste]::AttachThreadInput($currentThreadId, $targetThreadId, $true)
    }
    if ($foregroundThreadId -ne 0 -and $foregroundThreadId -ne $currentThreadId -and $foregroundThreadId -ne $targetThreadId) {
      $attachedForeground = [LazyCopyWin32Paste]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
    }

    [LazyCopyWin32Paste]::BringWindowToTop($Handle) | Out-Null
    [LazyCopyWin32Paste]::SetActiveWindow($Handle) | Out-Null
    [LazyCopyWin32Paste]::SetForegroundWindow($Handle) | Out-Null
  } finally {
    if ($attachedForeground) {
      [LazyCopyWin32Paste]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false) | Out-Null
    }
    if ($attachedTarget) {
      [LazyCopyWin32Paste]::AttachThreadInput($currentThreadId, $targetThreadId, $false) | Out-Null
    }
  }

  $deadline = [Environment]::TickCount64 + 500
  while ([Environment]::TickCount64 -lt $deadline) {
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

if (-not (Set-LazyCopyForegroundWindow -Handle $process.MainWindowHandle)) {
  Invoke-LazyCopyAppActivate -ProcessId $process.Id | Out-Null
}

if (-not (Set-LazyCopyForegroundWindow -Handle $process.MainWindowHandle)) {
  throw "Could not bring $AppName to the foreground; refusing to paste into the current window."
}
[System.Windows.Forms.SendKeys]::SendWait("^v")
