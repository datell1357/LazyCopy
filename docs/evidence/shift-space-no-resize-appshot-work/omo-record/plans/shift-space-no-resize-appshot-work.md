# shift-space-no-resize-appshot-work - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** AppShot will use Shift+Space by default, and the Windows paste step will stop restoring or resizing the Codex window.

**Why this approach:** Shift+Space is already supported by the existing hotkey parsers, so the safest change is to switch the default and docs. The window-size issue is isolated to the Windows restore call before paste, so remove that call and keep the focus + paste path.

**What it will NOT do:** It will not add a separate AppShot skill command, change `dd`, or introduce a larger background helper/performance rewrite.

**Effort:** Short
**Risk:** Low - narrow shortcut/default/docs change plus one Windows paste call removal.
**Decisions to sanity-check:** Default is `shift+space`; `control+space` remains available only when explicitly passed via `--key`.

Your next move: Already approved by `$start-work`; execute the plan and verify with captured evidence. Full execution detail follows below.

---

> TL;DR (machine): LIGHT/Short/Low; change AppShot default to Shift+Space and remove Windows restore/resize from paste path.

## Scope
### Must have
- Default AppShot hotkey becomes `shift+space` in CLI defaults, help text, install-user behavior, raw Windows helper default, README, SKILL, and prompt guidance.
- Explicit custom hotkeys continue to work; `--key control+space` remains accepted.
- Windows paste path captures, copies image to clipboard, foregrounds Codex, and sends `Ctrl+V` without `ShowWindowAsync(..., 9)` or any equivalent restore/resize call.
- Tests fail before the production change and pass after the production change.
- Evidence is written under `.omo/evidence/shift-space-no-resize-appshot-work/`.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- No `dd` behavior changes.
- No `/appshot`, `$appshot`, or separate AppShot skill invocation.
- No broad performance rewrite, resident helper, tray app, or architecture change.
- No window maximize/minimize/restore/resize call in `scripts/windows-paste-into-app.ps1`.
- No destructive cleanup of unrelated `.omo` or user files.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with Node `node:test` in `test/capture.test.js`; RED must show the old Ctrl+Space/default restore behavior failing the new contract.
- Automated evidence:
  - `.omo/evidence/shift-space-no-resize-appshot-work/task-1-red.txt`
  - `.omo/evidence/shift-space-no-resize-appshot-work/task-1-green.txt`
  - `.omo/evidence/shift-space-no-resize-appshot-work/task-1-diff-check.txt`
- Manual/auxiliary surface evidence:
  - `.omo/evidence/shift-space-no-resize-appshot-work/task-2-surface.txt` from `node bin/lazycopy.js appshot hotkey install --app Codex --dry-run --json` proving the generated default command contains `shift+space`.
  - `.omo/evidence/shift-space-no-resize-appshot-work/task-2-no-restore-scan.txt` proving the Windows paste script no longer contains `ShowWindowAsync(..., 9)` or another restore/resize call.
  - `.omo/evidence/shift-space-no-resize-appshot-work/task-2-cleanup.txt` proving no QA temp/session resource remains.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.
- Wave 1: one implementation owner performs the cohesive code/docs/test change because the hotkey default, help/docs, install-user behavior, and tests are coupled.
- Wave 2: one independent QA/verifier owner checks the real CLI surface and script invariant after Wave 1 lands.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, F1-F4 | none; owns coupled product/test/docs files |
| 2 | 1 | F1-F4 | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Shift AppShot default to Shift+Space and remove Windows restore behavior
  What to do / Must NOT do: Add failing tests first, then update `src/cli.js`, `scripts/install-user.js`, `scripts/windows-hotkey.ps1`, `scripts/windows-paste-into-app.ps1`, `README.md`, `SKILL.md`, `prompts/dd.md`, and `test/capture.test.js`. Must not change `dd` behavior, add AppShot skill commands, or add any window-state restore/maximize/minimize/resize call.
  Parallelization: Wave 1 | Blocked by: none | Blocks: Todo 2 and final verification
  References (executor has NO interview context - be exhaustive): `src/cli.js:14`, `src/cli.js:27-28`, `src/cli.js:48`, `src/cli.js:461-468`, `scripts/install-user.js:51-61`, `scripts/windows-paste-into-app.ps1:33-36`, `scripts/windows-hotkey.ps1:2`, `scripts/windows-hotkey.ps1:60-66`, `scripts/hotkey.swift:19-27`, `scripts/hotkey.swift:38-43`, `README.md:5`, `README.md:38`, `README.md:49`, `README.md:76`, `README.md:133-144`, `SKILL.md:39-41`, `prompts/dd.md:17`, `test/capture.test.js:413-470`.
  Acceptance criteria (agent-executable): RED command before product edits: `npm test -- --test-name-pattern "appshot hotkey|lazycopy help|windows paste"` exits nonzero and is captured at `.omo/evidence/shift-space-no-resize-appshot-work/task-1-red.txt` for the expected Shift+Space/no-restore assertion. GREEN command after edits: `npm test` exits 0 and is captured at `.omo/evidence/shift-space-no-resize-appshot-work/task-1-green.txt`. `git diff --check` exits 0 and is captured at `.omo/evidence/shift-space-no-resize-appshot-work/task-1-diff-check.txt`.
  QA scenarios (name the exact tool + invocation): Auxiliary CLI surface: `node bin/lazycopy.js appshot hotkey install --app Codex --dry-run --json` must include `shift+space` in the generated command and must not include `control+space` unless explicitly requested; evidence path `.omo/evidence/shift-space-no-resize-appshot-work/task-1-cli-surface.txt`. Failure surface: `node -e "const fs=require('fs'); const s=fs.readFileSync('scripts/windows-paste-into-app.ps1','utf8'); if (/ShowWindowAsync\\([^\\n]+,\\s*9\\)/.test(s) || /SW_RESTORE|ShowWindow\\(/i.test(s)) process.exit(1)"` must exit 0 after the fix and would fail before; evidence path `.omo/evidence/shift-space-no-resize-appshot-work/task-1-no-restore-scan.txt`.
  Commit: N unless user explicitly asks for commit in this turn | suggested `fix(appshot): default to shift space without window restore`
- [x] 2. Independent QA verification and cleanup receipt
  What to do / Must NOT do: Re-run the observable surfaces from a fresh shell after Todo 1, inspect the final diff for scope drift, and write a short evidence summary. Must not edit product files unless a blocking verification issue is found; if a fix is required, report it back to Todo 1 owner instead of making an unreviewed broad change.
  Parallelization: Wave 2 | Blocked by: Todo 1 | Blocks: final verification
  References (executor has NO interview context - be exhaustive): entire plan, `.omo/evidence/shift-space-no-resize-appshot-work/task-1-green.txt`, `.omo/evidence/shift-space-no-resize-appshot-work/task-1-cli-surface.txt`, `.omo/evidence/shift-space-no-resize-appshot-work/task-1-no-restore-scan.txt`, `scripts/windows-paste-into-app.ps1`, `scripts/windows-hotkey.ps1`, `src/cli.js`, `scripts/install-user.js`, `README.md`, `SKILL.md`, `prompts/dd.md`.
  Acceptance criteria (agent-executable): `npm test` exits 0; `node bin/lazycopy.js --help` mentions `shift+space`; dry-run install JSON contains `shift+space`; scan confirms no `ShowWindowAsync(..., 9)` or restore/resize vocabulary in the Windows paste path; `git diff --check` exits 0.
  QA scenarios (name the exact tool + invocation): Auxiliary CLI surface: `node bin/lazycopy.js appshot hotkey install --app Codex --dry-run --json | tee .omo/evidence/shift-space-no-resize-appshot-work/task-2-surface.txt` and parse for `shift+space`. Invariant surface: `rg -n "ShowWindowAsync\\(|SW_RESTORE|Maximize|Minimize|Resize|SetWindowPos|MoveWindow" scripts/windows-paste-into-app.ps1` must not show restore/resize operations; evidence path `.omo/evidence/shift-space-no-resize-appshot-work/task-2-no-restore-scan.txt`. Cleanup: remove only QA temp files/sessions if any were created; record `.omo/evidence/shift-space-no-resize-appshot-work/task-2-cleanup.txt`.
  Commit: N unless user explicitly asks for commit in this turn | no separate commit expected

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
- [x] F2. Code quality review
- [x] F3. Real manual QA
- [x] F4. Scope fidelity

## Commit strategy
- Do not auto-commit unless the user explicitly requests it in this turn.
- If commit is requested after verification, stage only the verified product/docs/test changes and relevant `.omo/evidence`/plan artifacts the user wants preserved.
- Suggested message: `fix(appshot): default to shift space without window restore`.

## Success criteria
- `Shift+Space` is the default installed/documented AppShot shortcut.
- `--key control+space` still works as an explicit custom key.
- Windows paste no longer calls restore/resize APIs before paste.
- `dd` behavior remains unchanged.
- Focused and full tests pass.
- Captured evidence exists for RED, GREEN, CLI surface, no-restore scan, diff check, and cleanup.
