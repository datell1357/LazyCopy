param(
  [string]$Key = "shift+space",
  [string]$LogPath,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Command
)

$ErrorActionPreference = "Stop"

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

Write-LazyCopyLog "start key=$Key"

if ($Command.Count -eq 0) {
  Write-LazyCopyLog "failed missing-command"
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

  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int vKey);

  [StructLayout(LayoutKind.Sequential)]
  public struct KBDLLHOOKSTRUCT {
    public uint vkCode;
    public uint scanCode;
    public uint flags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

  public const int WH_KEYBOARD_LL = 13;
  public const int VK_SPACE = 0x20;
  public const int VK_SHIFT = 0x10;
  public const int VK_LSHIFT = 0xA0;
  public const int VK_RSHIFT = 0xA1;
  public const uint WM_KEYDOWN = 0x0100;
  public const uint WM_KEYUP = 0x0101;
  public const uint WM_SYSKEYDOWN = 0x0104;
  public const uint WM_SYSKEYUP = 0x0105;
  public const uint WM_LAZYCOPY_SHIFT_SPACE = 0x8001;

  private static IntPtr hookHandle = IntPtr.Zero;
  private static int targetThreadId = 0;
  private static bool shiftSpaceArmed = true;
  private static LowLevelKeyboardProc hookCallback = HookCallback;

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool UnhookWindowsHookEx(IntPtr hhk);

  [DllImport("user32.dll")]
  public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostThreadMessage(int idThread, uint Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll")]
  public static extern int GetCurrentThreadId();

  public static IntPtr InstallShiftSpaceHook(int threadId) {
    targetThreadId = threadId;
    hookHandle = SetWindowsHookEx(WH_KEYBOARD_LL, hookCallback, IntPtr.Zero, 0);
    return hookHandle;
  }

  public static bool UninstallShiftSpaceHook() {
    if (hookHandle == IntPtr.Zero) {
      return true;
    }
    bool result = UnhookWindowsHookEx(hookHandle);
    hookHandle = IntPtr.Zero;
    return result;
  }

  private static bool IsKeyDown(int virtualKey) {
    return (GetAsyncKeyState(virtualKey) & -32768) != 0;
  }

  private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0) {
      KBDLLHOOKSTRUCT key = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
      bool isSpace = key.vkCode == VK_SPACE;
      bool isKeyDown = wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN;
      bool isKeyUp = wParam == (IntPtr)WM_KEYUP || wParam == (IntPtr)WM_SYSKEYUP;
      if (isSpace && isKeyUp) {
        shiftSpaceArmed = true;
      } else if (isSpace && isKeyDown) {
        bool shiftDown = IsKeyDown(VK_SHIFT) || IsKeyDown(VK_LSHIFT) || IsKeyDown(VK_RSHIFT);
        if (shiftDown) {
          if (shiftSpaceArmed && targetThreadId != 0) {
            PostThreadMessage(targetThreadId, WM_LAZYCOPY_SHIFT_SPACE, IntPtr.Zero, IntPtr.Zero);
          }
          shiftSpaceArmed = false;
          return (IntPtr)1;
        }
      }
    }
    return CallNextHookEx(hookHandle, nCode, wParam, lParam);
  }
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
$HotkeyCooldownMilliseconds = 250
$script:LastHotkeyFireTick = 0
$WM_HOTKEY = 0x0312
$WM_QUIT = 0x0012
$WM_LAZYCOPY_SHIFT_SPACE = [LazyCopyHotkey]::WM_LAZYCOPY_SHIFT_SPACE
$useShiftSpaceHook = $false
$hookHandle = [IntPtr]::Zero

function Test-LazyCopyShiftSpaceHookEnabled([string]$Value) {
  $tokens = @($Value.ToLowerInvariant().Split("+") | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  return $tokens.Count -eq 2 -and $tokens.Contains("shift") -and $tokens.Contains("space")
}

function Start-LazyCopyHotkeyCommand {
  try {
    if ($Command.Count -eq 1) {
      Write-LazyCopyLog "command-launch file=$($Command[0]) args=0"
      $process = Start-Process -FilePath $Command[0] -WindowStyle Hidden -PassThru
    } else {
      Write-LazyCopyLog "command-launch file=$($Command[0]) args=$($Command.Count - 1)"
      $process = Start-Process -FilePath $Command[0] -ArgumentList $Command[1..($Command.Count - 1)] -WindowStyle Hidden -PassThru
    }
    Write-LazyCopyLog "command-launched pid=$($process.Id)"
  } catch {
    Write-LazyCopyLog "command-launch-failed message=$($_.Exception.Message)"
  }
}

function Invoke-LazyCopyHotkeyFire([string]$Source) {
  $now = [Environment]::TickCount64
  $elapsed = $now - $script:LastHotkeyFireTick
  if ($script:LastHotkeyFireTick -ne 0 -and $elapsed -lt $HotkeyCooldownMilliseconds) {
    Write-LazyCopyLog "hotkey-suppressed key=$Key source=$Source elapsed=$elapsed"
    return
  }
  $script:LastHotkeyFireTick = $now
  Write-LazyCopyLog "hotkey-fired key=$Key source=$Source"
  Start-LazyCopyHotkeyCommand
}

$useShiftSpaceHook = Test-LazyCopyShiftSpaceHookEnabled $Key
if ($useShiftSpaceHook) {
  $threadId = [LazyCopyHotkey]::GetCurrentThreadId()
  $hookHandle = [LazyCopyHotkey]::InstallShiftSpaceHook($threadId)
  if ($hookHandle -eq [IntPtr]::Zero) {
    $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-LazyCopyLog "register-failed key=$Key mode=keyboard-hook win32=$errorCode"
    throw "Could not install keyboard hook for $Key. See LazyCopy hotkey log: $LogPath"
  }
  Write-LazyCopyLog "shift-space-hook-installed thread=$threadId"
} else {
  if (-not [LazyCopyHotkey]::RegisterHotKey([IntPtr]::Zero, $id, $parts.Modifiers, $parts.KeyCode)) {
    $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-LazyCopyLog "register-failed key=$Key win32=$errorCode"
    throw "Could not register hotkey $Key. See LazyCopy hotkey log: $LogPath"
  }
}

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-LazyCopyLog "register-success key=$Key"
  if ($useShiftSpaceHook) {
    Write-LazyCopyLog "shift-space-hook-enabled cooldownMs=$HotkeyCooldownMilliseconds"
  }
  Write-LazyCopyLog "listening-success key=$Key"
  Write-Output "LazyCopy hotkey listening: $Key"
  while ($true) {
    $messageResult = [LazyCopyHotkey]::GetMessage([ref]$message, [IntPtr]::Zero, 0, 0)
    if ($messageResult -eq 0) {
      Write-LazyCopyLog "message-loop-ended key=$Key"
      break
    }
    if ($messageResult -eq -1) {
      Write-LazyCopyLog "message-loop-failed key=$Key"
      throw "Windows hotkey message loop failed."
    }
    if ($message.message -eq $WM_HOTKEY -and $message.wParam.ToInt32() -eq $id) {
      Invoke-LazyCopyHotkeyFire "registered"
    } elseif ($message.message -eq $WM_LAZYCOPY_SHIFT_SPACE) {
      Invoke-LazyCopyHotkeyFire "keyboard-hook"
    }
    [LazyCopyHotkey]::TranslateMessage([ref]$message) | Out-Null
    [LazyCopyHotkey]::DispatchMessage([ref]$message) | Out-Null
  }
} catch {
  Write-LazyCopyLog "listener-failed message=$($_.Exception.Message)"
  throw
} finally {
  if ($useShiftSpaceHook) {
    [LazyCopyHotkey]::UninstallShiftSpaceHook() | Out-Null
  } else {
    [LazyCopyHotkey]::UnregisterHotKey([IntPtr]::Zero, $id) | Out-Null
  }
  Write-LazyCopyLog "listener-stop key=$Key"
}
