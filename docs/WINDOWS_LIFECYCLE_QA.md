# Windows Lifecycle QA Checklist

Use this checklist when validating AppShot on a real Windows desktop.

This is a manual QA document because macOS or Linux cannot prove global Windows hotkey behavior, visible Codex window detection, or PowerShell process lifecycle behavior.

## Preconditions

- Windows 10 or Windows 11.
- Git, Node.js, npm, Codex CLI, and Codex Desktop installed.
- LazyCopy installed from this repository.
- Codex Desktop can open a visible window.

## Install Or Reinstall

```powershell
npm --prefix "$HOME\.codex\skills\dd" run install-user
```

Expected:

- The command exits successfully.
- AppShot uses `Shift+Space`.
- A Startup launcher exists for LazyCopy AppShot.
- The watcher log exists after install or after the first watcher event:

```text
%LOCALAPPDATA%\LazyCopy\appshot-hotkey.log
```

## Closed Codex State

1. Close all visible Codex Desktop windows.
2. Wait at least 5 seconds.
3. Inspect the log.

Expected:

- The log contains `watcher-start`.
- The log contains `codex-hidden` after Codex disappears.
- The log does not show a fresh `listener-started` during the closed period.
- Pressing `Shift+Space` does not trigger AppShot while Codex is closed.

## Open Codex State

1. Open Codex Desktop.
2. Wait up to 5 seconds.
3. Inspect the log.

Expected:

- The log contains `codex-visible`.
- The log contains `listener-started`.

## Capture And Paste

1. Focus another app window that should be captured.
2. Press `Shift+Space`.
3. Return to Codex Desktop.

Expected:

- LazyCopy briefly flashes the captured area.
- Codex Desktop receives a pasted PNG in the input.
- No message is automatically submitted.
- The log contains `hotkey-fired` and `command-launched`.

## Listener Restart

1. Identify only the watcher-owned listener child process.
2. Kill that listener child process.
3. Keep Codex Desktop visible.
4. Wait up to 35 seconds.
5. Inspect the log.

Expected:

- The log contains `listener-exited`.
- The log contains `listener-restart` or a fresh `listener-started`.
- `Shift+Space` works again after restart.

Do not kill broad PowerShell, Node, Codex, or browser processes for this test.

## Close And Reopen

1. Close Codex Desktop.
2. Wait up to 5 seconds.
3. Inspect the log.
4. Reopen Codex Desktop.
5. Wait up to 5 seconds.

Expected:

- After close: `codex-hidden` and `listener-stop-requested`.
- After reopen: `codex-visible` and `listener-started`.
- `Shift+Space` works again after reopen.

## Pass Criteria

The lifecycle passes when all of these are true:

- Codex closed means no active LazyCopy-owned AppShot listener.
- Codex visible means `Shift+Space` captures and pastes into Codex Desktop.
- Listener failure while Codex remains visible is recovered by restart.
- Closing Codex stops only the listener child that the watcher started.
- AppShot paste does not submit the Codex message.
