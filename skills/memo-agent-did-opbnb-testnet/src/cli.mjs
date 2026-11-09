import { Entry } from "@napi-rs/keyring";
import { Wallet, TypedDataEncoder, getAddress, keccak256 } from "ethers";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";

const chainId=5611;
const genesis="0x51fa57729dfb1c27542c21b06cb72a0459c57440ceb43a465dae1307cd04fe80";
const root=resolve(process.env.MEMO_AGENT_OPBNB_HOME||resolve(homedir(),".memo-agent-opbnb-testnet"));
const mainnet=resolve(process.env.MEMO_AGENT_MAINNET_HOME||resolve(homedir(),".memo-agent-mainnet"));
if(root===mainnet||root.startsWith(`${mainnet}/`))throw Error("STATE_NAMESPACE_CONFLICT");
mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
const marker=resolve(root,"installation-id");
if(!existsSync(marker))writeFileSync(marker,randomUUID(),{mode:0o600,flag:"wx"});
const installationId=readFileSync(marker,"utf8").trim();
const entry=new Entry("com.memo.agent-did.opbnb-testnet",`${installationId}:identity:v1`);
const meta=resolve(root,"identity.json");
const fields={
  RegisterAgent:[["identityAccount","address"],["identityPublicKeyHash","bytes32"],["documentHash","bytes32"],["profileHash","bytes32"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  ActivateRelationship:[["agent","address"],["manager","address"],["relationshipIdHash","bytes32"],["scopesHash","bytes32"],["issuedAt","uint64"],["expiresAt","uint64"],["discoverable","bool"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
};
function wallet(create=false){
  let secret;
  try{secret=entry.getSecret();}catch{throw Error("OS_KEYRING_UNAVAILABLE");}
  if(!secret){if(!create)throw Error("IDENTITY_NOT_CREATED");const generated=Wallet.createRandom();entry.setSecret(Buffer.from(generated.privateKey.slice(2),"hex"));secret=entry.getSecret();if(!secret)throw Error("OS_KEYRING_UNAVAILABLE");}
  const w=new Wallet(`0x${Buffer.from(secret).toString("hex")}`);
  const did=`did:memo:agent:5611:${w.address.toLowerCase()}`;
  if(existsSync(meta)){
    const saved=JSON.parse(readFileSync(meta,"utf8"));
    if(saved.did!==did||saved.address!==w.address)throw Error("IDENTITY_QUARANTINED");
  }else writeFileSync(meta,JSON.stringify({schema:"memo.opbnb-agent-local/1",installationId,did,address:w.address,publicKey:w.signingKey.publicKey}),{mode:0o600,flag:"wx"});
  return {wallet:w,did};
}
function platform(){
  const input=process.env.MEMO_AGENT_OPBNB_API_URL;
  if(!input)throw Error("PLATFORM_ORIGIN_REQUIRED");
  const url=new URL(input);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["127.0.0.1","localhost"].includes(url.hostname))))throw Error("PLATFORM_ORIGIN_FORBIDDEN");
  return url.origin;
}
async function api(path,body,token){
  const response=await fetch(new URL(`/api/v1/${path}`,platform()),{method:body===undefined?"GET":"POST",redirect:"error",headers:{...(body===undefined?{}:{"content-type":"application/json"}),...(token?{authorization:`Bearer ${token}`}:{ }),...(body?.intentId&&path.match(/^(agent-dids|management-actions)$/)?{"idempotency-key":body.intentId}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const envelope=await response.json();
  if(!response.ok||!envelope.ok)throw Error(envelope.error?.code||`HTTP_${response.status}`);
  return envelope.data;
}
async function pinned(){
  const c=await api("chain/config");
  if(c.network.chainId!==chainId||c.network.caip2!=="eip155:5611"||c.network.genesisHash.toLowerCase()!==genesis)throw Error("NETWORK_MISMATCH");
  for(const [kind,key] of [["didRegistry","MEMO_AGENT_OPBNB_DID_REGISTRY"],["managementRegistry","MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY"]]){
    if(!process.env[key]||getAddress(c.contracts[kind].address)!==getAddress(process.env[key]))throw Error("REGISTRY_MISMATCH");
  }
  return c;
}
function verifyIntent(intent,action,account,config){
  if(intent.actionType!==action||intent.networkId!=="eip155:5611"||intent.domain.chainId!==chainId||intent.domain.version!=="1")throw Error("INTENT_NETWORK_MISMATCH");
  const key=action==="RegisterAgent"?"didRegistry":"managementRegistry";
  if(intent.domain.name!==(key==="didRegistry"?"MEMO Agent DID Registry":"MEMO Agent DID Management")||getAddress(intent.domain.verifyingContract)!==getAddress(config.contracts[key].address))throw Error("INTENT_DOMAIN_MISMATCH");
  if(JSON.stringify(intent.types)!==JSON.stringify({[action]:fields[action].map(([name,type])=>({name,type}))}))throw Error("INTENT_FIELDS_MISMATCH");
  if(Object.keys(intent.message).length!==fields[action].length||fields[action].some(([name])=>!Object.hasOwn(intent.message,name)))throw Error("INTENT_FIELDS_MISMATCH");
  const agent=action==="RegisterAgent"?intent.message.identityAccount:intent.message.agent;
  if(getAddress(agent)!==account||!intent.requiredSigners.some(x=>x.role==="agent"&&getAddress(x.address)===account))throw Error("INTENT_AGENT_MISMATCH");
  if(BigInt(intent.message.deadline)<BigInt(Math.floor(Date.now()/1000)))throw Error("INTENT_EXPIRED");
  if(TypedDataEncoder.hash(intent.domain,intent.types,intent.message)!==intent.digest)throw Error("INTENT_DIGEST_MISMATCH");
}
function inspectManagement(details,w,config){
  const intent=details.intent;
  verifyIntent(intent,"ActivateRelationship",w.address,config);
  const scopes=details.display?.scopes;
  if(!Array.isArray(scopes)||scopes.length<1||scopes.length>64||scopes.some(s=>typeof s!=="string"||!/^[A-Za-z0-9._:-]{1,128}$/.test(s)))throw Error("SCOPES_MISSING");
  const scopesHash=`0x${createHash("sha256").update(JSON.stringify([...new Set(scopes)].sort())).digest("hex")}`;
  if(scopesHash!==intent.message.scopesHash)throw Error("SCOPES_HASH_MISMATCH");
  if(details.display?.discoverable!==intent.message.discoverable)throw Error("DISCOVERABILITY_MISMATCH");
  return {intentId:intent.intentId,digest:intent.digest,agent:intent.message.agent,manager:intent.message.manager,scopes,scopesHash,issuedAt:intent.message.issuedAt,expiresAt:intent.message.expiresAt,deadline:intent.message.deadline,discoverable:intent.message.discoverable};
}
async function session(w){
  const ch=await api("agent-sessions/challenges",{address:w.address});
  const signature=await w.signMessage(ch.message);
  return (await api("agent-sessions",{challengeId:ch.challengeId,signature})).token;
}
async function poll(id,token){
  for(let i=0;i<120;i++){
    const op=await api(`operations/${encodeURIComponent(id)}`,undefined,token);
    if(["CONFIRMED","FAILED","REORGED"].includes(op.state))return op;
    await new Promise(r=>setTimeout(r,3000));
  }
  return {operationId:id,state:"PENDING"};
}
async function run(args){
  const [group,command,...rest]=args;
  if(group==="identity"&&command==="ensure"){
    const {wallet:w,did}=wallet(true);return {did,address:w.address,publicKey:w.signingKey.publicKey,localIdentityReady:true};
  }
  if(group==="identity"&&command==="status"){
    const {wallet:w,did}=wallet();return {did,address:w.address,publicKey:w.signingKey.publicKey};
  }
  if(group==="register"&&command&&rest[0]){
    const {wallet:w,did}=wallet();const config=await pinned();const token=await session(w);
    const profile=JSON.parse(readFileSync(resolve(command),"utf8"));
    const document=JSON.parse(readFileSync(resolve(rest[0]),"utf8"));
    const intent=await api("registration-intents",{identityAccount:w.address,identityPublicKey:w.signingKey.publicKey,profile,document},token);
    verifyIntent(intent,"RegisterAgent",w.address,config);
    const publicKeyHash=keccak256(`0x${w.signingKey.publicKey.slice(4)}`);
    if(intent.message.identityPublicKeyHash!==publicKeyHash)throw Error("PUBLIC_KEY_HASH_MISMATCH");
    const signature=await w.signTypedData(intent.domain,intent.types,intent.message);
    const op=await api("agent-dids",{intentId:intent.intentId,signature},token);
    return {did,actionDigest:intent.digest,...await poll(op.operationId,token)};
  }
  if(group==="management"&&command==="pending"){
    const {wallet:w}=wallet();await pinned();return api("management-intents/pending",undefined,await session(w));
  }
  if(group==="management"&&(command==="approve"||command==="inspect")&&rest[0]){
    const {wallet:w,did}=wallet();const config=await pinned();const token=await session(w);
    const details=await api(`management-intents/${encodeURIComponent(rest[0])}`,undefined,token);
    const intent=details.intent;
    const preview=inspectManagement(details,w,config);
    if(command==="inspect")return {did,...preview};
    const signature=await w.signTypedData(intent.domain,intent.types,intent.message);
    const result=await api(`management-intents/${encodeURIComponent(rest[0])}/signatures`,{role:"agent",address:w.address,signature},token);
    return {did,...preview,receivedRoles:result.receivedRoles};
  }
  if(group==="operation"&&command){const {wallet:w}=wallet();return api(`operations/${encodeURIComponent(command)}`,undefined,await session(w));}
  throw Error("USAGE: identity ensure|status; register profile.json document.json; management pending|inspect <intentId>|approve <intentId>; operation <id>");
}
try{const data=await run(process.argv.slice(2));process.stdout.write(JSON.stringify({schema:"memo.agent-opbnb-cli-result/1",ok:true,data})+"\n");}
catch(error){process.stdout.write(JSON.stringify({schema:"memo.agent-opbnb-cli-result/1",ok:false,error:{code:error.message||"OPERATION_FAILED"}})+"\n");process.exitCode=1;}
