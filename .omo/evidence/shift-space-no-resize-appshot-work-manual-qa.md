# Shift+Space AppShot Manual QA Matrix

Status: passed
Verified at: 2026-07-01T05:17Z
Reviewer: lazycodex-qa-executor evidence from surface-verifier final reverify

## User Outcome

LazyCopy AppShot should use Shift+Space by default, avoid the Codex Ctrl+Space window-size behavior, and paste the captured image into Codex without restoring or resizing the target window. AppShot remains the installed hotkey surface only; `dd` remains the clipboard-to-agent chat/CLI surface.

## Matrix

| Criterion | Surface | Evidence | Result |
| --- | --- | --- | --- |
| C001 default hotkey | CLI dry-run | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-surface.txt` shows default ProgramArguments include `shift+space` and assertion `default_shift_space_without_control_space:PASS`. | passed |
| C001 raw Windows helper | Static/helper scan | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-windows-hotkey-scan.txt` shows `scripts/windows-hotkey.ps1` line 2 is `[string]$Key = "shift+space",` and stale control default is absent. | passed |
| C001 custom key compatibility | CLI dry-run | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-custom-key-surface.txt` shows explicit `--key control+space` still emits `control+space`. | passed |
| C002 no resize or restore | Static/runtime guard | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-no-restore-scan.txt` finds no restore, maximize, minimize, resize, SetWindowPos, or MoveWindow tokens in `scripts/windows-paste-into-app.ps1`. | passed |
| C003 regression coverage | Test runner | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-npm-test.txt` reports `npm test` 20 pass, 0 fail. | passed |
| Scope fidelity | Diff/doc scan | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-scope.txt` keeps the product diff inside the planned files, confirms no product Markdown `/appshot` or `$appshot` chat triggers, and confirms no core `dd` behavior diff. | passed |
| Workspace hygiene | Cleanup | `.omo/evidence/shift-space-no-resize-appshot-work/task-2-cleanup.txt` confirms no hotkey listener, paste session, related QA process, or task-specific temp root remains. | passed |

## Adversarial Checks

- Shortcut collision: default moved from Ctrl+Space to Shift+Space while the explicit custom key remains supported.
- Window-state regression: paste script scan prevents restore/resize APIs from reappearing.
- Surface drift: product docs do not advertise `/appshot` or `$appshot`; AppShot is only the installed hotkey.
- Scope drift: `dd` core behavior files remain unchanged.
