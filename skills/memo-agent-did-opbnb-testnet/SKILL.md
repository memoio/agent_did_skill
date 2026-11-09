---
name: memo-agent-did-opbnb-testnet
description: Create a separate opBNB Testnet chain-5611 Agent DID, register it through the local platform API, and approve a user's management relationship. Use only for the opBNB test stack, never for MEMO Mainnet chain 985.
metadata:
  short-description: Operate an isolated opBNB test Agent DID
---

# opBNB Testnet Agent DID

Run `node bin/memo-agent-opbnb-testnet <command>` from this Skill directory. First install locked dependencies with `npm ci --omit=dev`. The default state directory is `~/.memo-agent-opbnb-testnet`; it must never point at the mainnet Skill state. The OS keyring stores the identity key; CLI output contains only public identity and operation evidence.

Before any chain action, set `MEMO_AGENT_OPBNB_API_URL` to the trusted platform origin and pin `MEMO_AGENT_OPBNB_DID_REGISTRY` and `MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY` from an independently verified deployment manifest. Only chain 5611 and its fixed genesis hash are accepted. `identity ensure` is offline and never registers. `register <profile.json> <document.json>` signs a locally verified EIP-712 registration intent, then polls the operation. `management pending` lists intents for this Agent. Run `management inspect <intentId>` and show the user the manager address, plain scopes, expiry, discoverability and digest. Once the user has requested approval of that intent, run `management approve <intentId>` to sign exactly one locally verified ActivateRelationship intent.

Do not pass private keys, bearer tokens or Pairing handles as command arguments or print them. Registration and management approval create real testnet transactions through the platform, so perform them only when the user has requested those actions. On uncertain submission, poll the same operation; do not create a replacement identity or signature. This Skill is separate from `memo-agent-did-mainnet` and cannot access or migrate its state.
