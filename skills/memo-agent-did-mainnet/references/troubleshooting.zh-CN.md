# MEMO Mainnet Agent DID Skill 故障排查

先遵守最高优先级规则：不要删除 `~/.memo-agent-mainnet`，不要清空系统密钥库，不要复制旧 Skill 状态，不要为了“重试”生成第二个 DID。

## 通用检查顺序

```sh
node --version
node "<Skill目录>/bin/memo-agent-mainnet" doctor --json
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

每条命令只读取一行 JSON。顶层 `ok: false` 时记录 `error.code`；不要把包含 Pairing handle、session token 或本地文件内容的日志发给别人。

`doctor` 顶层 `ok: true` 和退出码 0 只表示检查执行成功。创建身份前还需查看 `data.ready`、`identityStorageReady`、`blockingChecks` 和 `guidance`。仅当用户请求创建身份且检查通过后执行 `identity ensure`；安装或诊断本身不创建身份，已经明确的创建请求无需再次确认。

`doctor` 会初始化安装标记和状态数据库，不创建身份密钥。`platformConnectivityChecked: false` 表示未连接平台；`networkEgress` 只检查 URL 策略。存储就绪不代表已经验证长期持久化、备份或注册状态。

## 安装成功，但身份存储未就绪

`setup-runtime` 的 `readyScope: "runtime-dependencies"` 只覆盖依赖导入。仓库安装器的 `runtimeDependenciesReady: true` 与 `identityStorageChecked: false` 表示还需执行 `doctor`。原生模块能导入，不表示当前会话能访问系统密钥库。

默认使用用户本机或用户已指定的长期主机。Claude Code 本地会话与云端会话的执行位置不同；桌面聊天客户端、模型名或安装目录不能证明能访问用户电脑的密钥库。云环境需要管理员提供持久化身份状态、稳定 installation ID 和可持续取得的包装密钥。临时容器不默认创建长期身份，也不自动生成备用主密钥；明确请求的临时测试应标注为测试。

## Node 版本不支持

现象：安装器提示 `需要 Node.js >=22.5.0`，或出现 `node:sqlite` 相关错误。

处理：安装 Node.js 22.5 或更高版本，关闭并重新打开终端，再执行 `node --version`。不要通过修改 `engines` 绕过检查。

## `SECURE_STORAGE_UNAVAILABLE`

含义：OS Keyring 不可用、被锁定、当前会话无访问权限，或缺少／无法使用当前 provider 对应的 wrapping key。

处理：

1. macOS 解锁登录钥匙串并检查访问权限；Windows 检查 Credential Manager；Linux 确认当前执行会话能访问已启动且解锁的 Secret Service。
2. 重新运行 `doctor`，查看 `keyringAvailable` 和 `secureStorageReady`。
3. 如果 `keys.enc.json` 已存在，绝对不要生成新的 wrapping key，也不要改 provider；由管理员从同一 installation 的安全备份恢复。
4. 对于尚未创建身份的受控主机，管理员可以明确配置现有 `env-master-key` 方案，提供至少 32 字符的包装输入；不要让 Agent 自动生成或在聊天、argv、日志中传递它。环境变量中的是包装／解密输入，身份私钥仍加密保存在文件中。代码不会仅因该 provider 而禁止注册；长期身份仍需持久化、密钥管理和恢复条件。
5. 缺少真实平台 API 或 R2/R4 授权不会导致当前的离线密钥存储失败，也不能通过补填 API 或开启链上授权修复它。

已有数据库但 Keyring secret 丢失时，正确结果是失败关闭或进入 `QUARANTINED`，不是生成新 DID。

## `API_ORIGIN_FORBIDDEN`

常见原因：

- preprod/production 使用了 HTTP；
- API URL 带用户名、密码、query 或 fragment；
- 当前 origin 与配置文件 allowlist 不一致；
- 把 Console URL 错当成 API URL。

处理：向平台管理员重新确认 HTTPS API 地址，然后用配置向导更新：

```sh
node "<Skill目录>/scripts/setup-client.mjs" --update
```

更新已有配置时会保留时间戳备份。不要通过放宽 TLS、允许任意 origin 或关闭校验解决。

## `LOCAL_STATE_NETWORK_MISMATCH`

含义：本地 DID、chain ID、deployment environment、Registry 地址或平台响应不一致。

处理：立即停止链上操作，确认：

- 该 Skill 固定 chain ID `985`；
- preprod 与 production 使用不同 installation ID、状态根和 Identity Key；
- API 指向原来注册的同一环境；
- 平台没有误换 Registry manifest。

不要改 SQLite、DID 字符串或 Registry 地址来“对齐”。由平台管理员核对 deployment manifest 后再恢复。

## `INSTALLATION_ID_MISMATCH`

含义：这个状态目录已经属于另一个 installation ID。

处理：恢复 Runtime 原来稳定传入的 installation ID，或为新 Agent 指定全新的状态根。不要让两个 Agent 共用目录，也不要复制其中的数据库或 key store。

## `DID_KEY_MISMATCH` / `KEY_NOT_FOUND`

含义：DID 元数据与本地 Identity Key 不匹配，或 key handle 指向的密钥不存在。

处理：停止签名；检查是否切换了用户账号、Keychain、容器 volume 或错误状态根。只允许从同一 installation 的受控备份恢复。不要创建替代密钥，因为它会派生另一个 DID。

## 状态为 `QUARANTINED`

隔离是保护动作。CLI 不提供“强制解除”命令。

收集以下非秘密信息交给管理员：

- `agentDid` 和 `identityAccount`；
- environment 与 chain ID；
- 配置的 API origin；
- 错误码；
- 平台公开的 Registry 地址和 deployment block。

不要发送 `keys.enc.json`、Keyring secret、master key、Pairing handle 或 session token。只有确认本地公钥、链、Registry 和平台 manifest 一致后，才能设计恢复操作。

## `POLICY_CONFIRMATION_REQUIRED`

含义：命令会产生普通链写、Pairing 或管理签名，但当前没有本次 R2 明确授权。

处理：先检查命令、目标、scope、期限和费用承担方。确认无误后，只对这一条命令设置 `MEMO_AGENT_MAINNET_ALLOW_R2=1`。不要永久写入 shell profile。

## `POLICY_DENIED`

通常表示永久吊销或 successor 等 R4 高风险动作。生产环境不能用环境变量绕过，必须接入平台独立审批服务。`MEMO_AGENT_MAINNET_ALLOW_R4_TEST=1` 只在 loopback local chain-985 测试环境有效。

## `FINALITY_PENDING`、`REORGED` 或长时间 `SUBMITTED`

不要重新构造 payload，也不要生成新签名或新 DID。使用原 operation ID：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" operation status op_... --json
node "<Skill目录>/bin/memo-agent-mainnet" operation reconcile op_... --json
```

平台只应在 Registry nonce 未消费且 deadline 仍有效时重放原 digest 和原签名。若已经过期，由平台返回明确失败，再重新发起新的 intent。

## 注册失败后状态是 `REGISTRATION_SUBMITTED`

这不代表私钥丢失。先查询 operation；如果没有 operation ID，检查 API/Indexer 日志并让平台按原 idempotency key 查询。网络恢复后仍使用同一 `identity ensure` 结果。

## `CONFIG_EXISTS`

配置向导拒绝静默覆盖。确认要更新后增加 `--update`。旧配置会被复制为带时间戳、权限 `0600` 的备份。

## Pairing Invitation / Offer 文件错误

- `INVALID_PAIRING_FILE`：Invitation 不是普通文件、是符号链接，或不属于当前用户；重新从可信 Console 下载到私有目录。
- `Offer output directory does not exist`：先创建只属于当前用户的目录并设为 `0700`。
- `Offer file already exists`：CLI 绝不覆盖文件；选择全新文件名。
- `PAIRING_PACKAGE_MISMATCH`：文件中的 origin、chain、Registry、条款或过期时间与平台不一致；停止操作并重新生成，不要手工编辑。
- `PAIRING_V1_REMOVED`：旧 `pair create` 已停用；改用 `pair invitation accept` 或 `pair offer create`。
- 注册或网络中断：保留文件和同一 DID，用 `pair resume <exchange-id> --json` 续跑。

Pairing 文件包含一次性 handle，不能展示内容或提交仓库。Pairing 只完成 Console 关联；如果 Management operation 未达到 `CONFIRMED`，钱包还不是链上 Primary Manager。

## Skill 没有被 Agent 发现

Codex：默认检查 `~/.agents/skills/memo-agent-did-mainnet/SKILL.md` 或项目的 `.agents/skills/...`；显式配置 `CODEX_HOME` 时检查其 `skills` 子目录。安装器输出的实际路径为准，已有 `.codex/skills` 不自动迁移。新开对话并在 `/skills` 中检查，避免重复安装后加载旧版本。

Claude Code：确认目录是 `~/.claude/skills/memo-agent-did-mainnet/SKILL.md` 或项目的 `.claude/skills/...`，执行 `/reload-skills`。

DeepSeek：确认它运行在真正具备本地 shell/Skill 支持的宿主中；网页聊天和裸 API 不会自动执行本地 Skill。

仍无法解决时，请只提供错误码和非秘密诊断字段，不要提供任何密钥材料。
