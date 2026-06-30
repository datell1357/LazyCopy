const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { LazyCopyError } = require("./errors");
const { parsePngDimensions } = require("./png");

const VALID_MODES = new Set(["active-window", "region", "fullscreen"]);

function assertMode(mode) {
  if (!VALID_MODES.has(mode)) {
    throw new LazyCopyError(
      "INVALID_MODE",
      `Invalid mode "${mode}". Expected active-window, region, or fullscreen.`,
    );
  }
}

function dateDirectoryName(now) {
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function createId() {
  return crypto.randomUUID();
}

function temporaryPath(targetPath) {
  return `${targetPath}.tmp-${process.pid}-${crypto.randomUUID()}`;
}

async function writeFileAtomic(targetPath, data) {
  const tmpPath = temporaryPath(targetPath);
  await fs.writeFile(tmpPath, data);
  await fs.rename(tmpPath, targetPath);
}

async function copyFileAtomic(sourcePath, targetPath) {
  const tmpPath = temporaryPath(targetPath);
  await fs.copyFile(sourcePath, tmpPath);
  await fs.rename(tmpPath, targetPath);
}

function createManifest(details) {
  return {
    schemaVersion: 1,
    kind: "lazycopy-capture",
    id: details.id,
    createdAt: details.createdAt,
    mode: details.mode,
    platform: details.platform,
    imagePath: "capture.png",
    imageSha256: details.imageSha256,
    imageBytes: details.imageBytes,
    dimensions: details.dimensions,
    codexAttach: {
      method: "local-image-path",
      path: details.imagePath,
    },
    source: {
      type: "fixture-image",
      fixtureImage: details.fixtureImage,
      nativeCapture: false,
    },
    privacy: {
      potentiallySecretBearing: true,
      rawWindowTitleStored: false,
    },
  };
}

async function createCaptureArtifact(options) {
  const mode = options.mode ?? "active-window";
  assertMode(mode);

  if (!options.fixtureImage) {
    throw new LazyCopyError(
      "CAPTURE_FIXTURE_REQUIRED",
      "Native capture is not implemented in this standalone skill; pass --fixture-image.",
    );
  }
  if (!options.outputRoot) {
    throw new LazyCopyError("MISSING_OUTPUT_ROOT", "Missing --output-root.");
  }

  const now = options.now ?? new Date();
  const id = options.id ?? createId();
  const platform = options.platform ?? os.platform();
  const fixtureImage = path.resolve(options.fixtureImage);
  const outputRoot = path.resolve(options.outputRoot);
  const artifactDir = path.join(outputRoot, dateDirectoryName(now), id);
  const imagePath = path.join(artifactDir, "capture.png");
  const manifestPath = path.join(artifactDir, "manifest.json");
  const image = await fs.readFile(fixtureImage);
  const dimensions = parsePngDimensions(image);
  const imageSha256 = crypto.createHash("sha256").update(image).digest("hex");

  await fs.mkdir(artifactDir, { recursive: true });
  await copyFileAtomic(fixtureImage, imagePath);
  const manifest = createManifest({
    createdAt: now.toISOString(),
    dimensions,
    fixtureImage,
    id,
    imageBytes: image.byteLength,
    imagePath,
    imageSha256,
    mode,
    platform,
  });
  await writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    artifactDir,
    imagePath,
    manifestPath,
  };
}

module.exports = {
  createCaptureArtifact,
  VALID_MODES,
};
