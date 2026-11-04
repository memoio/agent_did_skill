# MEMO Mainnet Agent DID 新手使用手册

## 先记住三件事

1. Agent DID 由本地 Identity Key 的公开地址派生：`did:memo:agent:985:0x...`。
2. 私钥加密保存在实际执行主机上，不能导出、不能发给平台、不能粘贴到 Agent 对话；平台只收到签名。
3. 本地 DID、平台配对和链上管理关系是三件不同的事，不会因为安装 Skill 自动发生。

默认执行主机是你的电脑或你明确指定的长期主机。聊天客户端、模型名称、安装目录都不能单独证明执行发生在本机：Claude 本地会话与云端会话使用各自的运行环境。受控云端需由管理员提供稳定 installation ID、持久化身份目录及持续可取得的同一包装密钥；临时云环境缺少这些条件时，应先在本机或已准备好的长期主机检查。只有用户明确要求时才处理临时测试身份，不自行生成备用主密钥。

## 一张流程图看懂全过程

```text
安装 Skill
   │  初始化依赖可能访问 npm，不生成身份、不联系平台
   ▼
doctor
   │  检查当前身份存储；不验证平台在线或长期持久性
   ▼
identity ensure（用户已请求创建身份且前置检查通过）
   │  实际执行主机生成并加密 Identity Key；离线，不需要 R2/R4
   ▼
LOCAL_IDENTITY_READY
   │  用户明确同意注册；Agent 签 EIP-712
   ▼
平台 Relayer → ERC-4337 UserOperation → MEMO chain 985
   ▼
ACTIVE（公开可解析的 Agent DID）
   │
   ├─ Invitation / Offer → Console 关联钱包租户（不上链、不是管理权）
   │
   └─ 钱包签管理请求 + Agent 本地签同意
          ▼
      Management Registry 上链确认
      （钱包成为 Agent 的 Primary Manager）
```

## 1. 查看本地 DID 状态

把 `<Skill目录>` 替换成安装器输出的真实目录：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

首次 ensure 后常见结果含义：

```json
{
  "state": "LOCAL_IDENTITY_READY",
  "registered": false,
  "agentDid": "did:memo:agent:985:0x...",
  "identityAccount": "0x...",
  "publicKey": "0x...",
  "identityKeyHandle": "identity_my-agent-01_v1",
  "keyProvider": "os-keyring"
}
```

- `LOCAL_IDENTITY_READY`：本地身份已经准备好，但链上还没有注册，其他人不能通过链上 Resolver 公开解析。
- `REGISTRATION_SUBMITTED`：注册已提交，等待打包和最终确认。
- `ACTIVE`：链上注册已确认，可以公开解析。
- `SUSPENDED`：临时暂停。
- `REVOKED`：永久吊销，不能恢复。
- `QUARANTINED`：链、合约、环境、API origin 或密钥不一致；停止签名并人工排查。

CLI 外层固定返回 `memo.agent-cli-result/2` envelope。先看顶层 `ok`；为 `false` 时按 `error.code` 处理。

安装和检查请求应先执行 `doctor --json`，默认到此结束。依赖初始化的 `ready` 仅描述 `readyScope: "runtime-dependencies"`；仓库安装结果 `runtimeDependenciesReady: true`、`identityStorageChecked: false` 也不表示身份存储已经通过。`doctor` 顶层 `ok: true` 不等于 `data.ready: true`：应检查 `identityStorageReady`、`blockingChecks` 和 `guidance`。`platformConnectivityChecked: false` 表示没有联系平台，地址检查通过也不代表 API 可达。

用户已明确请求创建身份、前置检查通过时，可以执行 `identity ensure --json` 并查看公开状态，无需重复确认同一授权。离线创建不需要真实 API 在线或开启 R2/R4。系统密钥库不可用时，检查服务、解锁或访问权限；已有身份丢失保护材料时恢复原材料，不更换包装密钥或重新生成身份。

`env-master-key` 是管理员可显式配置的既有方案：环境变量是包装／解密输入，身份私钥仍加密落盘。它不是明文身份私钥，代码也不因该 provider 单独禁止注册。长期使用需管理好原保护材料和持久化；`doctor` 不验证这些长期条件，也不会自动生成主密钥。

## 2. “把 DID 的密钥给出来”应该怎么做

只给公开材料，不给私钥：

- 可以分享：`agentDid`、`identityAccount`、`publicKey`、链上 Resolver 结果。
- 一般不必分享：`identityKeyHandle`，它只是本机不透明引用，不是私钥。
- 绝对不能分享：`keys.enc.json`、OS Keyring 内容、wrapping key、`MEMO_AGENT_MAINNET_MASTER_KEY`、任何明文私钥。

本 Skill 故意没有 `private-key export` 命令。平台需要证明 DID 属于这个 Agent 时，应下发固定格式 challenge 或 EIP-712 intent，Agent 在本机签名，平台恢复签名地址；整个过程不传私钥。

如果有人要求你把私钥、master key 或 `keys.enc.json` 发给他，请立即停止操作。

## 3. 把本地 DID 注册到平台

### 第一步：确认平台信息

这一步属于后续注册。离线身份创建可先完成存储检查，不要求平台可达；但身份绑定部署环境，默认 `local` 身份不能直接跨环境复用。计划用于 preprod/production 时，应在创建前按 [安装手册](installation.zh-CN.md) 确定相应环境及合法 HTTPS origin，保持同一 installation ID 和状态根。

向平台管理员确认：

- 环境是 `preprod` 还是 `production`；
- API 与 Console 的真实 HTTPS 地址；
- chain ID 是 `985`；
- 本次注册已获允许。

先检查：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" doctor --json
node "<Skill目录>/bin/memo-agent-mainnet" identity ensure --json
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

### 第二步：检查公开 Profile

发行包带有安全示例：`<Skill目录>/examples/profile.json`。Profile 是公开内容，不要放 API token、密码、DataDID、Manager DID、邮箱私密信息或恢复材料。

先做不会联网和上链的 dry-run：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" identity register \
  --profile "<Skill目录>/examples/profile.json" \
  --dry-run \
  --json
```

### 第三步：明确授权注册

注册属于 R2 操作。macOS/Linux 用单次环境授权：

```sh
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" identity register \
  --profile "<Skill目录>/examples/profile.json" \
  --json
```

Windows PowerShell：

```powershell
$env:MEMO_AGENT_MAINNET_ALLOW_R2 = "1"
node "<Skill目录>\bin\memo-agent-mainnet" identity register --profile "<Skill目录>\examples\profile.json" --json
Remove-Item Env:MEMO_AGENT_MAINNET_ALLOW_R2
```

Skill 会依次完成：获取平台 chain config、在本地重建 digest、用 Identity Key 签名、提交给 Relayer、等待 UserOperation 被打包并达到 finality。Gas 由平台 Relayer Smart Account 支付，Agent 不向平台交私钥。

注册失败时保留原 DID 和原 Identity Key。不要再次生成身份。网络恢复后重试或按 operation ID reconcile。

注册成功后再次查看：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

应看到 `state: ACTIVE`、`registered: true`、`identityRevision` 大于 0，以及锁定的 Registry 地址。

## 4. 绑定 Console 钱包

钱包地址不会写进 Agent DID 字符串。完整绑定有两层：

- Pairing：把 Agent 关联到某个 Console 钱包租户，方便发现和发起请求；不上链，不等于管理权。
- Management Relationship：钱包与 Agent 都签署管理 intent，确认后写入 Management Registry，才形成链上 Primary Manager 关系。

### 第一步：二选一完成 Pairing

先创建只允许当前用户读取的目录：

```sh
mkdir -p "$HOME/.memo-agent-mainnet/share"
chmod 700 "$HOME/.memo-agent-mainnet/share"
```

方式 A（平台发起）：在 Console 生成并下载 Platform Invitation 文件，然后把文件路径交给本地 Agent 执行：

```sh
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" pair invitation accept \
  --invitation-file "$HOME/.memo-agent-mainnet/share/platform-invitation.memo-pair.json" \
  --profile "<Skill目录>/examples/profile.json" \
  --json
```

方式 B（Agent 发起）：让 Agent 自动注册（如尚未注册）并生成 15 分钟有效的 Offer 文件，再在 Console 上传：

```sh
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" pair offer create \
  --offer-file "$HOME/.memo-agent-mainnet/share/agent-offer.memo-pair.json" \
  --max-scopes profile.update,instance.issue \
  --max-term 30d \
  --ttl 15m \
  --profile "<Skill目录>/examples/profile.json" \
  --json
```

`--profile` 可以省略：Skill 会依次使用显式 Profile、上次成功保存的快照、最小“未命名 Agent”Profile。两种命令都会使用同一 Identity Key 自动完成必要的 DID 注册并等待 finality；不会生成第二个 DID。

- Invitation/Offer 文件包含一次性 handle，只能交给可信平台或 Skill 命令，不能打印内容；
- 不要把文件内容发到聊天、邮件、Issue 或日志，也不要提交 Git；
- Offer 使用独占新建和 `0600` 权限；Invitation 必须是当前用户拥有的普通文件，符号链接会被拒绝；
- CLI JSON 只显示 exchange ID、状态、DID、operation 和确认信息，不回显 handle；
- 可用 `pair status <exchange-id>`、`pair resume <exchange-id>`、`pair cancel <exchange-id>` 查询、续跑或取消。

旧 `pair create` 已停用并返回 `PAIRING_V1_REMOVED`。Pairing 完成后平台会自动创建管理草稿，但钱包尚未获得链上管理权。

### 第二步：钱包签署管理请求

在 Console 中：

1. 连接预期的钱包；
2. 确认钱包网络为 MEMO Mainnet `985`；
3. 选择管理 scopes、期限和 visibility；
4. 钱包签署 Management EIP-712 intent；
5. 等待本地 Agent 审核。

钱包签名本身不等于绑定完成。

### 第三步：Agent 本地审核并签名

先查看下一条请求：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" agent-request next --wait-seconds 20 --json
```

核对返回的：

- `managerAccount`；
- `actionType`；
- `scopesHash`；
- `termEndsAt`；
- `discoverable`；
- `expectedRevision`；
- 到期时间。

确定无误后才批准：

```sh
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" agent-request approve \
  --id req_替换为真实请求ID \
  --json
```

不同意则拒绝：

```sh
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" agent-request reject \
  --id req_替换为真实请求ID \
  --reason declined \
  --json
```

批准后，平台把 Agent 和钱包的签名包装成 ERC-4337 UserOperation。只有目标合约事件被索引并达到 finality，关系才算链上生效。

## 5. 哪些操作会上链

| 操作 | 是否上链 | 说明 |
|---|---:|---|
| 安装、配置、`doctor` | 否 | 不生成身份 |
| `identity ensure/status` | 否 | 本地创建/查看身份 |
| Agent session challenge | 否 | 平台短期认证 |
| Agent DID 注册 | 是 | DID Registry |
| Profile/Document 更新、暂停、恢复、吊销 | 是 | DID Registry |
| Instance Credential 签发 | 否 | Agent 本地签发 |
| Instance Credential 撤销 | 是 | 只上链撤销 hash |
| Invitation/Offer Pairing | 否 | 平台一次性关联并创建管理草稿 |
| 管理关系激活、续期、结束、转让 | 是 | Management Registry |
| DataDID/Gateway 权限 | 不属于本流程 | 与 Agent DID 管理权隔离 |

## 6. 常用命令

```sh
# 公开解析（注册确认后）
node "<Skill目录>/bin/memo-agent-mainnet" identity resolve did:memo:agent:985:0x... --verify --json

# 更新公开 Profile
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" identity update-profile --profile profile.json --json

# 暂停与恢复
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" identity suspend --json
MEMO_AGENT_MAINNET_ALLOW_R2=1 node "<Skill目录>/bin/memo-agent-mainnet" identity resume --json

# 查看本地实例
node "<Skill目录>/bin/memo-agent-mainnet" instance list --json

# 查询或恢复一笔操作
node "<Skill目录>/bin/memo-agent-mainnet" operation status op_... --json
node "<Skill目录>/bin/memo-agent-mainnet" operation reconcile op_... --json
```

永久吊销和 successor 是 R4 高风险操作，生产版必须接入独立审批服务；不要用普通 R2 授权尝试执行。

## 7. 给主流 Agent 的推荐提示词

Codex：

```text
$memo-agent-did-mainnet 在我的本机或已明确指定的长期主机上完成依赖初始化并运行 doctor，报告身份存储检查结果和阻塞项。安装阶段不创建身份，不自行生成备用主密钥。
```

Claude Code：

```text
/memo-agent-did-mainnet 在我的本机或已明确指定的长期主机上完成依赖初始化并运行 doctor，报告身份存储检查结果和阻塞项。安装阶段不创建身份，不自行生成备用主密钥。
```

DeepSeek-in-Codex：使用与 Codex 相同的 `$memo-agent-did-mainnet` 提示词。纯网页/API 模式不能安全执行本地身份流程。

确实需要创建身份时可以另行说；也可以在原安装请求中同时明确创建意图，检查通过后不必再确认同一授权：

```text
在我已选定的主机、部署环境和 installation 配置下，运行 doctor；前置检查通过后执行 identity ensure，并只显示 DID、公开地址、状态和是否已注册。不注册上链，不创建配对，不显示秘密；缺少原保护材料时停止，不生成替代密钥。
```

需要绑定时再单独说：

```text
使用 $memo-agent-did-mainnet 检查我的 Agent 状态，先说明 Pairing 与链上 Management 的区别。若我提供 Platform Invitation 文件，确认后用 pair invitation accept；若由 Agent 发起，展示 max scopes、期限和 Offer 输出路径，确认后用 pair offer create。不得读取或显示文件里的 handle。
```

遇到错误请不要删除状态或重新 ensure 新身份，按 [故障排查](troubleshooting.zh-CN.md) 处理。
