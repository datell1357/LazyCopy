# windows-appshot-companion - Work Plan

## TL;DR (For humans)

**What you'll get:** A single dd feature surface that can also capture a Windows screen/window/region as `appshot.png`, save a matching manifest, and attach that PNG to the latest Codex thread through supported image input.

**Why this approach:** Official Codex Appshots are macOS app context, so Windows v1 should be honest: capture locally, write a real PNG, and send it through the documented Codex image path. Direct injection into an already-open Codex Desktop thread is left for a later experimental pass.

**What it will NOT do:** It will not claim Windows native Appshots support. It will not implement `--desktop-current` in v1. It will not modify the user's real `~/.codex` during QA.

**Effort:** Large
**Risk:** High - Windows capture behavior and real Codex image attachment require platform/runtime QA beyond normal unit tests.
**Decisions to sanity-check:** One new `dd` component owns both dd and appshot-like flows; one generated `dd` skill documents both; v1 support stops at `appshot.png` plus Codex CLI image input.

Your next move: approve execution of this plan. Full execution detail follows below.

---

> TL;DR (machine): Large/high-risk plan to add a new OMO Codex `dd` component with `omo-dd`/`omo-appshot`, Windows capture, dd-style artifact manifest, CLI image attach, one dd skill, packaging tests, isolated Codex QA, and Windows smoke evidence.

## Scope
### Must have
- Target repository: `/Users/yeoreum/Documents/My Project/oh-my-openagent-ulw-resume-snapshot`.
- Add a new OMO Codex plugin component at `packages/omo-codex/plugin/components/dd/`.
- One component-local skill at `packages/omo-codex/plugin/components/dd/skills/dd/SKILL.md` must cover both dd workflow and appshot-like workflow.
- Public command surface:
  - `omo-dd` for dd entrypoints and shared artifact helpers.
  - `omo-appshot capture --json [--mode active-window|region|fullscreen]`.
  - `omo-appshot --resume last "<prompt>" [--mode active-window|region|fullscreen]`.
- Artifact contract:
  - Each run writes a unique directory under `%USERPROFILE%\dd\<YYYYMMDD>\<id>\` on Windows, and an equivalent testable path under the configured output root on non-Windows.
  - The directory contains `appshot.png` and `manifest.json`.
  - Writes use temp files plus atomic rename where the platform supports it, so PNG and manifest do not disagree on successful exit.
- `manifest.json` minimum fields:
  - `schemaVersion`
  - `kind: "appshot"`
  - `id`
  - `createdAt`
  - `mode`
  - `platform`
  - `imagePath`
  - `imageSha256`
  - `imageBytes`
  - `dimensions`
  - `codexAttach`
  - `source`
  - `privacy`
- Privacy defaults:
  - Do not store raw window title by default.
  - Do not store command prompt text unless explicitly required for the attach action.
  - Mark image content as user-visible secret-bearing content in `privacy`.
- Windows capture uses `Windows.Graphics.Capture` or a small platform bridge around it, checks `GraphicsCaptureSession.IsSupported()`, and handles user cancellation or permission denial as normal nonzero CLI outcomes.
- Stable Codex delivery path builds and runs the documented image-input command equivalent to `codex resume --last -i <appshot.png> "<prompt>"`, after verifying current installed CLI help supports the image flag used.
- The implementation must record nonzero outcomes for missing `codex`, unsupported Windows capture, cancelled capture, PNG write failure, manifest write failure, and Codex attach failure.
- Packaging must register the component workspace, build output, bin names, generated skill, aggregate manifest expectations, Windows shims, and package layout.
- QA must follow `packages/omo-codex/AGENTS.md`: isolated `CODEX_HOME`, local install, `bun run test:codex`, real Codex drive under tmux, and evidence under `.omo/evidence/20260630-windows-appshot-companion/`.
- Windows smoke QA must run on a real Windows host or Windows CI/VM capable of `Windows.Graphics.Capture`; macOS unit tests are not enough.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Must not claim official Windows Appshots support.
- Must not implement or document `--desktop-current` as a v1 feature.
- Must not depend on an undocumented hidden Appshot protocol for the supported path.
- Must not inject only manifest text while claiming the model received pixels.
- Must not edit generated `packages/omo-codex/plugin/skills/dd` by hand; it must be produced by `sync-skills.mjs`.
- Must not refactor unrelated components, installer architecture, or existing hook behavior.
- Must not touch the user's real `~/.codex/config.toml` during QA.
- Must not weaken existing component, hook, package layout, or installer tests.

## Verification strategy
> Zero human intervention - all verification is agent-executed except the required Windows host/VM availability.
- Test decision: TDD for manifest schema, path generation, CLI parsing, command construction, error mapping, and packaging/bin registration; tests-after only for thin integration glue that requires the Windows runtime.
- Evidence root: `.omo/evidence/20260630-windows-appshot-companion/`.
- Per-task evidence:
  - `.omo/evidence/20260630-windows-appshot-companion/task-1-surface-contract.md`
  - `.omo/evidence/20260630-windows-appshot-companion/task-2-dd-component.md`
  - `.omo/evidence/20260630-windows-appshot-companion/task-3-manifest-capture.md`
  - `.omo/evidence/20260630-windows-appshot-companion/task-4-codex-attach.md`
  - `.omo/evidence/20260630-windows-appshot-companion/task-5-skill-package.md`
  - `.omo/evidence/20260630-windows-appshot-companion/task-6-codex-qa.md`
  - `.omo/evidence/20260630-windows-appshot-companion/task-7-windows-smoke.md`
- Required commands before completion:
  - `bun install`
  - component-local typecheck/test/build commands from `packages/omo-codex/plugin/components/dd/package.json`
  - `npm --prefix packages/omo-codex/plugin run build`
  - `npm --prefix packages/omo-codex/plugin test`
  - `bun run test:codex`
  - isolated install with `CODEX_HOME="$(mktemp -d)/codex" node packages/omo-codex/scripts/install-local.mjs install`
  - tmux-driven real Codex proof in isolated `CODEX_HOME`
  - Windows capture smoke command on Windows host/VM

## Execution strategy
### Parallel execution waves
- Wave 1: Contract and skeleton. Establish command/API/schema tests first, then create component skeleton against those tests.
- Wave 2: Runtime implementation. Build manifest/artifact writer, Windows capture bridge, CLI attach path, and error handling. Manifest and CLI tasks can proceed in parallel after the component skeleton exists.
- Wave 3: Packaging and skill integration. Wire workspace, bins, generated skill source, plugin aggregate tests, Windows shim tests, and package layout.
- Wave 4: Full QA. Run Codex gate, isolated install, tmux drive, and Windows smoke. No completion claim before this wave has evidence.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4, 5, 6, 7 | none |
| 2 | 1 | 3, 4, 5, 6 | none |
| 3 | 2 | 4, 6, 7 | 5 |
| 4 | 2, 3 | 6, 7 | 5 |
| 5 | 2 | 6 | 3, 4 |
| 6 | 3, 4, 5 | final verification | 7 after local build exists |
| 7 | 3, 4, 5 | final verification | 6 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Pin dd/AppShot command and artifact contracts in tests
  What to do / Must NOT do: Add failing tests that define `omo-dd`, `omo-appshot`, command usage, artifact directory generation, manifest fields, and explicit v1 exclusion of `--desktop-current`. Do not implement runtime behavior yet and do not edit generated skill output.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3, 4, 5, 6, 7
  References (executor has NO interview context - be exhaustive): `packages/omo-codex/plugin/test/component-bin-names.test.mjs:9`, `packages/omo-codex/plugin/test/aggregate-manifest.test.mjs`, `packages/omo-codex/plugin/package.json:8`, `packages/omo-codex/plugin/scripts/build-components.mjs:14`, `packages/omo-codex/plugin/scripts/sync-skills.mjs:13`, `.omo/drafts/windows-appshot-companion.md`
  Acceptance criteria (agent-executable): New tests fail for missing `dd` component/bin/skill before implementation, then pass after later todos; tests assert no usage text or parser path accepts `--desktop-current`.
  QA scenarios (name the exact tool + invocation): `npm --prefix packages/omo-codex/plugin test -- --test-name-pattern "component|manifest|dd|appshot"` when supported by Node test runner, otherwise run the specific test files directly with `node --test`; Evidence `.omo/evidence/20260630-windows-appshot-companion/task-1-surface-contract.md`
  Commit: N | feat(dd): pin appshot command contract

- [ ] 2. Create the dd component skeleton with `omo-dd` and `omo-appshot` bins
  What to do / Must NOT do: Add `packages/omo-codex/plugin/components/dd/` with `package.json`, `tsconfig.json`, `src/cli.ts`, `src/index.ts`, initial tests, and minimal usage/help. Register it in `packages/omo-codex/plugin/package.json`. Do not add unrelated root aliases unless packaging tests prove they are required for install/link behavior.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3, 4, 5, 6
  References (executor has NO interview context - be exhaustive): `packages/omo-codex/plugin/components/ulw-loop/package.json`, `packages/omo-codex/plugin/components/ulw-loop/src/cli.ts`, `packages/omo-codex/plugin/components/start-work-continuation/package.json`, `packages/omo-codex/plugin/scripts/build-components.mjs:14`, `packages/omo-codex/plugin/package.json:8`
  Acceptance criteria (agent-executable): `npm --prefix packages/omo-codex/plugin run build` creates `packages/omo-codex/plugin/components/dd/dist/cli.js`; `node packages/omo-codex/plugin/components/dd/dist/cli.js --help` prints OMO command names; `node packages/omo-codex/plugin/components/dd/dist/cli.js appshot --help` or `node .../dist/cli.js --help` documents capture/resume paths without `--desktop-current`.
  QA scenarios (name the exact tool + invocation): component build plus help invocations captured to `.omo/evidence/20260630-windows-appshot-companion/task-2-dd-component.md`
  Commit: N | feat(dd): add component skeleton

- [ ] 3. Implement artifact writer, manifest schema, and Windows capture bridge
  What to do / Must NOT do: Implement shared artifact code for dd/appshot output root, unique ids, temp-then-rename writes, PNG hash/size/dimensions, manifest validation, and capture mode handling. Add Windows capture bridge using `Windows.Graphics.Capture` with support checks; on non-Windows, provide a deterministic fixture capture path for tests only, not a fake production success. Do not store raw window title by default.
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 4, 6, 7
  References (executor has NO interview context - be exhaustive): Microsoft `Windows.Graphics.Capture` docs; `packages/omo-codex/plugin/components/dd/src/cli.ts` from Todo 2; `packages/omo-codex/plugin/components/dd/test/*`; prior research `.omo/ulw-research/20260630-175353-dd-codex-plan/SYNTHESIS.md`; draft `.omo/drafts/windows-appshot-companion.md`
  Acceptance criteria (agent-executable): Unit tests prove manifest fields, privacy defaults, atomic write behavior, cancellation/unsupported errors, and that successful capture output includes readable PNG dimensions and sha256 matching the file.
  QA scenarios (name the exact tool + invocation): `npm --prefix packages/omo-codex/plugin/components/dd test`; fixture capture writes evidence under a temp directory and records JSON output to `.omo/evidence/20260630-windows-appshot-companion/task-3-manifest-capture.md`
  Commit: N | feat(dd): write appshot artifacts

- [ ] 4. Implement stable Codex CLI image attachment path
  What to do / Must NOT do: Add `omo-appshot --resume last "<prompt>"` flow that captures/writes the artifact, verifies the local Codex CLI supports image input, then invokes the documented equivalent of `codex resume --last -i <appshot.png> "<prompt>"`. Capture command, exit code, stderr/stdout summary, and attach status in `manifest.json`. Do not call Codex Desktop app-server and do not implement `--desktop-current`.
  Parallelization: Wave 2 | Blocked by: 2, 3 | Blocks: 6, 7
  References (executor has NO interview context - be exhaustive): OpenAI Codex CLI features/reference docs; `packages/omo-codex/plugin/components/dd/src/cli.ts`; `packages/omo-codex/plugin/components/dd/src/*` from Todo 3; `packages/omo-codex/AGENTS.md:5`
  Acceptance criteria (agent-executable): Tests cover missing `codex`, unsupported image flag/help mismatch, nonzero Codex exit, prompt quoting with spaces, and successful command construction without shell injection. Manifest `codexAttach.status` is `not_requested`, `succeeded`, or `failed` with reason.
  QA scenarios (name the exact tool + invocation): mocked process-spawn tests via component test command; live `codex --help` or `codex resume --help` image-flag check captured to `.omo/evidence/20260630-windows-appshot-companion/task-4-codex-attach.md`
  Commit: N | feat(dd): attach appshot image to Codex

- [ ] 5. Wire one dd skill, package layout, plugin aggregation, and Windows shims
  What to do / Must NOT do: Add `packages/omo-codex/plugin/components/dd/skills/dd/SKILL.md` and register it in `packages/omo-codex/plugin/scripts/sync-skills.mjs`. Update component inventory/docs/tests as needed. Ensure generated aggregate skill is produced by `sync-skills.mjs`, not hand-edited. Update bin-name tests, aggregate manifest tests, install/bin shim tests, marketplace validation, and package layout only where they fail because `dd` is a real shipped component.
  Parallelization: Wave 3 | Blocked by: 2 | Blocks: 6
  References (executor has NO interview context - be exhaustive): `packages/omo-codex/plugin/scripts/sync-skills.mjs:13`, `packages/omo-codex/plugin/scripts/sync-skills.mjs:222`, `packages/omo-codex/plugin/test/component-bin-names.test.mjs:9`, `packages/omo-codex/src/install/codex-cache-bins.test.ts`, `packages/omo-codex/src/install/codex-hook-trust.test.ts:41`, `script/package-layout.test.ts:10`, `script/sync-lazycodex-marketplace.test.ts`, `packages/omo-codex/AGENTS.md:43`
  Acceptance criteria (agent-executable): `npm --prefix packages/omo-codex/plugin run build` materializes `packages/omo-codex/plugin/skills/dd/SKILL.md`; plugin tests pass; package layout tests include dd dist if needed; Windows `.cmd` shim tests cover `omo-dd` and `omo-appshot` if installer bin linking exposes both.
  QA scenarios (name the exact tool + invocation): `npm --prefix packages/omo-codex/plugin test`; `bun test packages/omo-codex/src/install/codex-cache-bins.test.ts script/package-layout.test.ts script/sync-lazycodex-marketplace.test.ts` or the repo's existing equivalent command; Evidence `.omo/evidence/20260630-windows-appshot-companion/task-5-skill-package.md`
  Commit: N | feat(dd): ship one dd skill and bins

- [ ] 6. Run full Codex package gate with isolated install and real Codex drive
  What to do / Must NOT do: Run the mandated `packages/omo-codex` QA using isolated `CODEX_HOME`, local install, `bun run test:codex`, and tmux-driven real Codex proof that the plugin loads and `omo-appshot` is available. Prove the user's real `~/.codex/config.toml` was not touched. Do not use the published package.
  Parallelization: Wave 4 | Blocked by: 3, 4, 5 | Blocks: final verification
  References (executor has NO interview context - be exhaustive): `packages/omo-codex/AGENTS.md:5`, `packages/omo-codex/AGENTS.md:13`, `packages/omo-codex/AGENTS.md:19`, `packages/omo-codex/AGENTS.md:20`, `packages/omo-codex/AGENTS.md:22`
  Acceptance criteria (agent-executable): `bun run test:codex` exits 0 or pre-existing unrelated failures are captured with proof; isolated install exits 0; tmux transcript shows Codex loads `omo@sisyphuslabs` and `omo-appshot --help` or equivalent command is reachable in the isolated environment; before/after checksum or diff proves real `~/.codex/config.toml` unchanged.
  QA scenarios (name the exact tool + invocation): `CODEX_HOME="$(mktemp -d)/codex" node packages/omo-codex/scripts/install-local.mjs install`; `bun run test:codex`; tmux session transcript; Evidence `.omo/evidence/20260630-windows-appshot-companion/task-6-codex-qa.md`
  Commit: N | test(dd): verify codex integration

- [ ] 7. Run Windows native smoke QA for capture and attach
  What to do / Must NOT do: On a Windows host/VM/CI environment with screen-capture capability, install the local build in an isolated Codex home, run `omo-appshot capture --json --mode active-window`, `--mode fullscreen`, and region capture if supported by the implementation, then run the resume-last attach flow against Codex image input. Do not substitute macOS screenshots for Windows capture proof.
  Parallelization: Wave 4 | Blocked by: 3, 4, 5 | Blocks: final verification
  References (executor has NO interview context - be exhaustive): Microsoft `Windows.Graphics.Capture` docs; `packages/omo-codex/AGENTS.md:19`; `packages/omo-codex/plugin/components/dd/README.md` or skill docs from Todo 5; `.omo/drafts/windows-appshot-companion.md`
  Acceptance criteria (agent-executable): Evidence includes JSON output, manifest parse, file existence, PNG byte size, dimensions, sha256 match, capture mode recorded correctly, unsupported/cancel path behavior, and Codex attach command status. If Windows host lacks capture support, evidence must show `GraphicsCaptureSession.IsSupported()` false and mark the task blocked rather than passed.
  QA scenarios (name the exact tool + invocation): Windows PowerShell or Git Bash commands for local install and `omo-appshot` capture/resume; evidence copied to `.omo/evidence/20260630-windows-appshot-companion/task-7-windows-smoke.md`
  Commit: N | test(dd): verify windows appshot smoke

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  Verify every Must have is implemented, every Must NOT have is absent, and `--desktop-current` does not exist in v1 command/help.
- [ ] F2. Code quality review
  Review changed component, installer/package wiring, tests, and skill text for simplicity, injection risks, privacy leakage, and unrelated refactors.
- [ ] F3. Real manual QA
  Re-run the isolated Codex help/capture/resume path and the Windows smoke evidence review; confirm the model receives a real image only through supported image input.
- [ ] F4. Scope fidelity
  Confirm final messaging says "Windows AppShot-like companion" and never "Windows native Appshots" or "official Windows Appshots".

## Commit strategy
- Use one focused feature branch from the current target repo branch.
- Prefer separate commits only if execution is staged manually:
  - `feat(dd): add appshot artifact and cli surface`
  - `feat(dd): wire codex packaging and skill`
  - `test(dd): add codex and windows smoke evidence`
- Do not commit `.omo/evidence` unless the repo already tracks comparable evidence artifacts for this workstream.
- Do not include generated files that are normally build output unless package layout or existing repo policy requires them.

## Success criteria
- One dd-owned component and one dd skill cover both dd and appshot-like workflows.
- `omo-appshot capture --json` produces a real `appshot.png` and valid `manifest.json`.
- `omo-appshot --resume last "<prompt>"` attaches the PNG through documented Codex image input.
- `--desktop-current` is absent from v1 behavior and documented only as a future experimental idea if mentioned at all.
- Plugin build, plugin tests, package layout/bin tests, and `bun run test:codex` pass or pre-existing unrelated failures are proven.
- Isolated Codex install and tmux-driven proof show the local plugin loads without touching the user's real Codex config.
- Windows native smoke evidence proves Windows capture behavior, manifest correctness, and attach status.
