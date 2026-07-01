# shift-space-no-resize-appshot draft

status: awaiting-approval
pending_action: write .omo/plans/shift-space-no-resize-appshot.md
intent: clear
review_required: false
classify: Standard
tier: LIGHT

## Skill Survey
- omo:ulw-plan: explicitly requested; use as planner only, no product-code implementation in this turn.
- superpowers:systematic-debugging: not selected; current request is a planning/change-shaping task, not a live debugging implementation turn.
- codegraph: used for repo flow grounding around DEFAULT_HOTKEY, runHotkey, runDesktop, and pasteIntoApp.

## Components Ledger
- C1 hotkey surface: Shift+Space must be accepted as the default AppShot shortcut across CLI help, install-user, hotkey dry-run tests, README, SKILL, and prompt text.
- C2 paste behavior: Windows paste must not restore or resize the Codex window; it should capture, copy image to clipboard, foreground Codex, and paste only.
- C3 QA/evidence: tests plus real-surface-style dry-run and script assertions must prove Shift+Space wiring and no ShowWindowAsync restore call.

## Findings
- Current default shortcut is `control+space` in `src/cli.js`.
- Windows and macOS hotkey parsers both already support `shift+space`: Windows maps `shift` and `space` in `scripts/windows-hotkey.ps1`; macOS maps `shift` and `space` in `scripts/hotkey.swift`.
- Current Windows paste script calls `ShowWindowAsync($process.MainWindowHandle, 9)` in `scripts/windows-paste-into-app.ps1`; this is the likely window-size/change source because it restores the target window before paste.
- Desired scope is not AppShot capture redesign: keep capture + copy image + open/focus Codex + paste, but do not restore/resize the Codex window.
- Previous memory says Ctrl+Space was chosen earlier despite possible input-source conflicts; user now asks about Shift+Space, so update the plan default.

## Planned Approach
- Replace default AppShot shortcut from `control+space` to `shift+space` in CLI defaults, install-user wiring, docs, skill/prompt text, and tests.
- Keep optional `--key control+space` support; only the default and docs change.
- Modify Windows paste script to remove `ShowWindowAsync(..., 9)` from the normal path.
- Keep `SetForegroundWindow` and `SendKeys ^v` as the minimal paste path.
- Add/adjust tests so they fail before the change for default Shift+Space expectations and for the forbidden restore call.
- QA with:
  - unit tests for dry-run default key and docs/help expectations;
  - static script assertion that `windows-paste-into-app.ps1` no longer contains `ShowWindowAsync(..., 9)`;
  - dry-run command evidence for `dd appshot hotkey install --dry-run --json`;
  - focused manual-style command evidence for fixture capture + paste path with a fake/stub system where possible.

## Owner Decisions
- Recommended default: make Shift+Space the installed/default AppShot shortcut now.
- Keep Ctrl+Space only as an explicit custom `--key control+space` option, not as the documented default.
- Do not add a user setting or alternate shortcut chooser yet; this is a surgical change.

## Approval Gate
Please approve writing `.omo/plans/shift-space-no-resize-appshot.md` with this approach. Approval authorizes the plan file only, not implementation.
