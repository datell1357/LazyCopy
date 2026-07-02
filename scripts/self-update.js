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

function findPathCommand(command, env) {
  const pathValue = env.PATH || env.Path || "";
  for (const entry of pathValue.split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, command);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveCommand(command, env) {
  if (process.platform === "win32") {
    if (path.extname(command)) {
      return command;
    }
    const commandShim = findPathCommand(`${command}.cmd`, env);
    if (commandShim) {
      return commandShim;
    }
    if (command === "npm") {
      return "npm.cmd";
    }
  }
  return command;
}

function quoteCmdArg(value) {
  const text = String(value);
  if (text.length === 0) {
    return "\"\"";
  }
  return `"${text.replace(/([()%!^"<>&|])/g, "^$1")}"`;
}

function commandScriptInvocation(command, args) {
  return [
    "cmd.exe",
    ["/d", "/s", "/c", ["call", quoteCmdArg(command), ...args.map(quoteCmdArg)].join(" ")],
  ];
}

function run(command, args, options = {}) {
  const env = options.env ?? process.env;
  const resolvedCommand = resolveCommand(command, env);
  const commandScript = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(resolvedCommand);
  const [spawnCommand, spawnArgs] = commandScript
    ? commandScriptInvocation(resolvedCommand, args)
    : [resolvedCommand, args];
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    env,
    shell: false,
    windowsVerbatimArguments: commandScript,
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
