---
name: memo-agent-did-mainnet
description: Create, register, inspect, update, suspend, resume, revoke, pair, and manage an isolated MEMO Mainnet chain-985 AgentDID through the local mainnet Skill and ERC-4337 platform. Use for the new production stack only; do not use for the Anvil-31337 Skill, DataDID lookup, private-key export, or Gateway resource authorization.
metadata:
  short-description: Operate an isolated chain-985 AgentDID
---

# MEMO Mainnet Agent DID

Use the deterministic `bin/memo-agent-mainnet` CLI bundled in this Skill. It creates an offline installation identity first, then performs explicit chain-985 operations through the configured HTTPS platform. The local Identity Key signs only registered EIP-712 actions and fixed Agent-session challenges. Alto, EntryPoint v0.7, and the Relayer Smart Account are transport and Gas layers; they never replace Agent authorization.

## Execution host and installation scope

Default to running on the user's own computer, or on a long-lived host they explicitly selected. The model name, desktop chat client, installation directory, or a `/root` path does not establish where commands execute. Distinguish a local Claude Code session from a cloud session; never imply that code in a cloud container can access the user's computer's keyring.

Controlled servers and cloud hosts can use the existing storage providers when the administrator supplies persistent identity state, a stable installation ID and continued access to the same wrapping key. Temporary cloud environments are not the default place for long-lived identities. Do not automatically generate a fallback master key or a disposable identity. Handle an explicitly requested disposable test as a test, without describing it as durable identity storage.

## Working directory

Resolve commands relative to this Skill directory; never assume the backend monorepo is present. GitHub Skill installers copy files but may not install Node.js dependencies. After installing this Skill, run `node scripts/setup-runtime.mjs --json` from this directory to install its locked production dependencies and verify the runtime. This setup step does not create identity state or contact the platform. If `dist/` or `bin/memo-agent-mainnet` is missing, or setup fails, read [references/installation.zh-CN.md](references/installation.zh-CN.md), report the error and stop before creating identity state. The default state root is `~/.memo-agent-mainnet/agents/{installationId}` and is deliberately different from the old `~/.memo-agent` state.

For an installation-only request, finish after runtime setup and `doctor`; do not run `identity ensure` until identity creation is requested. If the user already requested both installation and identity creation, continue after the checks pass without asking for the same authorization again. Before ensuring identity on a multi-Agent host, use the host-provided stable `MEMO_AGENT_MAINNET_INSTALLATION_ID` and persistent `MEMO_AGENT_MAINNET_HOME` for this Agent. Do not reuse another Agent's configuration or invent a new ID on each start.

In a writable workspace sandbox, set `MEMO_AGENT_MAINNET_HOME` to a mainnet-only workspace directory. Never point it at an old Skill state directory. Identity is bound to the deployment environment: before creating an identity intended for preprod or production, fix that environment and its allowed HTTPS origin as described in [references/mainnet-operations.md](references/mainnet-operations.md). The API need not be online then; do not create under default `local` and imply that identity can later be reused across environments.

## Before acting

1. Run `bin/memo-agent-mainnet doctor --json`. Runtime setup's `ready` covers dependencies only. Check doctor's `data.ready`, `identityStorageReady`, `blockingChecks` and `guidance`; a successful command exit alone does not mean identity storage is ready. Doctor does not test platform connectivity or long-term state persistence.
2. When identity creation was requested and the checks pass, run `bin/memo-agent-mainnet identity ensure --json`, then `bin/memo-agent-mainnet identity status --json`. These are offline R1 steps, do not require a real platform API or R2/R4 grants, and must return the same DID and public key on every start. Storage failures require fixing storage, not configuring an API or granting chain permissions.
3. Explain any chain write and its risk before invoking it. Registration, updates, pairing, instance actions, and management approval are R2 and require an explicit trusted service grant.
4. Treat permanent revoke and successor declaration as R4. The packaged test grant works only against loopback chain-985 emulation; it is never valid in preprod or production.
5. Pass secrets through the OS keyring or trusted environment only. Never place a private key, wrapping key, session token, Pairing share handle, or binding code in argv, chat, source files, or logs.

The environment master key is wrapping input for the encrypted identity-key file, not the identity private key. The CLI does not prohibit registration based on this provider alone; suitability for long-lived use depends on administrator-managed protection and persistence. If an existing identity loses its wrapping key, preserve its provider and state rather than generating replacement material.

## Route the request

- Installation, Codex/Claude Code/DeepSeek host selection, or first-time setup: read [references/installation.zh-CN.md](references/installation.zh-CN.md).
- Beginner questions about local DID, registration, wallet pairing, or what can be shared: read [references/user-guide.zh-CN.md](references/user-guide.zh-CN.md).
- Identity setup, registration, status, resolution, lifecycle, or reorg reconciliation: read the Identity and chain-operation sections of [references/mainnet-operations.md](references/mainnet-operations.md).
- Instance creation/revocation or challenge signing: read the Instance section.
- Pairing, wallet-management requests, or Agent long-poll approval: read the Pairing and management section.
- Deployment mismatch, keyring failure, or recovery behavior: read the Security and recovery section and [references/troubleshooting.zh-CN.md](references/troubleshooting.zh-CN.md).

## Invariants

1. Reuse the existing chain-985 identity for this installation; never generate a replacement after a network or registration failure.
2. Never read, print, transmit, request, or export private keys or wrapping keys. `identity status` may return only the DID, public key, public address, opaque key handle, provider, and state.
3. Never sign arbitrary bytes or a caller-supplied digest. Reconstruct the complete EIP-712 domain, type, message, and digest locally.
4. Require chain ID `985`, the locked deployment environment, non-zero Registry addresses, and the exact configured platform origin.
5. Reject zero addresses, unknown signed fields, expired deadlines, wrong revisions, wrong nonces, wrong Registry domains, and a digest that differs from the locally reconstructed digest.
6. Use the Identity Key for Agent DID actions, Pairing, and management consent. Use Instance Keys only for routine Agent challenges.
7. A Pairing Grant only associates an Agent with a wallet tenant. It does not establish a Management Relationship and does not authorize Gateway resources.
8. Before approving management, show the manager address, action, scopes hash, term, visibility, revision, deadline, and any transfer participants.
9. If an operation is uncertain or reorged, reconcile the same operation and reuse the original action digest and signature. Do not create a second identity or payload.
10. Never copy state or keys from `memo-agent-did`, Anvil-31337, preprod, or another installation. Any chain, Registry, API origin, public-key, or environment mismatch moves state to `QUARANTINED`.
11. `identity ensure` never registers, pairs, creates an Owner/Manager relationship, publishes an attestation, or contacts the network.
12. DataDID is non-authoritative and Gateway authorization remains separate.
13. Installation and `setup-client` never call `identity ensure`, register on-chain, create a Pairing Grant, or enable R2/R4 policy grants.

## Output handling

Parse exactly one `memo.agent-cli-result/2` JSON envelope from stdout. Treat `ok: false` as failure and branch on `error.code`. Do not infer success from prose. Do not expose the local state path, encrypted key store, session bearer, or Pairing share handle in model-visible output; pass a share handle only through the trusted user interface that will redeem it.
