#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function writeLog(logPath, message) {
  if (!logPath) {
    return;
  }
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\r\n`, "utf8");
}

function main() {
  const [, , commandBase64, logPath] = process.argv;
  if (!commandBase64) {
    writeLog(logPath, "startup-launcher-failed missing-command");
    process.exit(1);
  }

  let command;
  try {
    command = JSON.parse(Buffer.from(commandBase64, "base64").toString("utf8"));
  } catch (error) {
    writeLog(logPath, `startup-launcher-failed invalid-command message=${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(command) || command.length === 0 || typeof command[0] !== "string") {
    writeLog(logPath, "startup-launcher-failed invalid-command-shape");
    process.exit(1);
  }

  try {
    const child = spawn(command[0], command.slice(1), {
      detached: true,
      stdio: "ignore",
      shell: false,
      windowsHide: true,
    });
    child.unref();
    writeLog(logPath, `startup-launcher-spawned pid=${child.pid}`);
  } catch (error) {
    writeLog(logPath, `startup-launcher-failed spawn message=${error.message}`);
    process.exit(1);
  }
}

main();
