#!/usr/bin/env node
import { accessSync, constants, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bundle = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skillName = "memo-agent-did-opbnb-testnet";
const skill = resolve(bundle, "skills", skillName);
const entries = readdirSync(resolve(bundle, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
if (entries.length !== 1 || entries[0] !== skillName) throw new Error("UNEXPECTED_SKILL_DIRECTORY");
for (const path of ["SKILL.md", "agents/openai.yaml", "package.json", "package-lock.json", "bin/memo-agent-opbnb-testnet", "src/cli.mjs", "src/pairing.mjs"]) {
  accessSync(resolve(skill, path), constants.R_OK);
}
const manifest = JSON.parse(readFileSync(resolve(skill, "package.json"), "utf8"));
const root = JSON.parse(readFileSync(resolve(bundle, "package.json"), "utf8"));
const plugin = JSON.parse(readFileSync(resolve(bundle, "plugin.json"), "utf8"));
const codexPlugin = JSON.parse(readFileSync(resolve(bundle, ".codex-plugin/plugin.json"), "utf8"));
if (manifest.version !== root.version || plugin.version !== manifest.version || codexPlugin.version !== manifest.version) throw new Error("VERSION_MISMATCH");
if (plugin.name !== skillName || codexPlugin.name !== skillName || !plugin.extensions?.["com.openai"]?.onboardingSkill?.endsWith(`${skillName}/SKILL.md`)) throw new Error("PLUGIN_ENTRY_MISMATCH");
if (manifest.dependencies?.ethers !== "6.17.0" || manifest.dependencies?.["@napi-rs/keyring"] !== "2.1.2") throw new Error("RUNTIME_DEPENDENCIES_NOT_PINNED");
for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
  if (manifest.scripts?.[lifecycle]) throw new Error(`INSTALL_LIFECYCLE_SCRIPT_FORBIDDEN:${lifecycle}`);
}
process.stdout.write(JSON.stringify({ valid: true, skill: skillName, chainId: 5611, runtimeDependenciesPinned: true }) + "\n");
