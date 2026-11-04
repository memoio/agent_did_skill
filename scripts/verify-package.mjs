#!/usr/bin/env node
import { accessSync, readFileSync, readdirSync, statSync } from "node:fs";
import { constants } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skill = resolve(root, "skills", "memo-agent-did-mainnet");
const required = [
  "SKILL.md", "package.json", "package-lock.json", "bin/memo-agent-mainnet",
  "dist/index.js", "dist/cli.js", "scripts/setup-runtime.mjs", "scripts/setup-client.mjs", "references/installation.zh-CN.md",
  "references/user-guide.zh-CN.md", "references/troubleshooting.zh-CN.md",
  "schemas/pairing-package.schema.json",
];
for (const path of required) accessSync(resolve(skill, path), constants.R_OK);

const manifest = JSON.parse(readFileSync(resolve(skill, "package.json"), "utf8"));
const skillManifest = JSON.parse(readFileSync(resolve(skill, "skill.json"), "utf8"));
if (manifest.version !== "2.0.0-preprod" || skillManifest.version !== manifest.version
  || skillManifest.pairingProtocolVersion !== "memo-agent-pairing/2") {
  throw new Error("PAIRING_V2_VERSION_MISMATCH");
}
for (const capability of ["pairing.invitation.accept", "pairing.offer.create", "pairing.status", "pairing.resume", "pairing.cancel"]) {
  if (!skillManifest.capabilities?.includes(capability)) throw new Error(`PAIRING_V2_CAPABILITY_MISSING:${capability}`);
}
if (skillManifest.capabilities?.includes("pairing.create")) throw new Error("PAIRING_V1_CAPABILITY_FORBIDDEN");
if (manifest.private === true) throw new Error("STANDALONE_PACKAGE_MUST_NOT_BE_PRIVATE");
if (manifest.dependencies?.ethers !== "6.17.0" || manifest.dependencies?.["@napi-rs/keyring"] !== "2.1.2") {
  throw new Error("RUNTIME_DEPENDENCIES_NOT_PINNED");
}
for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
  if (manifest.scripts?.[lifecycle]) throw new Error(`INSTALL_LIFECYCLE_SCRIPT_FORBIDDEN:${lifecycle}`);
}

const forbidden = ["agent-did-memo-mainnet/packages", "../packages/", "memo-agent-did/../"];
for (const path of walk(skill)) {
  if (![".js", ".ts", ".json", ".md", ""].includes(extname(path))) continue;
  const content = readFileSync(path, "utf8");
  for (const marker of forbidden) if (content.includes(marker)) throw new Error(`MONOREPO_REFERENCE:${path}:${marker}`);
}

await import(pathToFileURL(resolve(skill, "dist", "index.js")).href);
process.stdout.write(JSON.stringify({
  valid: true,
  standalone: true,
  skill,
  node: process.versions.node,
  runtimeDependenciesPinned: true,
  lifecycleKeyGeneration: false,
  monorepoReferences: 0,
}) + "\n");

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".data"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && statSync(path).size < 2_000_000) yield path;
  }
}
