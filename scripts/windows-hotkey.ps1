param(
  [string]$Key = "control+space",
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Command
)

$ErrorActionPreference = "Stop"

if ($Command.Count -eq 0) {
  throw "Missing command to run when the hotkey is pressed."
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class LazyCopyHotkey {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int x;
    public int y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MSG {
    public IntPtr hwnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public POINT pt;
  }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

  [DllImport("user32.dll")]
  public static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

  [DllImport("user32.dll")]
  public static extern bool TranslateMessage(ref MSG lpMsg);

  [DllImport("user32.dll")]
  public static extern IntPtr DispatchMessage(ref MSG lpMsg);
}
"@

function ConvertTo-HotkeyParts([string]$Value) {
  $modifiers = 0
  $keyName = $null

  foreach ($part in $Value.ToLowerInvariant().Split("+")) {
    $token = $part.Trim()
    if ($token -eq "control" -or $token -eq "ctrl") {
      $modifiers = $modifiers -bor 0x0002
    } elseif ($token -eq "alt" -or $token -eq "option") {
      $modifiers = $modifiers -bor 0x0001
    } elseif ($token -eq "shift") {
      $modifiers = $modifiers -bor 0x0004
    } elseif ($token -eq "win" -or $token -eq "windows") {
      $modifiers = $modifiers -bor 0x0008
    } elseif ($token -eq "space") {
      $keyName = "Space"
    } elseif ($token.Length -eq 1) {
      $keyName = $token.ToUpperInvariant()
    } else {
      $keyName = $token
    }
  }

  if ($null -eq $keyName) {
    throw "Hotkey must include a non-modifier key."
  }

  $modifiers = $modifiers -bor 0x4000
  $keyCode = [int][System.Enum]::Parse([System.Windows.Forms.Keys], $keyName, $true)
  return @{ Modifiers = [uint32]$modifiers; KeyCode = [uint32]$keyCode }
}

$parts = ConvertTo-HotkeyParts $Key
$id = 1
$message = New-Object LazyCopyHotkey+MSG

if (-not [LazyCopyHotkey]::RegisterHotKey([IntPtr]::Zero, $id, $parts.Modifiers, $parts.KeyCode)) {
  throw "Could not register hotkey $Key."
}

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output "LazyCopy hotkey listening: $Key"
  while ([LazyCopyHotkey]::GetMessage([ref]$message, [IntPtr]::Zero, 0, 0) -ne 0) {
    if ($message.message -eq 0x0312 -and $message.wParam.ToInt32() -eq $id) {
      if ($Command.Count -eq 1) {
        Start-Process -FilePath $Command[0] -WindowStyle Hidden
      } else {
        Start-Process -FilePath $Command[0] -ArgumentList $Command[1..($Command.Count - 1)] -WindowStyle Hidden
      }
    }
    [LazyCopyHotkey]::TranslateMessage([ref]$message) | Out-Null
    [LazyCopyHotkey]::DispatchMessage([ref]$message) | Out-Null
  }
} finally {
  [LazyCopyHotkey]::UnregisterHotKey([IntPtr]::Zero, $id) | Out-Null
}
