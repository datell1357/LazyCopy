const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createCaptureArtifact } = require("../src/capture");
const { runCli } = require("../src/cli");

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
  assert.equal(manifest.privacy.potentiallySecretBearing, true);
  assert.equal(manifest.privacy.rawWindowTitleStored, false);
  assert.equal(Object.hasOwn(manifest.privacy, "rawWindowTitle"), false);
});

test("createCaptureArtifact rejects invalid capture modes", async (t) => {
  const { fixture } = await writeFixture(t);
  const outputRoot = await makeTempDir(t);

  await assert.rejects(
    createCaptureArtifact({
      fixtureImage: fixture,
      mode: "window-list",
      outputRoot,
    }),
    /Invalid mode/,
  );
});

test("runCli returns a JSON error without a fixture", async (t) => {
  const outputRoot = await makeTempDir(t);
  const writes = [];

  const exitCode = await runCli(
    ["capture", "--json", "--output-root", outputRoot],
    {
      platform: "darwin",
      stdout: { write: (text) => writes.push(text) },
      stderr: { write: () => {} },
    },
  );

  assert.equal(exitCode, 1);
  const payload = JSON.parse(writes.join(""));
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "CAPTURE_FIXTURE_REQUIRED");
});

test("lazycopy help is standalone and rejects obsolete flags", async (t) => {
  const { fixture } = await writeFixture(t);
  const outputRoot = await makeTempDir(t);
  const bin = path.join(repoRoot, "bin", "lazycopy.js");

  const help = spawnSync(process.execPath, [bin, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const rejected = spawnSync(
    process.execPath,
    [
      bin,
      "capture",
      "--json",
      "--desktop-current",
      "--fixture-image",
      fixture,
      "--output-root",
      outputRoot,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.equal(help.status, 0);
  assert.equal(help.stdout.includes("--desktop-current"), false);
  assert.equal(rejected.status, 1);
  const payload = JSON.parse(rejected.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNKNOWN_OPTION");
});
