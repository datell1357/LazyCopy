---
slug: shift-space-no-resize-appshot-work
status: approved-by-start-work
intent: clear
pending-action: write .omo/plans/shift-space-no-resize-appshot-work.md
approach: Execute the previously approved draft: make Shift+Space the default AppShot hotkey and prevent Windows paste from restoring/resizing the Codex window.
---

# Draft: shift-space-no-resize-appshot-work

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
- C1 | Hotkey surface defaults to Shift+Space while custom `--key control+space` remains supported | active | .omo/evidence/shift-space-no-resize-appshot-work/task-1-green.txt
- C2 | Windows AppShot paste focuses Codex and sends paste without restore/resize | active | .omo/evidence/shift-space-no-resize-appshot-work/task-1-green.txt
- C3 | User-facing docs/install/help match the new default and no separate AppShot skill call is introduced | active | .omo/evidence/shift-space-no-resize-appshot-work/task-2-surface.txt

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
- Shortcut default | `shift+space` | User asked whether Shift+Space is possible after Ctrl+Space caused resizing/conflict symptoms; parsers already support it | reversible
- Paste behavior | remove `ShowWindowAsync(..., 9)` from normal Windows paste path | User explicitly asked not to touch window size; restore call is the identified size-change source | reversible
- Scope | no resident helper or performance rewrite in this change | User asked for shortcut and no-resize behavior; latency optimization is separate and riskier | reversible

## Findings (cited - path:lines)
- `src/cli.js:14` currently sets `DEFAULT_HOTKEY = "control+space"`.
- `src/cli.js:27-28` and `src/cli.js:48` expose `control+space` in help text.
- `scripts/install-user.js:51-61` installs and reports `control+space` for Windows AppShot.
- `README.md:5`, `README.md:38`, `README.md:49`, `README.md:76`, `README.md:133-144` document Ctrl+Space as the AppShot path.
- `SKILL.md:39-41` and `prompts/dd.md:17` mention AppShot as a Ctrl+Space hotkey.
- `scripts/windows-hotkey.ps1:60-66` recognizes `shift` and `space`; no parser feature work is needed for Shift+Space.
- `scripts/hotkey.swift:19-27` maps `space`; `scripts/hotkey.swift:38-43` maps `shift`.
- `scripts/windows-paste-into-app.ps1:33` calls `ShowWindowAsync(..., 9)`, the restore action that can alter window size/state.
- `scripts/windows-paste-into-app.ps1:34-36` already performs the desired focus + wait + Ctrl+V paste path.
- `test/capture.test.js:413-470` covers hotkey dry-run/help surfaces and currently expects `control+space`.

## Decisions (with rationale)
- Change the installed/default AppShot hotkey to `shift+space`.
- Keep explicit custom key support, including `--key control+space`.
- Remove window restore from Windows paste instead of replacing it with another window-state call.
- Keep the paste mechanism as foreground + `Ctrl+V`; do not introduce a separate AppShot skill command or resident background architecture.
- Use TDD: add failing assertions for Shift+Space defaults and no restore call before production edits.

## Scope IN
- `src/cli.js`
- `scripts/install-user.js`
- `scripts/windows-paste-into-app.ps1`
- `README.md`
- `SKILL.md`
- `prompts/dd.md`
- `test/capture.test.js`
- `.omo/evidence/shift-space-no-resize-appshot-work/*`

## Scope OUT (Must NOT have)
- Do not rename LazyCopy or reintroduce OMO/plugin-coupled user surfaces.
- Do not change `dd` clipboard handoff behavior.
- Do not add `/appshot`, `$appshot`, or any separate skill invocation for AppShot.
- Do not add a resident helper, native tray app, or broad performance rewrite.
- Do not use window restore/maximize/minimize/resize calls in the Windows paste path.
- Do not remove custom `--key` support.

## Open questions
- None. The user's `$start-work` approval selects Shift+Space and no-resize behavior.

## Approval gate
status: approved
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
