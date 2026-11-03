import { loadConfig } from "./config.js";
import { AgentDidService } from "./service.js";
import { AgentError, asAgentError } from "./errors.js";
import { failure, success, type Envelope } from "./envelope.js";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const group = args[0] || "help";
const command = args[1] || "";
const action = command ? `${group}.${command}` : group;

function option(name: string, required = true): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index < 0) {
    if (required) throw new AgentError("INVALID_ARGUMENT", `Missing --${name}`);
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new AgentError("INVALID_ARGUMENT", `Missing value for --${name}`);
  return value;
}

function positional(index: number, name: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new AgentError("INVALID_ARGUMENT", `Missing ${name}`);
  return value;
}

function rejectSecretArguments(): void {
  for (const forbidden of ["--master-key", "--private-key", "--token", "--binding-code", "--passphrase"]) {
    if (args.includes(forbidden)) throw new AgentError("SECRET_IN_ARGUMENT", `${forbidden} is forbidden; use trusted environment or stdin input`);
  }
}

function exitCode(error: AgentError): number {
  if (error.code.startsWith("POLICY_")) return 3;
  if (error.code === "NONCE_REPLAYED") return 4;
  if (error.code.startsWith("INVALID_") || error.code === "UNSUPPORTED_SIGNED_FIELD" || error.code === "SECRET_IN_ARGUMENT") return 2;
  return 1;
}

async function run(): Promise<Envelope> {
  rejectSecretArguments();
  const service = new AgentDidService(loadConfig());
  try {
    if (group === "doctor") return success("doctor", service.doctor());
    if (group === "identity" && command === "ensure") return success(action, service.ensureIdentity());
    if (group === "identity" && command === "init") return success(action, await service.initialize(option("storage", false) || "auto"), null, ["identity init is deprecated; use identity ensure"]);
    if (group === "identity" && command === "key-migrate") {
      if (option("to") !== "os-keyring") throw new AgentError("INVALID_ARGUMENT", "Only --to os-keyring is supported");
      return success(action, service.migrateKeyToOsKeyring());
    }
    if (group === "identity" && command === "status") return success(action, service.status());
    if (group === "identity" && command === "register") {
      const result = await service.register(service.readJson(option("profile")!), args.includes("--dry-run"));
      return success(action, result.data, result.operationId);
    }
    if (group === "identity" && command === "resolve") return success(action, await service.resolve(positional(2, "DID"), args.includes("--verify")));
    if (group === "identity" && command === "update-profile") return success(action, await service.updateProfile(service.readJson(option("profile")!)));
    if (group === "identity" && command === "update-document") return success(action, await service.updateDocument(service.readJson(option("document")!)));
    if (group === "identity" && ["suspend", "resume", "revoke"].includes(command)) return success(action, await service.changeIdentityState(command as "suspend" | "resume" | "revoke"));
    if (group === "identity" && command === "successor") return success(action, await service.declareSuccessor(option("did")!));
    if (group === "identity" && command === "self-test") return success(action, await service.selfTest());
    if (group === "instance" && command === "create") return success(action, await service.createInstance(option("name")!, option("ttl")!));
    if (group === "instance" && command === "reconcile-default") return success(action, await service.reconcileDefaultInstance());
    if (group === "instance" && command === "list") return success(action, service.listInstances());
    if (group === "instance" && command === "revoke") return success(action, await service.revokeInstance(positional(2, "instance ID"), option("reason")!));
    if (group === "auth" && command === "sign") return success(action, await service.signChallenge(service.readJson(option("challenge-file")!)));
    if (group === "pair" && command === "create") {
      const shareHandleFile = resolve(option("share-handle-file")!);
      if (!existsSync(dirname(shareHandleFile))) throw new AgentError("INVALID_ARGUMENT", "Pairing share-handle directory does not exist");
      if (existsSync(shareHandleFile)) throw new AgentError("INVALID_ARGUMENT", "Pairing share-handle file already exists");
      const result = await service.createPairing(option("max-scopes")!, option("max-term")!, option("ttl")!);
      const shareHandle = String(result.shareHandle || "");
      if (!shareHandle) throw new AgentError("PAIRING_GRANT_INVALID", "Platform did not return a Pairing share handle");
      writeFileSync(shareHandleFile, `${shareHandle}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
      chmodSync(shareHandleFile, 0o600);
      const { shareHandle: _redacted, ...publicResult } = result;
      return success(action, { ...publicResult, shareHandleStored: true });
    }
    if (group === "pair" && command === "status") return success(action, service.pairingStatus(positional(2, "Pairing Grant ID")));
    if (group === "pair" && command === "cancel") return success(action, await service.cancelPairing(positional(2, "Pairing Grant ID")));
    if (group === "agent-request" && command === "next") return success(action, await service.nextAgentRequest(Number(option("wait-seconds", false) || "20")));
    if (group === "agent-request" && command === "approve") return success(action, await service.decideAgentRequest(option("id")!, "approve"));
    if (group === "agent-request" && command === "reject") return success(action, await service.decideAgentRequest(option("id")!, "reject", option("reason", false) || "declined"));
    if (group === "management" && command === "inspect") return success(action, service.inspectManagement(service.readJson(option("request-file")!)));
    if (group === "management" && command === "accept") return success(action, await service.acceptManagement(option("request-id")!));
    if (group === "management" && command === "accept-chain") return success(action, await service.acceptChainManagement(service.readJson(option("input-file")!)));
    if (group === "management" && ["renew", "end", "transfer"].includes(command)) return success(action, await service.acceptChainManagement(service.readJson(option("input-file")!)));
    if (group === "management" && command === "reject") return success(action, service.rejectManagement(option("request-id")!, option("reason")!));
    if (group === "operation" && command === "status") return success(action, service.operation(positional(2, "operation ID")));
    if (group === "operation" && command === "reconcile") return success(action, await service.reconcileOperation(positional(2, "operation ID")));
    throw new AgentError("INVALID_ARGUMENT", `Unsupported command: ${args.filter((arg) => arg !== "--json").join(" ") || "(empty)"}`);
  } finally {
    service.close();
  }
}

try {
  const result = await run();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const normalized = asAgentError(error);
  process.stdout.write(`${JSON.stringify(failure(action, normalized))}\n`);
  process.exitCode = exitCode(normalized);
}
