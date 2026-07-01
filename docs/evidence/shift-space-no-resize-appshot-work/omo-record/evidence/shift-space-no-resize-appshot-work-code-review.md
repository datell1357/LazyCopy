# Code Quality Review: shift-space-no-resize-appshot-work

codeQualityStatus: CLEAR
recommendation: APPROVE
reportPath: .omo/evidence/shift-space-no-resize-appshot-work-code-review.md
blockers: []

## Review Scope

- Goal: AppShot defaults to `Shift+Space`; explicit `--key control+space` remains supported; Windows paste no longer restores/resizes the target window; AppShot stays hotkey-only; `dd` behavior is unchanged.
- Product diff reviewed: `README.md`, `SKILL.md`, `prompts/dd.md`, `scripts/install-user.js`, `scripts/windows-hotkey.ps1`, `scripts/windows-paste-into-app.ps1`, `src/cli.js`, `test/capture.test.js`.
- Evidence inspected: `.omo/evidence/shift-space-no-resize-appshot-work/task-2-npm-test.txt`, `task-2-surface.txt`, `task-2-custom-key-surface.txt`, `task-2-windows-hotkey-scan.txt`, `task-2-no-restore-scan.txt`, `task-2-scope.txt`, `task-2-diff-check.txt`, `task-2-help.txt`, `task-2-cleanup.txt`, `.omo/evidence/shift-space-no-resize-appshot-work-manual-qa.md`, and `.omo/teams/019f18e8-ac7a-7d51-918e-2950b4bf9a60/artifacts/B-surface-verifier-report.md`.
- Notepad path: none was supplied in the review request; I inspected the supplied B report and the manual QA matrix artifact instead.

## Skill Perspective Check

- `remove-ai-slops`: ran by loading `/Users/yeoreum/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/remove-ai-slops/SKILL.md`. Result: no violations. The changed tests are narrow surface/regression checks for CLI help, generated hotkey commands, the raw Windows helper default, explicit custom-key support, and the no-restore/no-resize PowerShell invariant. They are not deletion-only tests that create false confidence, and the production diff does not add unnecessary extraction, parsing, normalization, or speculative abstractions.
- `programming`: ran by loading `/Users/yeoreum/.codex/plugins/cache/sisyphuslabs/omo/4.14.0/skills/programming/SKILL.md`; no language-specific reference was applicable because this is a read-only JavaScript/PowerShell/Markdown review, not a Python/Rust/TypeScript/Go edit. Result: no violations. The diff avoids untyped escape hatches, needless abstraction, brittle prompt tests, implementation-mirroring production changes, and unnecessary validation/parsing.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Direct Review Notes

- Default AppShot hotkey is now `shift+space` in the CLI default and help surface: `src/cli.js:14`, `src/cli.js:27`, `src/cli.js:28`, `src/cli.js:48`.
- Explicit custom hotkeys still override the default through normal flag parsing: `src/cli.js:112`, `src/cli.js:158`, `src/cli.js:160`, `src/cli.js:570`, `src/cli.js:500`.
- Windows installer and raw helper default are aligned to `shift+space`: `scripts/install-user.js:55`, `scripts/windows-hotkey.ps1:2`.
- Windows paste now only foregrounds and pastes; it no longer imports/calls restore or resize APIs: `scripts/windows-paste-into-app.ps1:12`, `scripts/windows-paste-into-app.ps1:30`, `scripts/windows-paste-into-app.ps1:32`.
- Product docs describe AppShot as hotkey-only and document `Shift+Space`: `README.md:5`, `README.md:38`, `README.md:76`, `README.md:79`, `README.md:133`, `SKILL.md:39`, `SKILL.md:41`, `prompts/dd.md:17`.
- `dd` behavior code paths were not changed; the tracked diff is limited to the planned files, and there is no diff in `src/capture.js`, `bin/lazycopy.js`, `package.json`, or `package-lock.json`.

## Verification

- Re-ran `npm test`: 20 tests passed, 0 failed.
- Re-ran `git diff --check`: exit 0.
- Re-ran `node bin/lazycopy.js --help`: help shows `shift+space` and still documents `control+space` only as an explicit `--key` example.
- Re-ran `node bin/lazycopy.js appshot hotkey install --app Codex --dry-run --json`: generated command contains `shift+space`.
- Re-ran `node bin/lazycopy.js appshot hotkey install --key control+space --app Codex --dry-run --json`: generated command contains `control+space`.
- Re-ran scans: no `ShowWindowAsync`, `SW_RESTORE`, `SetWindowPos`, `MoveWindow`, `Resize`, `Maximize`, `Minimize`, or `ShowWindow(` tokens remain in `scripts/windows-paste-into-app.ps1`; no product `/appshot` or `$appshot` chat trigger remains outside tests.

## Conclusion

APPROVE. No blockers or watch issues remain. The previous WATCH finding about `scripts/windows-hotkey.ps1` defaulting to `control+space` is fixed.
