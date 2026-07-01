#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--repo-root") {
      options.repoRoot = value;
      index += 1;
    } else if (arg === "--log-path") {
      options.logPath = value;
      index += 1;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument ${arg}.`);
    }
  }
  return options;
}

function defaultLogPath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "LazyCopy", "appshot-hotkey.log");
}

function writeLog(logPath, message) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
}

function resolveCommand(command) {
  if (process.platform === "win32" && command === "npm") {
    return "npm.cmd";
  }
  return command;
}

function run(command, args, options = {}) {
  const result = spawnSync(resolveCommand(command), args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    shell: false,
    windowsHide: true,
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status ?? 1,
    error: result.error,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function requireOk(result, label) {
  if (result.ok) return result;
  const detail = result.error ? `${result.error.code || "ERROR"} ${result.error.message}` : `exit ${result.status}`;
  throw new Error(`${label} failed (${detail})`);
}

function gitOutput(repoRoot, args, label) {
  return requireOk(run("git", args, { cwd: repoRoot }), label).stdout.trim();
}

function shortSha(value) {
  return value.slice(0, 12);
}

function installUpdatedSurface(repoRoot) {
  requireOk(
    run(process.execPath, [path.join(repoRoot, "scripts", "install-user.js")], {
      cwd: repoRoot,
      env: {
        ...process.env,
        LAZYCOPY_INSTALL_SKIP_HOTKEY_START: "1",
        LAZYCOPY_INSTALL_SKIP_NPM_LINK: "1",
        LAZYCOPY_SELF_UPDATE: "1",
      },
    }),
    "node scripts/install-user.js",
  );
}

function runSelfUpdate(options) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, ".."));
  const logPath = options.logPath || defaultLogPath();

  writeLog(logPath, `update-check-start repo=${repoRoot}`);

  const gitDir = path.join(repoRoot, ".git");
  if (!fs.existsSync(gitDir)) {
    writeLog(logPath, "update-skipped reason=no-git");
    return 0;
  }

  const inside = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repoRoot });
  if (!inside.ok || inside.stdout.trim() !== "true") {
    writeLog(logPath, "update-skipped reason=not-git-worktree");
    return 0;
  }

  const upstreamResult = run(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    { cwd: repoRoot },
  );
  if (!upstreamResult.ok || upstreamResult.stdout.trim().length === 0) {
    writeLog(logPath, "update-skipped reason=no-upstream");
    return 0;
  }

  const upstream = upstreamResult.stdout.trim();
  const before = gitOutput(repoRoot, ["rev-parse", "HEAD"], "git rev-parse HEAD");
  requireOk(run("git", ["fetch", "--quiet"], { cwd: repoRoot }), "git fetch");
  const remote = gitOutput(repoRoot, ["rev-parse", "@{u}"], "git rev-parse upstream");

  if (before === remote) {
    writeLog(logPath, `update-current commit=${shortSha(before)} upstream=${upstream}`);
    return 0;
  }

  writeLog(logPath, `update-available from=${shortSha(before)} to=${shortSha(remote)} upstream=${upstream}`);
  requireOk(run("git", ["merge", "--ff-only", "--quiet", "@{u}"], { cwd: repoRoot }), "git merge --ff-only");
  const after = gitOutput(repoRoot, ["rev-parse", "HEAD"], "git rev-parse updated HEAD");
  installUpdatedSurface(repoRoot);
  writeLog(logPath, `update-applied from=${shortSha(before)} to=${shortSha(after)} upstream=${upstream}`);
  return 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/self-update.js --repo-root <dir> [--log-path <file>]\n");
    return 0;
  }
  try {
    return runSelfUpdate(options);
  } catch (error) {
    const logPath = options.logPath || defaultLogPath();
    writeLog(logPath, `update-failed message=${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { runSelfUpdate };
