import { createHash } from "node:crypto";
import { getAddress } from "ethers";

const scopePattern=/^[-A-Za-z0-9._:]{1,128}$/;
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`:value&&typeof value==="object"?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`:JSON.stringify(value);

export function expectedInvitationSetup(file){
  return {
    schema:"memo.agent-setup/1",
    skill:{name:"memo-agent-did-opbnb-testnet",repository:"https://github.com/memoio/agent_did_skill.git",ref:"main",directory:"skills/memo-agent-did-opbnb-testnet"},
    environment:{MEMO_AGENT_OPBNB_API_URL:file.platformOrigin,MEMO_AGENT_OPBNB_DID_REGISTRY:file.didRegistry,MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY:file.managementRegistry},
    commands:[
      "git clone --branch main --single-branch https://github.com/memoio/agent_did_skill.git",
      "cd agent_did_skill/skills/memo-agent-did-opbnb-testnet && npm ci --omit=dev",
      "node bin/memo-agent-opbnb-testnet agent init",
      "node bin/memo-agent-opbnb-testnet --agent <returned-agent-id> pair invitation accept <invitation.json>",
      "node bin/memo-agent-opbnb-testnet --agent <returned-agent-id> register --profile <reviewed-profile.json>",
      "node bin/memo-agent-opbnb-testnet --agent <returned-agent-id> pair invitation accept <invitation.json>",
      "node bin/memo-agent-opbnb-testnet --agent <returned-agent-id> binding pending",
      "node bin/memo-agent-opbnb-testnet --agent <returned-agent-id> binding inspect <requestId>",
      "node bin/memo-agent-opbnb-testnet --agent <returned-agent-id> binding approve <requestId>",
    ],
    sequence:["核对仓库来源与部署清单，安装 Skill 并核对公开平台配置。","Skill 自动生成唯一 Agent ID 和本地身份；Agent 保存返回的 ID，领取邀请后检查 Profile，再单独注册并完成配对。","钱包用户在 Console 签署管理草稿后，Agent 核对条款并批准请求。","等待 operation CONFIRMED，再查询链上管理关系。"],
    localOnly:new URL(file.platformOrigin).hostname==="127.0.0.1"||new URL(file.platformOrigin).hostname==="localhost",
  };
}

export function offerOptions(args){
  const [filename,rawScopes,rawDays,rawTtl,...extra]=args;
  if(!filename||!rawScopes||!/^[1-9][0-9]*$/.test(rawDays||"")||!/^[1-9][0-9]*$/.test(rawTtl||"")||extra.length)throw Error("USAGE: pair offer create <new-file> <scopes-csv> <max-days> <ttl-seconds>");
  const maxScopes=[...new Set(rawScopes.split(",").map(value=>value.trim()))].sort();
  const days=Number(rawDays),ttlSeconds=Number(rawTtl);
  if(!maxScopes.length||maxScopes.length>64||maxScopes.some(value=>!scopePattern.test(value))||!Number.isSafeInteger(days)||days>365||!Number.isSafeInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>86400)throw Error("INVALID_OFFER_TERMS");
  return {filename,maxScopes,maxTermSeconds:days*86400,ttlSeconds,discoverable:false};
}

export function verifyPairingFile(file,kind,origin,config,allowExpired=false){
  if(!file||file.schema!=="memo.agent-pairing-package/2"||file.kind!==kind||file.platformOrigin!==origin||file.chainId!==5611||typeof file.exchangeId!=="string"||!/^0x[0-9a-fA-F]{40}$/.test(file.didRegistry||"")||!/^0x[0-9a-fA-F]{40}$/.test(file.managementRegistry||"")||getAddress(file.didRegistry)!==getAddress(config.contracts.didRegistry.address)||getAddress(file.managementRegistry)!==getAddress(config.contracts.managementRegistry.address)||typeof file.handle!=="string"||file.handle.length<32||file.handle.length>256||!Number.isFinite(Date.parse(file.expiresAt))||(!allowExpired&&Date.parse(file.expiresAt)<=Date.now()))throw Error("PAIRING_FILE_MISMATCH");
  if(!Array.isArray(file.maxScopes)||!file.maxScopes.length||file.maxScopes.length>64||file.maxScopes.some(value=>typeof value!=="string"||!scopePattern.test(value))||!Number.isSafeInteger(file.maxTermSeconds)||file.maxTermSeconds<60||file.maxTermSeconds>365*86400||file.discoverable!==false)throw Error("PAIRING_TERMS_INVALID");
  if(kind==="agent-offer"&&typeof file.agentDid!=="string")throw Error("PAIRING_FILE_MISMATCH");
  if(kind==="platform-invitation"&&file.agentSetup!==undefined&&canonical(file.agentSetup)!==canonical(expectedInvitationSetup(file)))throw Error("UNTRUSTED_AGENT_SETUP");
  return file;
}

export function verifyPairingRecord(file,record,allowedStates=["OPEN"]){
  const fileScopes=[...new Set(file.maxScopes)].sort();
  const recordScopes=Array.isArray(record?.maxScopes)?[...new Set(record.maxScopes)].sort():[];
  if(record.exchangeId!==file.exchangeId||record.kind!==file.kind||!allowedStates.includes(record.state)||JSON.stringify(fileScopes)!==JSON.stringify(recordScopes)||Number(record.maxTermSeconds)!==file.maxTermSeconds||record.discoverable!==file.discoverable||Date.parse(record.expiresAt)!==Date.parse(file.expiresAt)||(file.kind==="agent-offer"&&record.agentDid!==file.agentDid))throw Error("PAIRING_RECORD_MISMATCH");
  return record;
}

export function handleHash(handle){return createHash("sha256").update(handle).digest("hex");}
