#!/usr/bin/env node
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const candidate = message.split(":", 1)[0];
  const code = /^[A-Z][A-Z0-9_]*$/.test(candidate) ? candidate : "SETUP_FAILED";
  process.stdout.write(JSON.stringify({ configured: false, generatedIdentity: false, error: { code, message } }) + "\n");
  process.exitCode = 1;
});

async function main() {
const options = parseOptions(process.argv.slice(2));
const stateRoot = resolve(String(options["state-root"] || process.env.MEMO_AGENT_MAINNET_HOME || resolve(homedir(), ".memo-agent-mainnet")));
const configPath = resolve(String(options.config || process.env.MEMO_AGENT_MAINNET_CONFIG_FILE || resolve(stateRoot, "client.json")));
const current = readExisting(configPath);
const interactive = process.stdin.isTTY && process.stdout.isTTY && !options["non-interactive"];
const prompt = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;

try {
  const environment = choice(
    "environment",
    options.environment || current.environment,
    interactive ? await prompt.question("部署环境 local/preprod/production [local]: ") : undefined,
    "local",
    ["local", "preprod", "production"],
  );
  const defaultApi = environment === "local" ? "http://127.0.0.1:4273" : "";
  const apiUrl = String(options["api-url"] || current.apiUrl || (interactive ? await prompt.question(`平台 API 地址${defaultApi ? ` [${defaultApi}]` : ""}: `) : "") || defaultApi);
  const parsedApi = validateApi(apiUrl, environment);
  const installationInput = String(options["installation-id"] || current.installationId || (interactive ? await prompt.question("Agent installation ID（留空则首次运行自动生成）: ") : "")).trim();
  const installationId = installationInput ? validateInstallationId(installationInput) : undefined;
  const keyProvider = choice(
    "key-provider",
    options["key-provider"] || current.keyProvider,
    interactive ? await prompt.question("密钥保护方式 auto/os-keyring [auto]: ") : undefined,
    "auto",
    ["auto", "os-keyring"],
  );

  const config = {
    environment,
    apiUrl: parsedApi.toString(),
    apiOrigins: environment === "local" ? [] : [parsedApi.origin],
    ...(installationId ? { installationId } : {}),
    keyProvider,
    chainId: 985,
    stateRoot,
  };

  if (existsSync(configPath) && !options.update) {
    throw new Error(`CONFIG_EXISTS: ${configPath}；如需更新请增加 --update`);
  }
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  chmodSync(dirname(configPath), 0o700);
  let backupPath;
  if (existsSync(configPath)) {
    backupPath = `${configPath}.backup-${safeTimestamp()}`;
    copyFileSync(configPath, backupPath);
    chmodSync(backupPath, 0o600);
  }
  const temporary = `${configPath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  chmodSync(temporary, 0o600);
  renameSync(temporary, configPath);
  chmodSync(configPath, 0o600);
  process.stdout.write(JSON.stringify({
    configured: true,
    environment,
    apiOrigin: parsedApi.origin,
    chainId: 985,
    installationId: installationId || "auto-persisted-on-first-run",
    keyProvider,
    configPath,
    backupPath: backupPath || null,
    generatedIdentity: false,
    next: "Run bin/memo-agent-mainnet doctor --json, then identity ensure --json",
  }) + "\n");
} finally {
  prompt?.close();
}
}

function parseOptions(args) {
  const result = {};
  const forbidden = new Set(["--master-key", "--private-key", "--token", "--passphrase", "--binding-code"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (forbidden.has(arg)) throw new Error(`${arg} is forbidden; never pass secrets in argv`);
    if (!arg.startsWith("--")) throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
    const key = arg.slice(2);
    if (["update", "non-interactive"].includes(key)) {
      result[key] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`MISSING_ARGUMENT_VALUE:${arg}`);
    result[key] = value;
    index += 1;
  }
  const allowed = new Set(["environment", "api-url", "installation-id", "key-provider", "state-root", "config", "update", "non-interactive"]);
  for (const key of Object.keys(result)) if (!allowed.has(key)) throw new Error(`UNKNOWN_ARGUMENT:--${key}`);
  return result;
}

function readExisting(path) {
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CLIENT_CONFIG_INVALID");
  return parsed;
}

function choice(name, configured, answer, fallback, allowed) {
  const value = String(configured || answer || fallback).trim();
  if (!allowed.includes(value)) throw new Error(`INVALID_${name.toUpperCase().replaceAll("-", "_")}`);
  return value;
}

function validateApi(value, environment) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("INVALID_API_URL"); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("API_URL_MUST_NOT_CONTAIN_CREDENTIALS_QUERY_OR_FRAGMENT");
  if (environment === "local") {
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("LOCAL_API_MUST_BE_LOOPBACK_HTTP");
  } else if (parsed.protocol !== "https:") {
    throw new Error("PREPROD_AND_PRODUCTION_API_REQUIRE_HTTPS");
  }
  return parsed;
}

function validateInstallationId(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) || value === "." || value === ".." || basename(value) !== value) {
    throw new Error("INVALID_INSTALLATION_ID");
  }
  return value;
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}
