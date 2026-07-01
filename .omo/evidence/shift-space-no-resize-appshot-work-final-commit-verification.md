# Final Commit Verification

Verified at: 2026-07-01T06:30Z

- `npm test`: pass, 20 tests / 0 failures.
- `git diff --check`: pass.
- `rg -n "ShowWindowAsync\\(|SW_RESTORE|Maximize|Minimize|Resize|SetWindowPos|MoveWindow" scripts/windows-paste-into-app.ps1`: exit 1, no restore/resize tokens.
- `rg -n -F '[string]$Key = "shift+space"' scripts/windows-hotkey.ps1`: line 2 present.
- `rg -n -F '[string]$Key = "control+space"' scripts/windows-hotkey.ps1`: exit 1, stale default absent.
