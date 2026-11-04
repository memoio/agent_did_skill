#!/usr/bin/env node
import { accessSync, constants, existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

export function setupRuntime({ root = skillRoot, run = spawnSync } = {}) {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    fail("NODE_VERSION_UNSUPPORTED", "Node.js >=22.5.0 is required; Node.js 22.22+ is recommended.");
  }
  for (const file of ["package.json", "package-lock.json", "dist/index.js", "dist/cli.js", "bin/memo-agent-mainnet"]) {
    try { accessSync(resolve(root, file), constants.R_OK); } catch {
      fail("RUNTIME_PACKAGE_INCOMPLETE", `Missing or unreadable ${file}; reinstall the complete Skill from GitHub.`);
    }
  }
  const install = run(process.platform === "win32" ? "npm.cmd" : "npm", [
    "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps",
  ], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (install.error?.code === "ENOENT") fail("NPM_UNAVAILABLE", "npm is not available; install Node.js with npm first.");
  if (install.error || install.status !== 0) {
    fail("DEPENDENCY_INSTALL_FAILED", "Runtime dependency installation failed; check npm connectivity, registry access and package-lock.json, then rerun setup:runtime.");
  }
  const moduleUrl = pathToFileURL(resolve(root, "dist/index.js")).href;
  const imported = run(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(moduleUrl)})`], {
    cwd: root, encoding: "utf8",
  });
  if (imported.error || imported.status !== 0) {
    fail("RUNTIME_IMPORT_FAILED", "Runtime module import failed; check the Node.js version and native keyring package support for this operating system.");
  }
  return { schema: "memo.agent-runtime-setup/1", readyScope: "runtime-dependencies", ready: true, generatedIdentity: false };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== "--json")) fail("INVALID_ARGUMENT", "Only --json is supported.");
    process.stdout.write(JSON.stringify(setupRuntime()) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({
      schema: "memo.agent-runtime-setup/1", readyScope: "runtime-dependencies", ready: false, generatedIdentity: false,
      error: { code: error.code || "RUNTIME_SETUP_FAILED", message: error.message },
    }) + "\n");
    process.exitCode = 1;
  }
}
