# LazyCopy AppShot Speedup Evidence

Date: 2026-07-01
Host: macOS. Windows GUI behavior was verified by simulated Windows CLI/test surfaces only.

## Verified Surface

- `npm test -- --test-reporter=spec`: 29 tests passed.
- `node --test --test-reporter=spec --test-name-pattern "Windows appshot|Windows hotkey|windows paste" test/capture.test.js`: 8 focused tests passed.
- `git diff --check && node -c src/cli.js && node -c src/windows.js`: passed.
- Forbidden scan for restore/resize/minimized startup/control-space regressions: no matches.
- `node bin/lazycopy.js --help`: mentions AppShot, `dd`, Claude Code, and `shift+space`.
- `node bin/lazycopy.js appshot hotkey install --app Codex --dry-run --json`: current macOS LaunchAgent dry-run exits 0.
- Simulated Windows dry-run confirms the install command starts `powershell.exe` directly with `windows-hotkey.ps1`, does not route through `appshot hotkey run`, and the Startup command uses `-WindowStyle Hidden` with no `/min`.
- `test ! -e .omo`: passed after worker evidence cleanup.

## Behavior Covered

- Normal Windows AppShot desktop path uses the combined `captureCopyPaste` helper when paste is enabled and no fixture image is used.
- Windows `--no-paste` fallback keeps the old capture and clipboard path.
- Windows hotkey install writes a hidden Startup launcher and starts the direct PowerShell listener command.
- AppShot remains separate from `dd`; no `dd` routing or redaction behavior was changed.

## Remaining Manual Proof

A real Windows host should still confirm the GUI surface: install LazyCopy, open Codex Desktop, press `Shift+Space`, verify the active window image is pasted into Codex without submitting, and confirm no PowerShell or cmd window remains open.
