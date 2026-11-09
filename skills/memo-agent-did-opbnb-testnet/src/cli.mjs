import { Entry } from "@napi-rs/keyring";
import { Wallet, TypedDataEncoder, getAddress, computeAddress, keccak256, verifyMessage } from "ethers";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";

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
  UpdateProfile:[["identityAccount","address"],["profileHash","bytes32"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  UpdateDocument:[["identityAccount","address"],["documentHash","bytes32"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  SuspendAgent:[["identityAccount","address"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  ResumeAgent:[["identityAccount","address"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  RevokeAgent:[["identityAccount","address"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  RevokeInstanceCredential:[["identityAccount","address"],["credentialIdHash","bytes32"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  RenewRelationship:[["agent","address"],["manager","address"],["relationshipIdHash","bytes32"],["scopesHash","bytes32"],["expiresAt","uint64"],["discoverable","bool"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  EndRelationship:[["agent","address"],["manager","address"],["relationshipIdHash","bytes32"],["actor","address"],["reasonHash","bytes32"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
  TransferRelationship:[["agent","address"],["oldManager","address"],["newManager","address"],["oldRelationshipIdHash","bytes32"],["newRelationshipIdHash","bytes32"],["scopesHash","bytes32"],["expiresAt","uint64"],["discoverable","bool"],["expectedRevision","uint64"],["nonce","uint256"],["deadline","uint64"]],
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
async function api(path,body,token,idem){
  const response=await fetch(new URL(`/api/v1/${path}`,platform()),{method:body===undefined?"GET":"POST",redirect:"error",headers:{...(body===undefined?{}:{"content-type":"application/json"}),...(token?{authorization:`Bearer ${token}`}:{ }),...((idem||body?.intentId&&path.match(/^(agent-dids|registry-actions|management-actions)$/))?{"idempotency-key":idem||body.intentId}:{})},body:body===undefined?undefined:JSON.stringify(body)});
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
  if(!fields[action])throw Error("INTENT_ACTION_UNSUPPORTED");
  const key="identityAccount" in intent.message?"didRegistry":"managementRegistry";
  if(intent.domain.name!==(key==="didRegistry"?"MEMO Agent DID Registry":"MEMO Agent DID Management")||getAddress(intent.domain.verifyingContract)!==getAddress(config.contracts[key].address))throw Error("INTENT_DOMAIN_MISMATCH");
  if(JSON.stringify(intent.types)!==JSON.stringify({[action]:fields[action].map(([name,type])=>({name,type}))}))throw Error("INTENT_FIELDS_MISMATCH");
  if(Object.keys(intent.message).length!==fields[action].length||fields[action].some(([name])=>!Object.hasOwn(intent.message,name)))throw Error("INTENT_FIELDS_MISMATCH");
  const agent=key==="didRegistry"?intent.message.identityAccount:intent.message.agent;
  if(getAddress(agent)!==account||!intent.requiredSigners.some(x=>getAddress(x.address)===account))throw Error("INTENT_AGENT_MISMATCH");
  if(BigInt(intent.message.deadline)<BigInt(Math.floor(Date.now()/1000)))throw Error("INTENT_EXPIRED");
  if(TypedDataEncoder.hash(intent.domain,intent.types,intent.message)!==intent.digest)throw Error("INTENT_DIGEST_MISMATCH");
}
function inspectManagement(details,w,config){
  const intent=details.intent;
  verifyIntent(intent,intent.actionType,w.address,config);
  const scopes=details.display?.scopes;
  let scopesHash;
  if("scopesHash" in intent.message){
    if(!Array.isArray(scopes)||scopes.length<1||scopes.length>64||scopes.some(s=>typeof s!=="string"||!/^[A-Za-z0-9._:-]{1,128}$/.test(s)))throw Error("SCOPES_MISSING");
    scopesHash=`0x${createHash("sha256").update(JSON.stringify([...new Set(scopes)].sort())).digest("hex")}`;
    if(scopesHash!==intent.message.scopesHash)throw Error("SCOPES_HASH_MISMATCH");
    if(details.display?.discoverable!==intent.message.discoverable)throw Error("DISCOVERABILITY_MISMATCH");
  }
  return {intentId:intent.intentId,actionType:intent.actionType,digest:intent.digest,agent:intent.message.agent,manager:intent.message.manager??intent.message.oldManager,scopes:scopes??null,scopesHash:scopesHash??null,issuedAt:intent.message.issuedAt,expiresAt:intent.message.expiresAt,deadline:intent.message.deadline,discoverable:intent.message.discoverable,newManager:intent.message.newManager??null,reason:details.display?.reason??null};
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
function readJson(path){
  const target=resolve(path),stat=lstatSync(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)throw Error("INVALID_INPUT_FILE");
  return JSON.parse(readFileSync(target,"utf8"));
}
function writeJson(path,data){
  const target=resolve(path);mkdirSync(dirname(target),{recursive:true,mode:0o700});
  writeFileSync(target,JSON.stringify(data,null,2)+"\n",{mode:0o600,flag:"wx"});chmodSync(target,0o600);
  return target;
}
function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function shaJson(value){return `0x${createHash("sha256").update(canonical(value)).digest("hex")}`;}
function hashIdentifier(value){return keccak256(Buffer.from(value,"utf8"));}
function checkedPairing(value,kind,config){
  if(value?.schema!=="memo.agent-pairing-package/2"||value.kind!==kind||value.platformOrigin!==platform()||value.chainId!==5611||getAddress(value.didRegistry)!==getAddress(config.contracts.didRegistry.address)||getAddress(value.managementRegistry)!==getAddress(config.contracts.managementRegistry.address)||typeof value.handle!=="string"||value.handle.length<32||Date.parse(value.expiresAt)<Date.now())throw Error("PAIRING_PACKAGE_MISMATCH");
  return value;
}
async function registryAction(actionType,payload,w,did,config,token){
  const intent=await api("registry-action-intents",{actionType,...payload},token);
  verifyIntent(intent,actionType,w.address,config);
  if(payload.profile&&intent.message.profileHash!==shaJson(payload.profile))throw Error("PROFILE_HASH_MISMATCH");
  if(payload.document&&intent.message.documentHash!==shaJson(payload.document))throw Error("DOCUMENT_HASH_MISMATCH");
  if(payload.credentialId&&intent.message.credentialIdHash!==hashIdentifier(payload.credentialId))throw Error("CREDENTIAL_HASH_MISMATCH");
  const signature=await w.signTypedData(intent.domain,intent.types,intent.message);
  const op=await api("registry-actions",{intentId:intent.intentId,signature},token);
  return {did,actionType,actionDigest:intent.digest,...await poll(op.operationId,token)};
}
async function signChallenge(challenge){
  const names=["issuer","audience","action","nonce","issuedAt","expiresAt"];
  if(!challenge||typeof challenge!=="object"||Object.keys(challenge).sort().join(",")!==[...names].sort().join(",")||names.slice(0,4).some(k=>typeof challenge[k]!=="string"||!challenge[k])||!Number.isSafeInteger(challenge.issuedAt)||!Number.isSafeInteger(challenge.expiresAt)||challenge.expiresAt<=Date.now()||challenge.issuedAt>Date.now()+60000||challenge.expiresAt-challenge.issuedAt>900000)throw Error("INVALID_CHALLENGE");
  const {wallet:w,did}=wallet();await pinned();
  const instances=await api("agent-instances",undefined,await session(w));
  const active=instances.find(x=>x.state==="ACTIVE"&&Date.parse(x.expires_at)>Date.now());if(!active)throw Error("INSTANCE_NOT_FOUND");
  const keyEntry=new Entry("com.memo.agent-did.opbnb-testnet",`${installationId}:instance:${active.instance_id}`),secret=keyEntry.getSecret();if(!secret)throw Error("INSTANCE_KEY_UNAVAILABLE");
  const instance=new Wallet(`0x${Buffer.from(secret).toString("hex")}`);
  if(instance.address!==computeAddress(active.public_key))throw Error("INSTANCE_KEY_MISMATCH");
  const consumed=resolve(root,"consumed-challenges");mkdirSync(consumed,{recursive:true,mode:0o700});
  const nonceHash=createHash("sha256").update(`${challenge.issuer}:${challenge.nonce}`).digest("hex");
  try{writeFileSync(resolve(consumed,nonceHash),String(challenge.expiresAt),{mode:0o600,flag:"wx"});}catch(error){if(error.code==="EEXIST")throw Error("NONCE_REPLAYED");throw error;}
  const message=JSON.stringify([did,active.instance_id,...names.map(k=>challenge[k])]);
  return {schema:"memo.agent-auth-response/1",agentDid:did,instanceId:active.instance_id,publicKey:active.public_key,challenge,nonceHash,signature:await instance.signMessage(message),message};
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
    if(intent.message.profileHash!==shaJson(profile)||intent.message.documentHash!==shaJson(document))throw Error("DOCUMENT_HASH_MISMATCH");
    const signature=await w.signTypedData(intent.domain,intent.types,intent.message);
    const op=await api("agent-dids",{intentId:intent.intentId,signature},token);
    return {did,actionDigest:intent.digest,...await poll(op.operationId,token)};
  }
  if(group==="management"&&command==="pending"){
    const {wallet:w}=wallet();await pinned();return api("management-intents/pending",undefined,await session(w));
  }
  if(group==="management"&&command==="end"){
    const {wallet:w,did}=wallet(),config=await pinned(),token=await session(w);
    const intent=await api("management-action-intents",{actionType:"EndRelationship",agentDid:did,reason:rest[0]||"AGENT_ENDED"},token);
    verifyIntent(intent,"EndRelationship",w.address,config);
    if(intent.message.actor!==w.address||intent.message.reasonHash!==hashIdentifier(rest[0]||"AGENT_ENDED"))throw Error("END_ACTION_MISMATCH");
    const signature=await w.signTypedData(intent.domain,intent.types,intent.message);
    await api(`management-intents/${encodeURIComponent(intent.intentId)}/signatures`,{role:"actor",address:w.address,signature},token);
    const op=await api("management-actions",{intentId:intent.intentId},token);
    return {did,actionDigest:intent.digest,...await poll(op.operationId,token)};
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
  if(group==="identity"&&["update-profile","update-document","suspend","resume","revoke"].includes(command)){
    const {wallet:w,did}=wallet(),config=await pinned(),token=await session(w);
    const map={"update-profile":"UpdateProfile","update-document":"UpdateDocument",suspend:"SuspendAgent",resume:"ResumeAgent",revoke:"RevokeAgent"};
    const payload=command==="update-profile"?{profile:readJson(rest[0])}:command==="update-document"?{document:readJson(rest[0])}:{};
    return registryAction(map[command],payload,w,did,config,token);
  }
  if(group==="pair"&&command==="offer"&&rest[0]==="create"&&rest[1]){
    const {wallet:w,did}=wallet(),config=await pinned(),token=await session(w);
    const identity=await api(`agent-dids/${encodeURIComponent(did)}`);if(identity.status!=="ACTIVE")throw Error("IDENTITY_NOT_ACTIVE");
    const maxScopes=(rest[2]||"agent.read").split(",").map(s=>s.trim()).filter(Boolean),maxTermSeconds=Number(rest[3]||30)*86400,ttlSeconds=Number(rest[4]||900);
    const handle=randomBytes(32).toString("base64url"),handleHash=createHash("sha256").update(handle).digest("hex");
    const exchange=await api("pairing-offers",{handleHash,maxScopes,maxTermSeconds,ttlSeconds},token,`offer:${handleHash.slice(0,40)}`);
    const file={schema:"memo.agent-pairing-package/2",kind:"agent-offer",exchangeId:exchange.exchangeId,handle,platformOrigin:platform(),chainId,didRegistry:config.contracts.didRegistry.address,managementRegistry:config.contracts.managementRegistry.address,agentDid:did,maxScopes,maxTermSeconds,discoverable:false,expiresAt:exchange.expiresAt};
    const path=writeJson(rest[1],file);return {exchangeId:exchange.exchangeId,agentDid:did,offerFile:path,expiresAt:exchange.expiresAt};
  }
  if(group==="pair"&&command==="invitation"&&rest[0]==="accept"&&rest[1]&&rest[2]&&rest[3]){
    const {wallet:w,did}=wallet(),config=await pinned(),token=await session(w),file=checkedPairing(readJson(rest[1]),"platform-invitation",config);
    const inspected=await api("pairing-invitations/inspect",{exchangeId:file.exchangeId,handle:file.handle},token);
    if(JSON.stringify(inspected.maxScopes)!==JSON.stringify(file.maxScopes)||Number(inspected.maxTermSeconds)!==Number(file.maxTermSeconds)||Boolean(inspected.discoverable)!==Boolean(file.discoverable))throw Error("PAIRING_PACKAGE_MISMATCH");
    await api(`pairing-invitations/${encodeURIComponent(file.exchangeId)}/claim`,{handle:file.handle},token);
    let registered=false;
    try{const identity=await api(`agent-dids/${encodeURIComponent(did)}`);registered=identity.status==="ACTIVE";}catch(error){if(error.message!=="DID_NOT_FOUND")throw error;}
    if(!registered){const result=await run(["register",rest[2],rest[3]]);if(result.state!=="CONFIRMED")return {exchangeId:file.exchangeId,registration:result,state:"WAITING_REGISTRATION"};}
    return api(`pairing-invitations/${encodeURIComponent(file.exchangeId)}/complete`,{},token);
  }
  if(group==="pair"&&command==="status"&&rest[0]){const {wallet:w}=wallet();return api(`pairing-exchanges/${encodeURIComponent(rest[0])}`,undefined,await session(w));}
  if(group==="agent-request"&&["next","inspect","approve","reject"].includes(command)){
    const {wallet:w,did}=wallet(),config=await pinned(),token=await session(w);
    const response=await api("agent-requests/next",undefined,token),request=response.request;
    if(command==="next")return {request:request?{requestId:request.id,agentDid:request.agent_did,state:request.state}:null};
    if(!request||request.id!==rest[0])throw Error("AGENT_REQUEST_NOT_PENDING");
    const preview=inspectManagement({intent:request.intent,display:{scopes:request.scopes,discoverable:request.discoverable}},w,config);
    if(command==="inspect")return {requestId:request.id,did,...preview};
    if(command==="reject")return api(`agent-requests/${encodeURIComponent(request.id)}/decision`,{decision:"reject",reason:rest[1]||"declined"},token);
    const signature=await w.signTypedData(request.intent.domain,request.intent.types,request.intent.message);
    return api(`agent-requests/${encodeURIComponent(request.id)}/decision`,{decision:"approve",signature},token);
  }
  if(group==="instance"&&command==="create"&&rest[0]){
    const {wallet:w,did}=wallet();await pinned();const token=await session(w);
    const identity=await api(`agent-dids/${encodeURIComponent(did)}`);if(identity.status!=="ACTIVE")throw Error("IDENTITY_NOT_ACTIVE");
    const name=rest[0],days=Number(rest[1]||1);if(!/^[A-Za-z0-9._-]{1,64}$/.test(name)||!Number.isInteger(days)||days<1||days>30)throw Error("INVALID_INSTANCE_TERMS");
    const instanceId=`inst_${randomUUID()}`,instance=Wallet.createRandom(),keyEntry=new Entry("com.memo.agent-did.opbnb-testnet",`${installationId}:instance:${instanceId}`);
    keyEntry.setSecret(Buffer.from(instance.privateKey.slice(2),"hex"));
    const credential={schema:"memo.instance-credential/1",agentDid:did,instanceId,name,publicKey:instance.signingKey.publicKey,expiresAt:Date.now()+days*86400_000,identityRevision:Number(identity.revision)};
    const message=JSON.stringify([credential.schema,credential.agentDid,credential.instanceId,credential.name,credential.publicKey,credential.expiresAt,credential.identityRevision]);
    const published=await api("agent-instances",{...credential,signature:await w.signMessage(message)},token);
    return {instanceId,agentDid:did,name,publicKey:credential.publicKey,state:published.state,expiresAt:credential.expiresAt};
  }
  if(group==="instance"&&command==="list"){const {wallet:w}=wallet();await pinned();return api("agent-instances",undefined,await session(w));}
  if(group==="instance"&&command==="revoke"&&rest[0]){const {wallet:w,did}=wallet(),config=await pinned(),token=await session(w);return registryAction("RevokeInstanceCredential",{credentialId:rest[0]},w,did,config,token);}
  if(group==="auth"&&command==="sign"&&rest[0])return signChallenge(readJson(rest[0]));
  if(group==="identity"&&command==="self-test"){
    const now=Date.now(),proof=await signChallenge({issuer:"memo-agent-self-test",audience:"local",action:"identity.self-test",nonce:randomBytes(32).toString("hex"),issuedAt:now,expiresAt:now+60000});
    return {passed:verifyMessage(proof.message,proof.signature)===computeAddress(proof.publicKey),instanceId:proof.instanceId,nonceHash:proof.nonceHash};
  }
  if(group==="operation"&&command){const {wallet:w}=wallet();return api(`operations/${encodeURIComponent(command)}`,undefined,await session(w));}
  throw Error("USAGE: identity ensure|status|update-profile <file>|update-document <file>|suspend|resume|revoke|self-test; register <profile> <document>; pair offer create <file> [scopes] [maxDays] [ttlSeconds]; pair invitation accept <file> <profile> <document>; agent-request next|inspect|approve|reject <requestId>; instance create|list|revoke; auth sign <challenge.json>; management pending|inspect|approve|end; operation <id>");
}
try{const data=await run(process.argv.slice(2));process.stdout.write(JSON.stringify({schema:"memo.agent-opbnb-cli-result/1",ok:true,data})+"\n");}
catch(error){process.stdout.write(JSON.stringify({schema:"memo.agent-opbnb-cli-result/1",ok:false,error:{code:error.message||"OPERATION_FAILED"}})+"\n");process.exitCode=1;}
