const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createCaptureArtifact, createTextArtifact } = require("../src/capture");
const { LazyCopyError } = require("../src/errors");
const { DEFAULT_HOTKEY, launchAgentPlist, runCli } = require("../src/cli");
const { hiddenHotkeyStartupCommand, startupShortcutPath, uninstallHotkey } = require("../src/windows");

const repoRoot = path.resolve(__dirname, "..");
const oneByOnePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l1q4NwAAAABJRU5ErkJggg==",
  "base64",
);

async function makeTempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lazycopy-test-"));
  t.after(() => fs.rm(dir, { force: true, recursive: true }));
  return dir;
}

async function writeFixture(t) {
  const dir = await makeTempDir(t);
  const fixture = path.join(dir, "fixture.png");
  await fs.writeFile(fixture, oneByOnePng);
  return { dir, fixture };
}

function captureWrites() {
  const writes = [];
  return {
    stream: { write: (text) => writes.push(text) },
    text: () => writes.join(""),
    json: () => JSON.parse(writes.join("")),
  };
}

async function createDirectoryLink(target, link) {
  await fs.symlink(target, link, process.platform === "win32" ? "junction" : "dir");
}

async function writeNodeCommand(t, dir, commandName, source) {
  const scriptPath = path.join(dir, `${commandName}.js`);
  await fs.writeFile(scriptPath, source);
  await fs.chmod(scriptPath, 0o755);

  if (process.platform === "win32") {
    const commandPath = path.join(dir, `${commandName}.cmd`);
    await fs.writeFile(commandPath, `@echo off\r\n"${process.execPath}" "%~dp0${commandName}.js" %*\r\n`);
    return commandPath;
  }

  const commandPath = path.join(dir, commandName);
  await fs.writeFile(commandPath, `#!/usr/bin/env sh\nexec "${process.execPath}" "$(dirname "$0")/${commandName}.js" "$@"\n`);
  await fs.chmod(commandPath, 0o755);
  return commandPath;
}

function decodedStartupCommand(commandLine) {
  const match = commandLine.match(/(?:^|\s)-EncodedCommand\s+(\S+)/);
  assert.ok(match, "startup command must use PowerShell -EncodedCommand");
  return Buffer.from(match[1], "base64").toString("utf16le");
}

function skillFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "skill must start with YAML frontmatter");
  return Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      assert.notEqual(separator, -1, `frontmatter line must contain a colon: ${line}`);
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^"|"$/g, "");
      return [key, value];
    }),
  );
}

function fakeSystem(t, overrides = {}) {
  const calls = [];
  const tempRootPromise = makeTempDir(t);

  return {
    calls,
    claudeBin: "claude",
    codexBin: "codex",
    platform: "darwin",
    repoRoot: () => repoRoot,
    swiftBin: "swift",
    tempPngPath: (prefix) => path.join(os.tmpdir(), `${prefix}-test.png`),
    async captureScreenToFile(targetPath, options) {
      calls.push(["captureScreenToFile", targetPath, options.mode]);
      await fs.writeFile(targetPath, oneByOnePng);
      return { source: { type: "macos-front-window", windowId: "42", nativeCapture: true } };
    },
    async copyImageToClipboard(imagePath) {
      await fs.readFile(imagePath);
      calls.push(["copyImageToClipboard", imagePath]);
    },
    async pasteIntoApp(appName) {
      calls.push(["pasteIntoApp", appName]);
    },
    async readClipboardImageToFile() {
      throw new LazyCopyError("NO_CLIPBOARD_IMAGE", "No clipboard image.");
    },
    async readClipboardText() {
      return "clipboard text";
    },
    async tempRoot() {
      return tempRootPromise;
    },
    ...overrides,
  };
}

test("Codex skill sources expose dd and Korean alias as user-invocable skills", async () => {
  const ddSkill = await fs.readFile(path.join(repoRoot, "SKILL.md"), "utf8");
  const shorthandSkill = await fs.readFile(path.join(repoRoot, "skills", "ㅇㅇ", "SKILL.md"), "utf8");
  const dd = skillFrontmatter(ddSkill);

  assert.equal(dd.name, "dd");
  assert.equal(dd.title, "LazyCopy:dd");
  assert.equal(dd["display-name"], "LazyCopy:dd");
  assert.equal(dd["user-invocable"], "true");
  assert.equal(dd["argument-hint"], "[request about the clipboard, optional]");
  assert.match(ddSkill, /use Codex by default/);
  assert.match(ddSkill, /Claude only when the user explicitly asks for Claude/);
  assert.match(ddSkill, /Do not expose AppShot as a skill command/);
  assert.doesNotMatch(ddSkill, /\$ㅇㅇ <message>/);

  const shorthand = skillFrontmatter(shorthandSkill);
  assert.equal(shorthand.name, "ㅇㅇ");
  assert.equal(shorthand.title, "LazyCopy:ㅇㅇ");
  assert.equal(shorthand["display-name"], "LazyCopy:ㅇㅇ");
  assert.equal(shorthand["user-invocable"], "true");
  assert.match(shorthandSkill, /same behavior as `dd`/);
  assert.match(shorthandSkill, /Do not expose AppShot as a skill command/);
});

test("Codex prompt sources expose LazyCopy display titles", async () => {
  const ddPrompt = await fs.readFile(path.join(repoRoot, "prompts", "dd.md"), "utf8");
  const shorthandPrompt = await fs.readFile(path.join(repoRoot, "prompts", "ㅇㅇ.md"), "utf8");

  assert.equal(skillFrontmatter(ddPrompt).title, "LazyCopy:dd");
  assert.equal(skillFrontmatter(shorthandPrompt).title, "LazyCopy:ㅇㅇ");
  assert.equal(skillFrontmatter(ddPrompt).description.startsWith("LazyCopy:dd"), true);
  assert.equal(skillFrontmatter(shorthandPrompt).description.startsWith("LazyCopy:ㅇㅇ"), true);
  assert.match(ddPrompt, /^# LazyCopy:dd/m);
  assert.match(shorthandPrompt, /^# LazyCopy:ㅇㅇ/m);
});

test("createCaptureArtifact writes manifest when given a PNG fixture", async (t) => {
  const { fixture } = await writeFixture(t);
  const outputRoot = await makeTempDir(t);

  const result = await createCaptureArtifact({
    fixtureImage: fixture,
    id: "unit-id",
    mode: "region",
    now: new Date("2026-06-30T12:34:56.789Z"),
    outputRoot,
    platform: "linux",
  });

  const artifactRoot = path.join(outputRoot, "20260630", "unit-id");
  assert.equal(result.artifactDir, artifactRoot);
  assert.equal(result.imagePath, path.join(artifactRoot, "capture.png"));
  assert.equal(result.manifestPath, path.join(artifactRoot, "manifest.json"));

  const image = await fs.readFile(result.imagePath);
  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));

  assert.deepEqual(image, oneByOnePng);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.kind, "lazycopy-capture");
  assert.equal(manifest.id, "unit-id");
  assert.equal(manifest.createdAt, "2026-06-30T12:34:56.789Z");
  assert.equal(manifest.mode, "region");
  assert.equal(manifest.platform, "linux");
  assert.equal(manifest.imagePath, "capture.png");
  assert.equal(manifest.imageBytes, oneByOnePng.byteLength);
  assert.deepEqual(manifest.dimensions, { width: 1, height: 1 });
  assert.equal(
    manifest.imageSha256,
    crypto.createHash("sha256").update(oneByOnePng).digest("hex"),
  );
  assert.equal(manifest.codexAttach.path, result.imagePath);
  assert.equal(manifest.source.type, "fixture-image");
  assert.equal(manifest.source.nativeCapture, false);
});

test("createTextArtifact writes clipboard text for prompt use", async (t) => {
  const outputRoot = await makeTempDir(t);
  const result = await createTextArtifact({
    id: "text-id",
    now: new Date("2026-07-01T00:00:00.000Z"),
    outputRoot,
    platform: "darwin",
    text: "hello from clipboard",
  });

  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
  assert.equal(await fs.readFile(result.textPath, "utf8"), "hello from clipboard");
  assert.equal(manifest.kind, "lazycopy-clipboard");
  assert.equal(manifest.textPath, "clipboard.txt");
  assert.equal(manifest.textPreview, "<clipboard-text:redacted>");
  assert.equal(manifest.codexAttach.method, "prompt-text");
  assert.equal(manifest.textSha256, crypto.createHash("sha256").update("hello from clipboard").digest("hex"));
});

test("clipboard command falls back to text when no clipboard image exists", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["clipboard", "--json", "--output-root", outputRoot],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.kind, "text");
  assert.equal(await fs.readFile(payload.textPath, "utf8"), "clipboard text");
});

test("dd codex dry-run builds resume argv from clipboard text", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    [
      "dd",
      "--agent",
      "codex",
      "--dry-run",
      "--prefer",
      "text",
      "--prompt",
      "Explain this",
      "--output-root",
      outputRoot,
    ],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.dd.agent, "codex");
  assert.equal(payload.dd.command, "codex");
  assert.deepEqual(payload.dd.args.slice(0, 2), ["resume", "--last"]);
  assert.equal(payload.dd.args[2], "<prompt-with-clipboard-text:redacted>");
  assert.equal(JSON.stringify(payload).includes("clipboard text"), false);
  const manifest = await fs.readFile(payload.artifact.manifestPath, "utf8");
  assert.equal(manifest.includes("clipboard text"), false);
  assert.match(manifest, /<clipboard-text:redacted>/);
  assert.equal(await fs.readFile(payload.artifact.textPath, "utf8"), "clipboard text");
});

test("dd codex dry-run attaches clipboard image for AI vision", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["dd", "Read this clipboard image", "--dry-run", "--output-root", outputRoot],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        async readClipboardImageToFile(targetPath) {
          await fs.writeFile(targetPath, oneByOnePng);
        },
      }),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.artifact.kind, "image");
  assert.equal(payload.dd.agent, "codex");
  assert.deepEqual(payload.dd.args.slice(0, 4), ["resume", "--last", "-i", "capture.png"]);
  assert.equal(payload.dd.args[4], "Read this clipboard image");
  const manifest = JSON.parse(await fs.readFile(payload.artifact.manifestPath, "utf8"));
  assert.equal(manifest.kind, "lazycopy-capture");
  assert.equal(manifest.codexAttach.method, "local-image-path");
  assert.deepEqual(manifest.source, { type: "clipboard-image", nativeCapture: false });
  assert.equal((await fs.readFile(payload.artifact.imagePath)).byteLength, oneByOnePng.byteLength);
});

test("dd accepts a plain message without flags", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["dd", "Use this clipboard naturally", "--dry-run", "--prefer", "text", "--output-root", outputRoot],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.dd.agent, "codex");
  assert.equal(payload.dd.args[2], "<prompt-with-clipboard-text:redacted>");
  assert.equal(JSON.stringify(payload).includes("Use this clipboard naturally"), false);
});

test("Korean shorthand ㅇㅇ maps to dd", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["ㅇㅇ", "이 클립보드를 보고 이어서 작업해줘", "--dry-run", "--prefer", "text", "--output-root", outputRoot],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.dd.agent, "codex");
  assert.equal(payload.dd.command, "codex");
  assert.equal(payload.dd.args[2], "<prompt-with-clipboard-text:redacted>");
});

test("Codex dd aliases map to the same default dd behavior", async (t) => {
  for (const alias of ["/dd", "$dd", "/ㅇㅇ", "$ㅇㅇ"]) {
    const outputRoot = await makeTempDir(t);
    const stdout = captureWrites();

    const exitCode = await runCli(
      [alias, "Use this clipboard from Codex", "--dry-run", "--prefer", "text", "--output-root", outputRoot],
      {
        stdout: stdout.stream,
        stderr: { write: () => {} },
        system: fakeSystem(t),
      },
    );

    assert.equal(exitCode, 0);
    const payload = stdout.json();
    assert.equal(payload.dd.agent, "codex");
    assert.equal(payload.dd.command, "codex");
    assert.equal(payload.dd.args[2], "<prompt-with-clipboard-text:redacted>");
  }
});

test("package exposes short terminal commands without lazycopy prefix", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.bin.dd, "./bin/dd.js");
  assert.equal(packageJson.bin["ㅇㅇ"], "./bin/dd.js");
});

test("installer exposes Claude Code slash commands for dd", async () => {
  const installer = await fs.readFile(path.join(repoRoot, "scripts", "install-user.js"), "utf8");
  assert.match(installer, /\.claude/);
  assert.match(installer, /commands/);
  assert.match(installer, /claudeCommandTarget/);
  assert.match(installer, /claudeShorthandCommandTarget/);

  for (const commandName of ["dd", "ㅇㅇ"]) {
    const command = await fs.readFile(
      path.join(repoRoot, "commands", `${commandName}.md`),
      "utf8",
    );
    assert.match(command, new RegExp(`name: ${commandName}`));
    assert.match(command, /allowed-tools:/);
    assert.match(command, /Bash/);
    assert.match(command, /Read/);
    assert.match(command, /dd clipboard --json/);
    assert.doesNotMatch(command, /--agent claude/);
  }
});

test("installer uses direct spawn so Windows Node paths with spaces stay intact", async () => {
  const installer = await fs.readFile(path.join(repoRoot, "scripts", "install-user.js"), "utf8");

  assert.match(installer, /resolveRunInvocation/);
  assert.match(installer, /command:\s*"cmd\.exe"/);
  assert.match(installer, /"\/d",\s*"\/s",\s*"\/c",\s*"npm\.cmd"/);
  assert.match(installer, /shell:\s*false/);
  assert.doesNotMatch(installer, /shell:\s*process\.platform\s*===\s*"win32"/);
});

test("Windows installer keeps watcher setup ahead of optional npm link", async () => {
  const installer = await fs.readFile(path.join(repoRoot, "scripts", "install-user.js"), "utf8");
  const wrappersIndex = installer.indexOf("installWindowsUserBinWrappers();");
  const hotkeyIndex = installer.indexOf("appshot");
  const npmLinkIndex = installer.indexOf("runNpmLink({ optional: true, cwd: runtimeRoot });");

  assert.ok(wrappersIndex !== -1);
  assert.ok(hotkeyIndex !== -1);
  assert.ok(npmLinkIndex !== -1);
  assert.ok(wrappersIndex < npmLinkIndex);
  assert.ok(hotkeyIndex < npmLinkIndex);
  assert.match(installer, /const runtimeRoot = ensureDdSkill\(\);/);
  assert.match(installer, /path\.join\(runtimeRoot, "bin", "lazycopy\.js"\)/);
  assert.match(installer, /run\("npm", \["link", "--force", "--loglevel=error"\]/);
  assert.match(installer, /runNpmLink\(\{ optional: true, cwd: runtimeRoot \}\)/);
  assert.match(installer, /"--json"/);
});

test("installer smoke installs Codex skills, prompts, and Claude commands in a temp HOME", async (t) => {
  const home = await makeTempDir(t);
  const install = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LAZYCOPY_INSTALL_SKIP_NPM_LINK: "1",
      LAZYCOPY_INSTALL_SKIP_HOTKEY: "1",
    },
  });

  assert.equal(install.status, 0, install.stderr);
  assert.match(install.stdout, /\$dd/);
  assert.match(install.stdout, /\$ㅇㅇ/);

  const ddSkillPath = path.join(home, ".codex", "skills", "dd", "SKILL.md");
  const ddSkillDir = path.join(home, ".codex", "skills", "dd");
  const shorthandSkillDir = path.join(home, ".codex", "skills", "ㅇㅇ");
  const shorthandSkillPath = path.join(home, ".codex", "skills", "ㅇㅇ", "SKILL.md");
  const ddSkill = await fs.readFile(ddSkillPath, "utf8");
  const shorthandSkill = await fs.readFile(shorthandSkillPath, "utf8");
  assert.equal((await fs.lstat(ddSkillDir)).isSymbolicLink(), false);
  assert.equal(skillFrontmatter(ddSkill).name, "dd");
  assert.equal(skillFrontmatter(ddSkill).title, "LazyCopy:dd");
  assert.equal(skillFrontmatter(ddSkill)["user-invocable"], "true");
  assert.equal(skillFrontmatter(shorthandSkill).name, "ㅇㅇ");
  assert.equal(skillFrontmatter(shorthandSkill).title, "LazyCopy:ㅇㅇ");
  assert.equal(skillFrontmatter(shorthandSkill)["user-invocable"], "true");
  assert.equal((await fs.lstat(shorthandSkillDir)).isSymbolicLink(), false);
  assert.equal((await fs.lstat(shorthandSkillPath)).isFile(), true);

  const ddPrompt = await fs.readFile(path.join(home, ".codex", "prompts", "dd.md"), "utf8");
  const shorthandPrompt = await fs.readFile(path.join(home, ".codex", "prompts", "ㅇㅇ.md"), "utf8");
  assert.equal(skillFrontmatter(ddPrompt).title, "LazyCopy:dd");
  assert.equal(skillFrontmatter(shorthandPrompt).title, "LazyCopy:ㅇㅇ");
  assert.equal(skillFrontmatter(ddPrompt).description.startsWith("LazyCopy:dd"), true);
  assert.equal(skillFrontmatter(shorthandPrompt).description.startsWith("LazyCopy:ㅇㅇ"), true);
  await fs.access(path.join(ddSkillDir, "bin", "lazycopy.js"));
  await fs.access(path.join(ddSkillDir, "src", "cli.js"));
  await fs.access(path.join(ddSkillDir, "scripts", "windows-appshot-watch.ps1"));
  await fs.access(path.join(home, ".claude", "commands", "dd.md"));
  await fs.access(path.join(home, ".claude", "commands", "ㅇㅇ.md"));
});

test("installer repairs a stale root dd skill symlink instead of preserving a volatile source path", async (t) => {
  const home = await makeTempDir(t);
  const staleTarget = path.join(home, "deleted-qa-copy");
  const ddSkillDir = path.join(home, ".codex", "skills", "dd");
  await fs.mkdir(path.dirname(ddSkillDir), { recursive: true });
  await fs.mkdir(staleTarget, { recursive: true });
  await createDirectoryLink(staleTarget, ddSkillDir);
  await fs.rm(staleTarget, { force: true, recursive: true });

  const install = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LAZYCOPY_INSTALL_SKIP_NPM_LINK: "1",
      LAZYCOPY_INSTALL_SKIP_HOTKEY: "1",
    },
  });

  assert.equal(install.status, 0, install.stderr);
  assert.equal((await fs.lstat(ddSkillDir)).isSymbolicLink(), false);
  assert.equal(JSON.parse(await fs.readFile(path.join(ddSkillDir, "package.json"), "utf8")).name, "lazycopy");
  await fs.access(path.join(ddSkillDir, "bin", "lazycopy.js"));
  await fs.access(path.join(ddSkillDir, "scripts", "start-windows-appshot-watch.js"));
});

test("installer refreshes an existing stable dd checkout without deleting git metadata", async (t) => {
  const home = await makeTempDir(t);
  const ddSkillDir = path.join(home, ".codex", "skills", "dd");
  await fs.mkdir(path.join(ddSkillDir, ".git"), { recursive: true });
  await fs.writeFile(path.join(ddSkillDir, ".git", "HEAD"), "ref: refs/heads/Implementation\n");
  await fs.writeFile(path.join(ddSkillDir, "package.json"), JSON.stringify({ name: "lazycopy" }));

  const install = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LAZYCOPY_INSTALL_SKIP_NPM_LINK: "1",
      LAZYCOPY_INSTALL_SKIP_HOTKEY: "1",
    },
  });

  assert.equal(install.status, 0, install.stderr);
  assert.equal(await fs.readFile(path.join(ddSkillDir, ".git", "HEAD"), "utf8"), "ref: refs/heads/Implementation\n");
  assert.equal(JSON.parse(await fs.readFile(path.join(ddSkillDir, "package.json"), "utf8")).name, "lazycopy");
  await fs.access(path.join(ddSkillDir, "bin", "lazycopy.js"));
});

test("installer replaces old Korean skill symlink without overwriting root dd skill", async (t) => {
  const home = await makeTempDir(t);
  const aliasParent = path.join(home, ".codex", "skills");
  const aliasDir = path.join(aliasParent, "ㅇㅇ");
  await fs.mkdir(aliasParent, { recursive: true });
  await createDirectoryLink(repoRoot, aliasDir);
  const rootSkillBefore = await fs.readFile(path.join(repoRoot, "SKILL.md"), "utf8");

  const install = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LAZYCOPY_INSTALL_SKIP_NPM_LINK: "1",
      LAZYCOPY_INSTALL_SKIP_HOTKEY: "1",
    },
  });

  assert.equal(install.status, 0, install.stderr);
  assert.equal(await fs.readFile(path.join(repoRoot, "SKILL.md"), "utf8"), rootSkillBefore);
  assert.equal((await fs.lstat(aliasDir)).isSymbolicLink(), false);
  const aliasSkill = await fs.readFile(path.join(aliasDir, "SKILL.md"), "utf8");
  assert.equal(skillFrontmatter(aliasSkill).name, "ㅇㅇ");
});

test("Windows installer writes stable ASCII-entrypoint user bin wrappers", async (t) => {
  const home = await makeTempDir(t);
  const install = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LAZYCOPY_INSTALL_TEST_PLATFORM: "win32",
      LAZYCOPY_INSTALL_SKIP_NPM_LINK: "1",
      LAZYCOPY_INSTALL_SKIP_HOTKEY: "1",
    },
  });

  assert.equal(install.status, 0, install.stderr);
  assert.match(install.stdout, /Windows user-bin wrappers/);

  const binDir = path.join(home, "bin");
  const ddCmd = await fs.readFile(path.join(binDir, "dd.cmd"), "utf8");
  const shorthandCmd = await fs.readFile(path.join(binDir, "ㅇㅇ.cmd"), "utf8");
  const lazycopyCmd = await fs.readFile(path.join(binDir, "lazycopy.cmd"), "utf8");
  const ddSh = await fs.readFile(path.join(binDir, "dd"), "utf8");
  const shorthandSh = await fs.readFile(path.join(binDir, "ㅇㅇ"), "utf8");
  const lazycopySh = await fs.readFile(path.join(binDir, "lazycopy"), "utf8");

  assert.match(ddCmd, /bin\\lazycopy\.js" dd %\*/);
  assert.match(shorthandCmd, /bin\\lazycopy\.js" dd %\*/);
  assert.match(lazycopyCmd, /bin\\lazycopy\.js" %\*/);
  assert.doesNotMatch(ddCmd, /ㅇㅇ\.js/);
  assert.doesNotMatch(shorthandCmd, /ㅇㅇ\.js/);
  assert.match(ddSh, /\$USERPROFILE\/\.codex\/skills\/dd\/bin\/lazycopy\.js" dd "\$@"/);
  assert.match(shorthandSh, /\$USERPROFILE\/\.codex\/skills\/dd\/bin\/lazycopy\.js" dd "\$@"/);
  assert.match(lazycopySh, /\$USERPROFILE\/\.codex\/skills\/dd\/bin\/lazycopy\.js" "\$@"/);
});

test("Windows installer does not let npm link failure block user-bin wrappers", async (t) => {
  const home = await makeTempDir(t);
  const install = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      Path: home,
      PATH: home,
      LAZYCOPY_INSTALL_TEST_PLATFORM: "win32",
      LAZYCOPY_INSTALL_SKIP_HOTKEY: "1",
    },
  });

  assert.equal(install.status, 0, install.stderr);
  assert.match(install.stderr, /Warning: npm link .*failed/);
  assert.match(install.stdout, /Windows user-bin wrappers/);
  assert.match(install.stdout, /watcher-managed Shift\+Space AppShot/);
  await fs.access(path.join(home, "bin", "dd.cmd"));
  await fs.access(path.join(home, "bin", "ㅇㅇ.cmd"));
  await fs.access(path.join(home, "bin", "lazycopy.cmd"));
});

test("dd claude dry-run builds print argv from clipboard text", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    [
      "dd",
      "--agent",
      "claude",
      "--dry-run",
      "--prefer",
      "text",
      "--prompt",
      "Explain this",
      "--output-root",
      outputRoot,
    ],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.dd.agent, "claude");
  assert.equal(payload.dd.command, "claude");
  assert.deepEqual(payload.dd.args.slice(0, 2), ["--continue", "--print"]);
  assert.equal(payload.dd.args[2], "--");
  assert.equal(payload.dd.args[3], "<prompt-with-clipboard-text:redacted>");
  assert.equal(JSON.stringify(payload).includes("clipboard text"), false);
  const manifest = await fs.readFile(payload.artifact.manifestPath, "utf8");
  assert.equal(manifest.includes("clipboard text"), false);
  assert.match(manifest, /<clipboard-text:redacted>/);
});

test("dd claude dry-run exposes clipboard image artifact directory", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();

  const exitCode = await runCli(
    [
      "dd",
      "--agent",
      "claude",
      "--dry-run",
      "--prompt",
      "Read this image",
      "--output-root",
      outputRoot,
    ],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        async readClipboardImageToFile(targetPath) {
          await fs.writeFile(targetPath, oneByOnePng);
        },
      }),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.artifact.kind, "image");
  assert.equal(payload.dd.agent, "claude");
  assert.deepEqual(payload.dd.args.slice(0, 3), ["--continue", "--print", "--add-dir"]);
  assert.equal(payload.dd.args[3], "<lazycopy-artifact-dir>");
  assert.equal(payload.dd.args[4], "--");
  assert.equal(payload.dd.args[5], "<prompt-with-clipboard-image:redacted>");
});

test("appshot desktop captures the front window, copies it, targets Codex, and cleans up", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();
  const system = fakeSystem(t);

  const exitCode = await runCli(
    ["appshot", "desktop", "--json", "--output-root", outputRoot, "--paste-to", "Codex"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system,
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.copiedToClipboard, true);
  assert.equal(payload.pastedTo, "Codex");
  assert.equal(payload.cleanup.deleted, true);
  await assert.rejects(fs.access(payload.artifactDir), { code: "ENOENT" });
  assert.deepEqual(system.calls.map((call) => call[0]), [
    "captureScreenToFile",
    "copyImageToClipboard",
    "pasteIntoApp",
  ]);
});

test("Windows appshot desktop uses one fast capture-copy-paste helper when safe", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();
  const system = fakeSystem(t, {
    platform: "win32",
    tempPngPath: (prefix) => path.join(outputRoot, `${prefix}-fast.png`),
    async captureCopyPaste(targetPath, options) {
      this.calls.push(["captureCopyPaste", targetPath, options.mode, options.appName]);
      await fs.writeFile(targetPath, oneByOnePng);
      return { source: { type: "windows-front-window", hwnd: "99", nativeCapture: true } };
    },
  });

  const exitCode = await runCli(
    ["appshot", "desktop", "--json", "--output-root", outputRoot, "--paste-to", "Codex"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system,
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.copiedToClipboard, true);
  assert.equal(payload.pastedTo, "Codex");
  assert.equal(payload.cleanup.deleted, true);
  await assert.rejects(fs.access(payload.artifactDir), { code: "ENOENT" });
  assert.deepEqual(system.calls.map((call) => call[0]), ["captureCopyPaste"]);
  assert.equal(system.calls[0][2], "active-window");
  assert.equal(system.calls[0][3], "Codex");
});

test("Windows fast AppShot helper provides a brief visual capture flash", async () => {
  const script = await fs.readFile(
    path.join(repoRoot, "scripts", "windows-appshot-fast.ps1"),
    "utf8",
  );
  const sound = await fs.readFile(path.join(repoRoot, "assets", "appshot.mp3"));

  assert.match(script, /Invoke-LazyCopyCaptureFlash/);
  assert.match(script, /Start-LazyCopyCaptureSound/);
  assert.match(script, /Close-LazyCopyCaptureSound/);
  assert.match(script, /assets\\appshot\.mp3/);
  assert.match(script, /winmm\.dll/);
  assert.match(script, /mciSendString/);
  assert.match(script, /type mpegvideo alias/);
  assert.match(script, /AttachThreadInput/);
  assert.match(script, /BringWindowToTop/);
  assert.match(script, /SetActiveWindow/);
  assert.match(script, /AppActivate\(\$ProcessId\)/);
  assert.match(script, /Invoke-LazyCopyAppActivate -ProcessId \$process\.Id/);
  assert.match(script, /Set-LazyCopyForegroundWindow -Handle \$process\.MainWindowHandle/);
  assert.match(script, /refusing to paste into the current window/);
  assert.match(script, /appshot-foreground-ok/);
  assert.match(script, /appshot-pasted/);
  assert.match(script, /System\.Windows\.Forms\.Form/);
  assert.match(script, /Opacity\s*=\s*0\.38/);
  assert.match(script, /\$CaptureFlashMilliseconds = 120/);
  assert.match(script, /\$CapturePostFlashDelayMilliseconds = 30/);
  assert.match(script, /Start-Sleep -Milliseconds \$CaptureFlashMilliseconds/);
  assert.match(script, /Start-Sleep -Milliseconds \$CapturePostFlashDelayMilliseconds/);
  assert.doesNotMatch(script, /Start-Sleep -Milliseconds 90/);
  assert.match(script, /ShowInTaskbar\s*=\s*\$false/);
  assert.match(script, /TopMost\s*=\s*\$true/);
  assert.match(script, /Invoke-LazyCopyCaptureFlash -Left \$left -Top \$top -Width \$width -Height \$height -SoundPath \$SoundPath/);
  assert.match(script, /if \(-not \$TargetPath\)/);
  assert.match(script, /Remove-Item -LiteralPath \$TargetPath/);
  const flashInvocationIndex = script.indexOf("$captureSoundPlayer = Invoke-LazyCopyCaptureFlash");
  const captureIndex = script.indexOf("$graphics.CopyFromScreen");
  const foregroundIndex = script.indexOf("Set-LazyCopyForegroundWindow -Handle $process.MainWindowHandle");
  const pasteIndex = script.indexOf('[System.Windows.Forms.SendKeys]::SendWait("^v")');
  assert.ok(flashInvocationIndex !== -1);
  assert.ok(captureIndex !== -1);
  assert.ok(foregroundIndex !== -1);
  assert.ok(pasteIndex !== -1);
  assert.ok(flashInvocationIndex < captureIndex);
  assert.ok(captureIndex < foregroundIndex);
  assert.ok(script.indexOf("Start-Sleep -Milliseconds $CapturePostFlashDelayMilliseconds") < foregroundIndex);
  assert.ok(foregroundIndex < pasteIndex);
  assert.doesNotMatch(script, /Start-Sleep -Milliseconds 200/);
  assert.ok(sound.length > 1024);
});

test("Windows appshot desktop falls back when fast helper is not safe", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();
  const system = fakeSystem(t, {
    platform: "win32",
    async captureCopyPaste() {
      throw new Error("fast path should not be used with --no-paste");
    },
  });

  const exitCode = await runCli(
    ["appshot", "desktop", "--json", "--no-paste", "--output-root", outputRoot],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system,
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.copiedToClipboard, true);
  assert.equal(payload.pastedTo, null);
  assert.deepEqual(system.calls.map((call) => call[0]), [
    "captureScreenToFile",
    "copyImageToClipboard",
  ]);
});

test("appshot desktop --keep preserves the capture artifact", async (t) => {
  const outputRoot = await makeTempDir(t);
  const stdout = captureWrites();
  const system = fakeSystem(t);

  const exitCode = await runCli(
    ["appshot", "desktop", "--json", "--keep", "--output-root", outputRoot],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system,
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.cleanup.kept, true);
  assert.equal((await fs.readFile(payload.imagePath)).byteLength, oneByOnePng.byteLength);
});

test("appshot hotkey install dry-run emits a LaunchAgent for LazyCopy appshot", async (t) => {
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["appshot", "hotkey", "install", "--app", "Codex", "--dry-run"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.ok, true);
  assert.match(payload.plist, /com\.lazycopy\.hotkey/);
  assert.match(payload.plist, /shift\+space/);
  assert.doesNotMatch(payload.plist, /control\+space/);
  assert.equal(payload.plist.includes("appshot"), true);
  assert.match(payload.plist, /hotkey/);
  assert.match(payload.plist, /run/);
});

test("appshot hotkey install respects an explicit custom key", async (t) => {
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["appshot", "hotkey", "install", "--key", "control+space", "--app", "Codex", "--dry-run"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.ok, true);
  assert.match(payload.plist, /control\+space/);
});

test("Windows appshot hotkey install dry-run emits a startup watcher command", async (t) => {
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["appshot", "hotkey", "install", "--app", "Codex", "--dry-run", "--json"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        platform: "win32",
        startupShortcutPath: () => "C:\\Users\\tester\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\LazyCopy-AppShot-Hotkey.cmd",
        hotkeyLogPath: () => "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
      }),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.ok, true);
  assert.match(payload.startupPath, /LazyCopy-AppShot-Hotkey\.cmd$/);
  assert.equal(payload.key, "shift+space");
  assert.match(payload.logPath, /LazyCopy\\appshot-hotkey\.log$/);
  assert.equal(payload.mode, "watcher");
  assert.equal(payload.command[0], "powershell.exe");
  assert.deepEqual(payload.command.slice(1, 6), [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
  ]);
  assert.match(payload.command[6], /windows-appshot-watch\.ps1$/);
  assert.deepEqual(payload.command.slice(7, 14), [
    "-Key",
    "shift+space",
    "-AppName",
    "Codex",
    "-LogPath",
    "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
    "-PollSeconds",
  ]);
  assert.equal(payload.command[14], "2");
  assert.equal(payload.command[15], "-UpdateCheckMinSeconds");
  assert.equal(payload.command[16], "300");
  assert.equal(payload.command[17], "-SelfUpdateCommandBase64");
  const selfUpdateCommand = JSON.parse(Buffer.from(payload.command[18], "base64").toString("utf8"));
  assert.equal(selfUpdateCommand[0], process.execPath);
  assert.match(selfUpdateCommand[1], /self-update\.js$/);
  assert.deepEqual(selfUpdateCommand.slice(2, 5), ["--repo-root", repoRoot, "--log-path"]);
  assert.equal(selfUpdateCommand[5], "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log");
  assert.equal(payload.command[19], "-ListenerCommandBase64");
  assert.equal(payload.command.filter((value) => value === "-Key").length, 1);
  const listenerCommand = JSON.parse(Buffer.from(payload.command[20], "base64").toString("utf8"));
  assert.deepEqual(listenerCommand.slice(0, 6), [
    "powershell.exe",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
  ]);
  assert.match(listenerCommand[6], /windows-hotkey\.ps1$/);
  assert.deepEqual(listenerCommand.slice(7, 12), [
    "-Key",
    "shift+space",
    "-LogPath",
    "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
    "-CommandBase64",
  ]);
  const fastCommand = JSON.parse(Buffer.from(listenerCommand[12], "base64").toString("utf8"));
  assert.equal(payload.command.includes("run"), false);
  assert.match(payload.startupCommand, /^"powershell\.exe" -NoProfile -ExecutionPolicy Bypass -EncodedCommand /);
  const startupCommand = decodedStartupCommand(payload.startupCommand);
  assert.match(startupCommand, /^Start-Process -WindowStyle Hidden -PassThru -FilePath 'powershell\.exe' -ArgumentList @\(/);
  assert.match(startupCommand, /\| Select-Object -ExpandProperty Id$/);
  assert.match(startupCommand, /'\"[^']*windows-appshot-watch\.ps1\"'/);
  assert.match(startupCommand, /'C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey\.log'/);
  assert.doesNotMatch(payload.startupCommand, /start-windows-appshot-watch\.js/);
  assert.doesNotMatch(payload.startupCommand, /\/min/);
  const fastScriptIndex = fastCommand.findIndex((value) => /windows-appshot-fast\.ps1$/.test(value));
  assert.ok(fastScriptIndex !== -1);
  assert.deepEqual(fastCommand.slice(fastScriptIndex - 6, fastScriptIndex + 5), [
    "powershell.exe",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
    fastCommand[fastScriptIndex],
    "-Mode",
    "active-window",
    "-AppName",
    "Codex",
  ]);
  assert.deepEqual(fastCommand.slice(fastScriptIndex + 5), [
    "-LogPath",
    "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
  ]);
  assert.equal(listenerCommand.filter((value) => value === "-LogPath").length, 1);
  assert.equal(fastCommand.filter((value) => value === "-LogPath").length, 1);
  assert.doesNotMatch(listenerCommand.join("\n"), /bin[/\\]lazycopy\.js/);
  assert.doesNotMatch(listenerCommand.join("\n"), /appshot\n/);
  assert.doesNotMatch(listenerCommand.join("\n"), /windows-appshot-fast\.ps1/);
});

test("Windows appshot hotkey install starts the watcher process", async (t) => {
  const stdout = captureWrites();
  const installed = [];

  const exitCode = await runCli(
    ["appshot", "hotkey", "install", "--app", "Codex", "--json"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        platform: "win32",
        startupShortcutPath: () => "C:\\Users\\tester\\Startup\\LazyCopy-AppShot-Hotkey.cmd",
        hotkeyLogPath: () => "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
        async installHotkey(command, options) {
          installed.push({ command, options });
          return {
            startupPath: "C:\\Users\\tester\\Startup\\LazyCopy-AppShot-Hotkey.cmd",
            started: true,
            logPath: options.logPath,
          };
        },
      }),
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(installed.length, 1);
  assert.equal(installed[0].command[0], "powershell.exe");
  assert.match(installed[0].command[6], /windows-appshot-watch\.ps1$/);
  assert.equal(installed[0].command.includes("-ListenerCommandBase64"), true);
  assert.equal(installed[0].command.includes("-SelfUpdateCommandBase64"), true);
  assert.equal(installed[0].command.filter((value) => value === "-Key").length, 1);
  const updateCommand = JSON.parse(
    Buffer.from(installed[0].command[installed[0].command.indexOf("-SelfUpdateCommandBase64") + 1], "base64").toString("utf8"),
  );
  assert.match(updateCommand[1], /self-update\.js$/);
  const listenerCommand = JSON.parse(
    Buffer.from(installed[0].command[installed[0].command.indexOf("-ListenerCommandBase64") + 1], "base64").toString("utf8"),
  );
  assert.match(listenerCommand[6], /windows-hotkey\.ps1$/);
  assert.equal(listenerCommand.includes("-CommandBase64"), true);
  assert.equal(listenerCommand.filter((value) => value === "-LogPath").length, 1);
  const fastCommand = JSON.parse(
    Buffer.from(listenerCommand[listenerCommand.indexOf("-CommandBase64") + 1], "base64").toString("utf8"),
  );
  assert.equal(fastCommand.some((value) => /windows-appshot-fast\.ps1$/.test(value)), true);
  assert.equal(fastCommand.filter((value) => value === "-LogPath").length, 1);
  assert.equal(installed[0].command.includes("run"), false);
  assert.match(
    decodedStartupCommand(installed[0].options.startupCommand),
    /^Start-Process -WindowStyle Hidden -PassThru -FilePath 'powershell\.exe' -ArgumentList @\(/,
  );
  assert.doesNotMatch(installed[0].options.startupCommand, /start-windows-appshot-watch\.js/);

  const payload = stdout.json();
  assert.equal(payload.started, true);
  assert.equal(payload.mode, "watcher");
  assert.deepEqual(payload.command, installed[0].command);
});

test("Windows hotkey install writes a Startup launcher and runs it immediately", async () => {
  const source = await fs.readFile(path.join(repoRoot, "src", "windows.js"), "utf8");

  assert.match(
    decodedStartupCommand(hiddenHotkeyStartupCommand([
      "powershell.exe",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-File",
      "C:\\Lazy Copy\\scripts\\windows-appshot-watch.ps1",
      "-AppName",
      "Codex",
    ])),
    /^Start-Process -WindowStyle Hidden -PassThru -FilePath 'powershell\.exe' -ArgumentList @\('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', '"C:\\Lazy Copy\\scripts\\windows-appshot-watch\.ps1"', '-AppName', 'Codex'\) \| Select-Object -ExpandProperty Id$/,
  );
  assert.match(source, /child\.once\("spawn"/);
  assert.match(source, /child\.once\("close"/);
  assert.match(source, /Select-Object -ExpandProperty Id/);
  assert.match(source, /Number\.parseInt\(stdout\.trim\(\), 10\)/);
  assert.match(source, /installer-spawned pid=\$\{pid\}/);
  assert.match(source, /"cmd\.exe"/);
  assert.match(source, /`call "\$\{startupPath\}"/);
  assert.match(source, /windowsVerbatimArguments:\s*true/);
  assert.match(source, /Start-Process -WindowStyle Hidden/);
  assert.doesNotMatch(source, /start-windows-appshot-watch\.js/);
  assert.doesNotMatch(source, /detached:\s*true/);
});

test("Windows appshot hotkey install can refresh Startup without starting a second watcher", async (t) => {
  const stdout = captureWrites();
  const installed = [];

  const exitCode = await runCli(
    ["appshot", "hotkey", "install", "--app", "Codex", "--no-start", "--json"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        platform: "win32",
        startupShortcutPath: () => "C:\\Users\\tester\\Startup\\LazyCopy-AppShot-Hotkey.cmd",
        hotkeyLogPath: () => "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
        async installHotkey(command, options) {
          installed.push({ command, options });
          return {
            startupPath: "C:\\Users\\tester\\Startup\\LazyCopy-AppShot-Hotkey.cmd",
            started: options.start !== false,
            logPath: options.logPath,
          };
        },
      }),
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(installed.length, 1);
  assert.equal(installed[0].options.start, false);
  assert.equal(stdout.json().started, false);
});

test("Windows appshot hotkey dry-run omits log-path args when no log path is available", async (t) => {
  const stdout = captureWrites();

  const exitCode = await runCli(
    ["appshot", "hotkey", "install", "--app", "Codex", "--dry-run", "--json"],
    {
      stdout: stdout.stream,
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        platform: "win32",
        startupShortcutPath: () => "C:\\Users\\tester\\Startup\\LazyCopy-AppShot-Hotkey.cmd",
      }),
    },
  );

  assert.equal(exitCode, 0);
  const payload = stdout.json();
  assert.equal(payload.command.includes("--log-path"), false);
  assert.equal(payload.command.some((value) => value == null || value === "undefined"), false);
});

test("Windows appshot hotkey run keeps the direct PowerShell listener path", async (t) => {
  const dir = await makeTempDir(t);
  const argvPath = path.join(dir, "argv.json");
  const powershellShim = await writeNodeCommand(
    t,
    dir,
    "powershell-shim",
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(${JSON.stringify(argvPath)}, JSON.stringify(process.argv.slice(2)));
`,
  );

  const exitCode = await runCli(
    ["appshot", "hotkey", "run", "--key", "shift+space", "--app", "Codex"],
    {
      inheritStdio: false,
      stdout: { write: () => {} },
      stderr: { write: () => {} },
      system: fakeSystem(t, {
        platform: "win32",
        powershellBin: () => powershellShim,
        hotkeyLogPath: () => "C:\\Users\\tester\\AppData\\Local\\LazyCopy\\appshot-hotkey.log",
      }),
    },
  );

  assert.equal(exitCode, 0);
  const args = JSON.parse(await fs.readFile(argvPath, "utf8"));
  assert.match(args[5], /windows-hotkey\.ps1$/);
  assert.equal(args.includes("-CommandBase64"), true);
  assert.equal(args.filter((value) => value === "-LogPath").length, 1);
  const command = JSON.parse(
    Buffer.from(args[args.indexOf("-CommandBase64") + 1], "base64").toString("utf8"),
  );
  assert.equal(command.some((value) => /windows-appshot-fast\.ps1$/.test(value)), true);
  assert.equal(command.filter((value) => value === "-LogPath").length, 1);
  assert.doesNotMatch(args.join("\n"), /windows-appshot-watch\.ps1/);
  assert.doesNotMatch(args.join("\n"), /windows-appshot-fast\.ps1/);
});

test("Windows watcher helper manages the visible Codex listener lifecycle", async () => {
  const script = await fs.readFile(
    path.join(repoRoot, "scripts", "windows-appshot-watch.ps1"),
    "utf8",
  );

  assert.match(script, /\[string\]\$Key = "shift\+space"/);
  assert.match(script, /\[string\]\$AppName = "Codex"/);
  assert.match(script, /\[int\]\$PollSeconds = 2/);
  assert.match(script, /\[int\]\$UpdateCheckMinSeconds = 300/);
  assert.match(script, /\[string\]\$ListenerCommandBase64/);
  assert.match(script, /\[string\]\$SelfUpdateCommandBase64/);
  assert.match(script, /FromBase64String\(\$Value\)/);
  assert.match(script, /ConvertTo-LazyCopyPowerShellArgument/);
  assert.match(script, /Start-LazyCopyHiddenProcess/);
  assert.match(script, /-ArgumentList \$argumentList/);
  assert.doesNotMatch(script, /return\s+"'\s*"\s*\+/);
  assert.doesNotMatch(script, /-replace "'", "''"/);
  assert.match(script, /\$Value\.Length -eq 0/);
  assert.match(script, /return '""'/);
  assert.match(script, /\$Value -notmatch '\[\\s"\]'/);
  assert.match(script, /return \$Value/);
  assert.match(script, /-replace '"', '\\"'/);
  assert.match(script, /\[regex\]::Escape\(\$AppName\)/);
  assert.match(script, /MainWindowHandle -ne 0/);
  assert.match(script, /ProcessName -match \$escaped/);
  assert.match(script, /MainWindowTitle -match \$escaped/);
  assert.match(script, /Start-LazyCopySelfUpdate/);
  assert.match(script, /update-check-started/);
  assert.match(script, /update-check-skip/);
  assert.match(script, /Stop-Process -Id \$Process\.Id/);
  assert.match(script, /\[Math\]::Min\(\$restartDelay \* 2, \$maxBackoffSeconds\)/);
  assert.match(script, /\$maxBackoffSeconds = 30/);
  for (const marker of [
    "watcher-start",
    "codex-visible",
    "codex-hidden",
    "listener-start",
    "listener-started",
    "listener-exited",
    "listener-stop-requested",
    "listener-restart",
    "watcher-failed",
    "watcher-stop",
  ]) {
    assert.match(script, new RegExp(marker));
  }
  assert.equal(script.includes(["Stop-Process", "-Name"].join(" ")), false);
  assert.equal(script.includes(["Get-Process", "|", "Stop-Process"].join(" ")), false);
});

test("self-update fast-forwards and refreshes installed surfaces", async (t) => {
  const dir = await makeTempDir(t);
  const fakeBin = path.join(dir, "bin");
  const fakeRepo = path.join(dir, "repo");
  const callsPath = path.join(dir, "calls.jsonl");
  const statePath = path.join(dir, "state.txt");
  const logPath = path.join(dir, "appshot-hotkey.log");
  await fs.mkdir(path.join(fakeRepo, ".git"), { recursive: true });
  await fs.mkdir(path.join(fakeRepo, "scripts"), { recursive: true });
  await fs.mkdir(fakeBin, { recursive: true });

  await writeNodeCommand(
    t,
    fakeBin,
    "git",
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.LAZY_FAKE_CALLS, JSON.stringify({ command: "git", args }) + "\\n");
const statePath = process.env.LAZY_FAKE_STATE;
const updated = fs.existsSync(statePath);
const oldSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const newSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
if (args.join(" ") === "rev-parse --is-inside-work-tree") {
  process.stdout.write("true\\n");
} else if (args.join(" ") === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
  process.stdout.write("origin/Implementation\\n");
} else if (args.join(" ") === "rev-parse HEAD") {
  process.stdout.write((updated ? newSha : oldSha) + "\\n");
} else if (args.join(" ") === "rev-parse @{u}") {
  process.stdout.write(newSha + "\\n");
} else if (args.join(" ") === "fetch --quiet") {
} else if (args.join(" ") === "merge --ff-only --quiet @{u}") {
  fs.writeFileSync(statePath, "updated");
} else {
  process.exit(2);
}
`,
  );

  const installUserShim = path.join(fakeRepo, "scripts", "install-user.js");
  await fs.writeFile(
    installUserShim,
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.LAZY_FAKE_CALLS, JSON.stringify({
  command: "install-user",
  args: process.argv.slice(2),
  skipHotkey: process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY,
  skipHotkeyStart: process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY_START,
  skipNpmLink: process.env.LAZYCOPY_INSTALL_SKIP_NPM_LINK,
  selfUpdate: process.env.LAZYCOPY_SELF_UPDATE
}) + "\\n");
`,
  );

  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "self-update.js"), "--repo-root", fakeRepo, "--log-path", logPath],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        LAZY_FAKE_CALLS: callsPath,
        LAZY_FAKE_STATE: statePath,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ""}`,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const calls = (await fs.readFile(callsPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(calls.filter((call) => call.command === "git").map((call) => call.args), [
    ["rev-parse", "--is-inside-work-tree"],
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    ["rev-parse", "HEAD"],
    ["fetch", "--quiet"],
    ["rev-parse", "@{u}"],
    ["merge", "--ff-only", "--quiet", "@{u}"],
    ["rev-parse", "HEAD"],
  ]);
  const installUserCall = calls.find((call) => call.command === "install-user");
  assert.ok(installUserCall);
  assert.deepEqual(installUserCall.args, []);
  assert.equal(installUserCall.skipHotkey, undefined);
  assert.equal(installUserCall.skipHotkeyStart, "1");
  assert.equal(installUserCall.skipNpmLink, "1");
  assert.equal(installUserCall.selfUpdate, "1");
  const log = await fs.readFile(logPath, "utf8");
  assert.match(log, /update-check-start/);
  assert.match(log, /update-available from=aaaaaaaaaaaa to=bbbbbbbbbbbb/);
  assert.match(log, /update-applied from=aaaaaaaaaaaa to=bbbbbbbbbbbb/);
});

test("Windows appshot hotkey uninstall removes only the Startup launcher", async (t) => {
  const appData = await makeTempDir(t);
  const originalAppData = process.env.APPDATA;
  process.env.APPDATA = appData;
  t.after(() => {
    if (originalAppData == null) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = originalAppData;
    }
  });

  const shortcut = startupShortcutPath();
  await fs.mkdir(path.dirname(shortcut), { recursive: true });
  await fs.writeFile(shortcut, "@echo off\r\nrem old direct listener\r\n");

  const result = await uninstallHotkey({ platform: "win32" });

  assert.equal(result.startupPath, shortcut);
  await assert.rejects(fs.stat(shortcut), { code: "ENOENT" });
});

test("Windows hotkey helper defaults to Shift+Space when run directly", async () => {
  const script = await fs.readFile(
    path.join(repoRoot, "scripts", "windows-hotkey.ps1"),
    "utf8",
  );

  assert.match(script, /\[string\]\$Key = "shift\+space"/);
  assert.doesNotMatch(script, /\[string\]\$Key = "control\+space"/);
});

test("Windows hotkey helper exposes a stable log path and lifecycle markers", async () => {
  const script = await fs.readFile(
    path.join(repoRoot, "scripts", "windows-hotkey.ps1"),
    "utf8",
  );

  assert.match(script, /\[string\]\$LogPath/);
  assert.match(script, /\[string\]\$CommandBase64/);
  assert.match(script, /ConvertFrom-LazyCopyCommandBase64/);
  assert.match(script, /invalid-command-base64/);
  assert.match(script, /Get-LazyCopyTickMilliseconds/);
  assert.match(script, /Stopwatch\]::GetTimestamp/);
  assert.match(script, /\$now = Get-LazyCopyTickMilliseconds/);
  assert.doesNotMatch(script, /TickCount64/);
  assert.match(script, /LazyCopy\\appshot-hotkey\.log/);
  assert.match(script, /GetAsyncKeyState/);
  assert.match(script, /WH_KEYBOARD_LL/);
  assert.match(script, /SetWindowsHookEx/);
  assert.match(script, /PostThreadMessage/);
  assert.match(script, /WM_LAZYCOPY_SHIFT_SPACE/);
  assert.match(script, /WM_KEYUP/);
  assert.match(script, /WM_SYSKEYUP/);
  assert.match(script, /shiftSpaceArmed/);
  assert.match(script, /return \(IntPtr\)1;/);
  assert.match(script, /\$HotkeyCooldownMilliseconds = 250/);
  assert.match(script, /Test-LazyCopyShiftSpaceHookEnabled/);
  assert.match(script, /shift-space-hook-installed/);
  assert.match(script, /shift-space-hook-enabled/);
  assert.match(script, /hotkey-suppressed/);
  assert.match(script, /UninstallShiftSpaceHook/);
  for (const marker of [
    "start",
    "register-success",
    "listening-success",
    "register-failed",
    "hotkey-fired",
    'Invoke-LazyCopyHotkeyFire "registered"',
    'Invoke-LazyCopyHotkeyFire "keyboard-hook"',
    "command-launch",
    "command-launched",
    "command-launch-failed",
    "message-loop-ended",
    "listener-failed",
    "listener-stop",
  ]) {
    assert.match(script, new RegExp(marker));
  }
});

test("Windows startup launcher spawns the watcher without shell quoting", async () => {
  const launcher = await fs.readFile(
    path.join(repoRoot, "scripts", "start-windows-appshot-watch.js"),
    "utf8",
  );

  assert.match(launcher, /JSON\.parse\(Buffer\.from\(commandBase64, "base64"\)\.toString\("utf8"\)\)/);
  assert.match(launcher, /spawn\(command\[0\], command\.slice\(1\)/);
  assert.match(launcher, /shell:\s*false/);
  assert.match(launcher, /windowsHide:\s*true/);
  assert.match(launcher, /startup-launcher-spawned/);
  assert.match(launcher, /startup-launcher-failed/);
  assert.doesNotMatch(launcher, /Start-Process/);
});

test("Windows hotkey helper keeps listening when an appshot launch fails", async () => {
  const script = await fs.readFile(
    path.join(repoRoot, "scripts", "windows-hotkey.ps1"),
    "utf8",
  );

  assert.match(script, /function Start-LazyCopyHotkeyCommand/);
  assert.match(script, /Start-Process[\s\S]*-PassThru/);
  assert.match(script, /catch \{\s*Write-LazyCopyLog "command-launch-failed/);
  const messageLoopHotkeyBlock = script.slice(
    script.indexOf("if ($message.message -eq $WM_HOTKEY"),
    script.indexOf("[LazyCopyHotkey]::TranslateMessage"),
  );
  assert.match(messageLoopHotkeyBlock, /Invoke-LazyCopyHotkeyFire "registered"/);
  assert.match(messageLoopHotkeyBlock, /Invoke-LazyCopyHotkeyFire "keyboard-hook"/);
  assert.doesNotMatch(messageLoopHotkeyBlock, /Start-Process/);
});

test("Windows PowerShell timing avoids TickCount64 for Windows PowerShell compatibility", async () => {
  const scriptNames = [
    "windows-hotkey.ps1",
    "windows-appshot-watch.ps1",
    "windows-appshot-fast.ps1",
    "windows-paste-into-app.ps1",
  ];

  for (const scriptName of scriptNames) {
    const script = await fs.readFile(path.join(repoRoot, "scripts", scriptName), "utf8");
    assert.match(script, /Get-LazyCopyTickMilliseconds/);
    assert.match(script, /Stopwatch\]::GetTimestamp/);
    assert.doesNotMatch(script, /TickCount64/);
  }
});

test("lazycopy help exposes appshot, dd, Codex, Claude Code, and Shift+Space surfaces", async () => {
  const bin = path.join(repoRoot, "bin", "lazycopy.js");
  const help = spawnSync(process.execPath, [bin, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(help.status, 0);
  assert.equal(help.stdout.includes("appshot"), true);
  assert.match(help.stdout, /dd/);
  assert.match(help.stdout, /codex/);
  assert.match(help.stdout, /Claude Code/);
  assert.match(help.stdout, /shift\+space/);
  assert.match(help.stdout, /ㅇㅇ/);
  assert.equal(help.stdout.includes(["command", "shift", "l"].join("+")), false);
  assert.equal(help.stdout.includes("--desktop-current"), false);
});

test("launchAgentPlist escapes argument values", () => {
  const plist = launchAgentPlist(
    { repoRoot: () => "/tmp/LazyCopy" },
    { key: DEFAULT_HOTKEY, appName: "Codex & Friends" },
  );

  assert.match(plist, /Codex &amp; Friends/);
  assert.match(plist, /shift\+space/);
});

test("windows paste script does not restore or resize the target app window", async () => {
  const scripts = [
    await fs.readFile(
      path.join(repoRoot, "scripts", "windows-paste-into-app.ps1"),
      "utf8",
    ),
    await fs.readFile(
      path.join(repoRoot, "scripts", "windows-appshot-fast.ps1"),
      "utf8",
    ),
  ];

  const showWindowAsync = ["Show", "WindowAsync"].join("");
  const restoreOrResize = [
    ["SW", "RESTORE"].join("_"),
    ["Show", "Window\\("].join(""),
    ["Set", "WindowPos"].join(""),
    ["Move", "Window"].join(""),
    "Resize",
  ].join("|");

  for (const script of scripts) {
    assert.doesNotMatch(script, new RegExp(`${showWindowAsync}\\([^\\n]+,\\s*9\\)`));
    assert.doesNotMatch(script, new RegExp(restoreOrResize, "i"));
    assert.match(script, /AppActivate\(\$ProcessId\)/);
    assert.match(script, /Invoke-LazyCopyAppActivate -ProcessId \$process\.Id/);
    assert.match(script, /Set-LazyCopyForegroundWindow -Handle \$process\.MainWindowHandle/);
    assert.match(script, /refusing to paste into the current window/);
    const foregroundIndex = script.indexOf("Set-LazyCopyForegroundWindow -Handle $process.MainWindowHandle");
    const pasteIndex = script.indexOf('[System.Windows.Forms.SendKeys]::SendWait("^v")');
    assert.ok(foregroundIndex !== -1);
    assert.ok(pasteIndex !== -1);
    assert.ok(foregroundIndex < pasteIndex);
    assert.doesNotMatch(script, /Start-Sleep -Milliseconds 200/);
  }
});
