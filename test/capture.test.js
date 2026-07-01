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
  assert.equal(await fs.readFile(payload.artifact.textPath, "utf8"), "clipboard text");
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
  assert.match(payload.plist, /control\+space/);
  assert.match(payload.plist, /appshot/);
  assert.match(payload.plist, /hotkey/);
  assert.match(payload.plist, /run/);
});

test("lazycopy help exposes appshot, dd, Codex, Claude Code, and Ctrl+Space surfaces", async () => {
  const bin = path.join(repoRoot, "bin", "lazycopy.js");
  const help = spawnSync(process.execPath, [bin, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(help.status, 0);
  assert.match(help.stdout, /appshot/);
  assert.match(help.stdout, /dd/);
  assert.match(help.stdout, /codex/);
  assert.match(help.stdout, /Claude Code/);
  assert.match(help.stdout, /control\+space/);
  assert.equal(help.stdout.includes(["command", "shift", "l"].join("+")), false);
  assert.equal(help.stdout.includes("--desktop-current"), false);
});

test("launchAgentPlist escapes argument values", () => {
  const plist = launchAgentPlist(
    { repoRoot: () => "/tmp/LazyCopy" },
    { key: DEFAULT_HOTKEY, appName: "Codex & Friends" },
  );

  assert.match(plist, /Codex &amp; Friends/);
  assert.match(plist, /control\+space/);
});
