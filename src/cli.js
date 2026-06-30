const { createCaptureArtifact } = require("./capture");
const { LazyCopyError } = require("./errors");

const usage = `Usage:
  lazycopy capture --json --fixture-image <png> --output-root <dir> [--mode active-window|region|fullscreen]

Commands:
  capture   Create a local capture artifact from a PNG fixture.

Options:
  --json                 Print machine-readable JSON.
  --fixture-image <png>  PNG file to copy into the artifact.
  --output-root <dir>    Directory where artifacts are written.
  --mode <mode>          active-window, region, or fullscreen.
  -h, --help             Show this help.
`;

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new LazyCopyError("MISSING_FLAG_VALUE", `Missing value for ${flag}.`);
  }
  return value;
}

function parseCaptureArgs(args) {
  const options = {
    json: false,
    mode: "active-window",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--fixture-image":
        options.fixtureImage = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--output-root":
        options.outputRoot = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--mode":
        options.mode = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new LazyCopyError("UNKNOWN_OPTION", `Unknown option ${arg}.`);
        }
        throw new LazyCopyError(
          "UNEXPECTED_ARGUMENT",
          `Unexpected argument ${arg}.`,
        );
    }
  }

  return options;
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    return { command: "help" };
  }
  if (argv[0] !== "capture") {
    throw new LazyCopyError("UNKNOWN_COMMAND", `Unknown command ${argv[0]}.`);
  }

  return {
    command: "capture",
    options: parseCaptureArgs(argv.slice(1)),
  };
}

function writeJson(stream, payload) {
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function normalizeError(error) {
  if (error instanceof LazyCopyError) {
    return error;
  }
  return new LazyCopyError("INTERNAL_ERROR", error.message || String(error));
}

async function runCli(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const wantsJson = argv.includes("--json");

  try {
    const parsed = parseArgs(argv);
    if (parsed.command === "help" || parsed.options.help) {
      stdout.write(usage);
      return 0;
    }

    const result = await createCaptureArtifact({
      fixtureImage: parsed.options.fixtureImage,
      mode: parsed.options.mode,
      outputRoot: parsed.options.outputRoot,
      platform: io.platform,
    });

    if (parsed.options.json) {
      writeJson(stdout, { ok: true, ...result });
    } else {
      stdout.write(`Created capture artifact: ${result.artifactDir}\n`);
    }
    return 0;
  } catch (error) {
    const normalized = normalizeError(error);
    if (wantsJson) {
      writeJson(stdout, {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      });
    } else {
      stderr.write(`lazycopy: ${normalized.message}\n`);
    }
    return 1;
  }
}

module.exports = {
  parseArgs,
  runCli,
  usage,
};
