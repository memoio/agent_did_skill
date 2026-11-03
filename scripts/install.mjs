#!/usr/bin/env node
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillName = "memo-agent-did-mainnet";
const source = resolve(bundleRoot, "skills", skillName);

main().catch((error) => {
  process.stderr.write(`安装失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  requireNode();
  const options = parseOptions(process.argv.slice(2));
  const target = normalizeTarget(String(options.target || ""));
  const destination = resolveDestination(target, options);
  validateDestination(destination);

  if (options["dry-run"]) {
    emit(options, { installed: false, dryRun: true, target, destination, generatedIdentity: false });
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  let backupPath;
  if (existsSync(destination)) {
    if (!options.upgrade) throw new Error(`目标已存在：${destination}。升级请增加 --upgrade；安装器不会静默覆盖。`);
    backupPath = `${destination}.backup-${safeTimestamp()}`;
    renameSync(destination, backupPath);
  }

  let copied = false;
  try {
    mkdirSync(destination);
    copied = true;
    cpSync(source, destination, {
      recursive: true,
      errorOnExist: true,
      filter: (path) => !["node_modules", ".data", ".git", ".DS_Store"].includes(basename(path)),
    });
    const install = spawnSync(process.execPath, [resolve(destination, "scripts", "setup-runtime.mjs"), "--json"], {
      cwd: destination,
      encoding: "utf8",
    });
    let runtime;
    try { runtime = JSON.parse(install.stdout); } catch { /* Report a bounded, non-secret error below. */ }
    if (install.error || install.status !== 0 || runtime?.ready !== true) {
      throw new Error(`${runtime?.error?.code || "RUNTIME_SETUP_FAILED"}: ${runtime?.error?.message || "Runtime setup failed; run scripts/setup-runtime.mjs to diagnose."}`);
    }
    chmodSync(resolve(destination, "bin", "memo-agent-mainnet"), 0o755);
    chmodSync(resolve(destination, "scripts", "setup-client.mjs"), 0o755);

    emit(options, {
      installed: true,
      target,
      destination,
      backupPath: backupPath || null,
      generatedIdentity: false,
      next: [
        `node "${resolve(destination, "scripts", "setup-client.mjs")}"`,
        `node "${resolve(destination, "bin", "memo-agent-mainnet")}" doctor --json`,
        `node "${resolve(destination, "bin", "memo-agent-mainnet")}" identity ensure --json`,
      ],
    });
  } catch (error) {
    if (copied && existsSync(destination)) rmSync(destination, { recursive: true, force: true });
    if (backupPath && existsSync(backupPath) && !existsSync(destination)) renameSync(backupPath, destination);
    throw error;
  }
}

function parseOptions(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw new Error(`未知参数：${arg}`);
    const key = arg.slice(2);
    if (["upgrade", "dry-run", "json"].includes(key)) {
      result[key] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`缺少参数值：${arg}`);
    result[key] = value;
    index += 1;
  }
  const allowed = new Set(["target", "project", "dest", "upgrade", "dry-run", "json"]);
  for (const key of Object.keys(result)) if (!allowed.has(key)) throw new Error(`未知参数：--${key}`);
  return result;
}

function normalizeTarget(value) {
  const aliases = {
    codex: "codex-user",
    claude: "claude-user",
    "project-codex": "codex-project",
    "project-claude": "claude-project",
  };
  const target = aliases[value] || value;
  if (!["codex-user", "claude-user", "codex-project", "claude-project", "runtime"].includes(target)) {
    throw new Error("请使用 --target codex-user|claude-user|codex-project|claude-project|runtime");
  }
  return target;
}

function resolveDestination(target, options) {
  if (target === "codex-user") return resolve(process.env.CODEX_HOME || resolve(homedir(), ".agents"), "skills", skillName);
  if (target === "claude-user") return resolve(homedir(), ".claude", "skills", skillName);
  if (target === "codex-project") return resolve(String(options.project || process.cwd()), ".agents", "skills", skillName);
  if (target === "claude-project") return resolve(String(options.project || process.cwd()), ".claude", "skills", skillName);
  if (!options.dest) throw new Error("runtime 目标必须提供 --dest <独立目录>");
  return resolve(String(options.dest));
}

function validateDestination(destination) {
  const forbidden = new Set([resolve("/"), resolve(homedir()), bundleRoot, source]);
  if (forbidden.has(destination) || destination === dirname(destination)) throw new Error("拒绝使用过宽或源目录作为安装目标");
  const fromSource = relative(source, destination);
  const toSource = relative(destination, source);
  const inside = (value) => value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !isAbsolute(value));
  if (inside(fromSource) || inside(toSource)) throw new Error("安装目标不能包含 Skill 源目录或位于源目录内");
}

function requireNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 5)) throw new Error(`需要 Node.js >=22.5.0，当前为 ${process.versions.node}`);
}

function emit(options, payload) {
  if (options.json) {
    process.stdout.write(JSON.stringify(payload) + "\n");
    return;
  }
  process.stdout.write(`${payload.dryRun ? "预计安装到" : "已安装到"}：${payload.destination}\n`);
  if (payload.backupPath) process.stdout.write(`旧版本备份：${payload.backupPath}\n`);
  process.stdout.write("安装过程没有创建 DID、密钥或链上交易。\n");
  for (const command of payload.next || []) process.stdout.write(`下一步：${command}\n`);
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}
