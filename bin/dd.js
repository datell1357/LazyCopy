#!/usr/bin/env node

const { runCli } = require("../src/cli");

const args = process.argv.slice(2);
const passThroughCommands = new Set(["appshot", "capture", "clipboard", "codex", "desktop", "hotkey"]);
const cliArgs = passThroughCommands.has(args[0]) ? args : ["dd", ...args];

runCli(cliArgs).then((exitCode) => {
  process.exitCode = exitCode;
});
