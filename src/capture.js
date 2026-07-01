const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { LazyCopyError } = require("./errors");
const { parsePngDimensions } = require("./png");

const VALID_MODES = new Set(["active-window", "region", "fullscreen"]);
const DEFAULT_OUTPUT_ROOT = path.join(os.homedir(), ".lazycopy", "captures");

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
  const source = details.source ?? {
    type: "fixture-image",
    fixtureImage: details.fixtureImage,
    nativeCapture: false,
  };

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
    source,
    privacy: {
      potentiallySecretBearing: true,
      rawWindowTitleStored: false,
    },
  };
}

async function createCaptureArtifact(options) {
  const mode = options.mode ?? "active-window";
  assertMode(mode);

  const sourceImage = options.sourceImage ?? options.fixtureImage;
  if (!sourceImage) {
    throw new LazyCopyError(
      "CAPTURE_FIXTURE_REQUIRED",
      "Missing a PNG source image. Pass --fixture-image or use a capture command.",
    );
  }

  const now = options.now ?? new Date();
  const id = options.id ?? createId();
  const platform = options.platform ?? os.platform();
  const sourceImagePath = path.resolve(sourceImage);
  const fixtureImage = options.fixtureImage
    ? path.resolve(options.fixtureImage)
    : undefined;
  const outputRoot = path.resolve(options.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const artifactDir = path.join(outputRoot, dateDirectoryName(now), id);
  const imagePath = path.join(artifactDir, "capture.png");
  const manifestPath = path.join(artifactDir, "manifest.json");
  const image = await fs.readFile(sourceImagePath);
  const dimensions = parsePngDimensions(image);
  const imageSha256 = crypto.createHash("sha256").update(image).digest("hex");

  await fs.mkdir(artifactDir, { recursive: true });
  await copyFileAtomic(sourceImagePath, imagePath);
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
    source: options.source,
  });
  await writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    artifactDir,
    imagePath,
    manifestPath,
  };
}

async function createTextArtifact(options) {
  const text = options.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new LazyCopyError("EMPTY_CLIPBOARD_TEXT", "Clipboard text is empty.");
  }

  const now = options.now ?? new Date();
  const id = options.id ?? createId();
  const platform = options.platform ?? os.platform();
  const outputRoot = path.resolve(options.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const artifactDir = path.join(outputRoot, dateDirectoryName(now), id);
  const textPath = path.join(artifactDir, "clipboard.txt");
  const manifestPath = path.join(artifactDir, "manifest.json");
  const textBytes = Buffer.byteLength(text, "utf8");
  const textSha256 = crypto.createHash("sha256").update(text).digest("hex");
  await fs.mkdir(artifactDir, { recursive: true });
  await writeFileAtomic(textPath, text);
  await writeFileAtomic(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: "lazycopy-clipboard",
        id,
        createdAt: now.toISOString(),
        platform,
        textPath: "clipboard.txt",
        textSha256,
        textBytes,
        textPreview: "<clipboard-text:redacted>",
        codexAttach: {
          method: "prompt-text",
          path: textPath,
        },
        source: options.source ?? {
          type: "clipboard-text",
        },
        privacy: {
          potentiallySecretBearing: true,
        },
      },
      null,
      2,
    )}\n`,
  );

  return {
    artifactDir,
    manifestPath,
    textPath,
  };
}

module.exports = {
  createCaptureArtifact,
  createTextArtifact,
  DEFAULT_OUTPUT_ROOT,
  VALID_MODES,
};
