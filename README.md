# MEMO Agent DID Skills

默认在用户本机，或用户明确选择的长期运行主机上，为 Agent 创建并使用 MEMO chain-985 身份。私钥由该主机上的运行环境加密保管；平台通过挑战签名认证 Agent，并提供注册、配对和链上管理关系流程。

仓库：<https://github.com/memoio/agent_did_skill>。`main` 同时包含相互隔离的 MEMO chain 985 与 opBNB Testnet chain 5611 Agent 端 Skill。主网 Skill 当前版本为 `2.0.0-preprod`，许可标记为 `UNLICENSED`。链上操作需要管理员提供可访问的平台 API。

## opBNB 测试链 Skill（chain 5611）

`main` 包含独立的 [`memo-agent-did-opbnb-testnet`](skills/memo-agent-did-opbnb-testnet/SKILL.md)。它用于 Agent DID 注册、Invitation/Offer 配对、管理关系双签审批、身份生命周期和运行实例测试。主网 chain 985 Skill 的身份目录与系统密钥命名空间不能复用。

```sh
git clone https://github.com/memoio/agent_did_skill.git
cd agent_did_skill/skills/memo-agent-did-opbnb-testnet
npm ci --omit=dev
```

运行前，从平台已核验的部署清单取得 chain 5611 的两份合约地址，并设置 `MEMO_AGENT_OPBNB_API_URL`、`MEMO_AGENT_OPBNB_DID_REGISTRY`、`MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY`。本机 API 示例为 `http://127.0.0.1:4273`；跨机器 Agent 应使用可访问的 HTTPS 平台地址。`identity ensure` 仅在 Agent 本机创建隔离身份；`register <profile.json> <document.json>` 才会请求平台提交真实测试链交易。

给具备本地终端执行能力的 Agent 的安装提示词：

> 请从 memoio/agent_did_skill 的 `main` 安装 `skills/memo-agent-did-opbnb-testnet`，执行 `npm ci --omit=dev`，检查本机密钥库与独立状态目录，然后运行 `identity status`。核对平台 API、chain ID 5611 和两份合约地址。此阶段不要创建身份或提交链上交易；向我报告检查结果。

配对时在 Console 选择新 Agent Invitation、已有 Agent Offer 或已知 DID。Agent 用 `binding pending`、`binding inspect <请求ID>` 审核同一管理意图，再在用户明确要求批准后运行 `binding approve <请求ID>`。Skill 不接收平台 Gas 账户私钥；Agent 身份私钥保存在本机系统密钥库。详细命令与约束见上面的 Skill 文件。

## 直接告诉 Agent 安装

将下面这句话发给 Codex、Claude Code 或支持本地 Skill 的其他 Agent：

> 请在我的本机或我已明确指定的长期运行主机上，从 https://github.com/memoio/agent_did_skill 安装 memo-agent-did-mainnet，完成依赖初始化并检查身份密钥存储。若实际执行在临时云环境且缺少密钥保护或持久化条件，请说明阻塞原因并提供本机运行指引。安装阶段不创建身份、不上链，不自行生成备用主密钥。

普通网页聊天模型或单独的模型 API 需要具备本地执行能力的宿主，才能安装和运行此 Skill。

“本地”指命令实际执行的主机。模型名称、桌面聊天客户端、安装目录或 `/root` 路径都不能单独证明程序运行在用户电脑上。Claude Code 的本地会话使用本机环境；云端会话使用远端环境，无法直接使用用户电脑的 Keychain。

受控服务器或云主机有条件支持：管理员需提供稳定的 installation ID、持久化身份目录、可用的密钥保护方式，以及重启后继续取得同一包装密钥的能力。临时云容器不作为长期身份的默认运行位置；只有用户明确要求临时测试时才按测试身份处理。`doctor` 不自动判断云端类型，也不验证磁盘长期持久性或备份。

## 方式一：通用 Skill 安装器

推荐 Node.js `22.22+`（Skill 运行时最低要求保留为 `22.5.0`）。在目标项目内执行：

```sh
npx skills add memoio/agent_did_skill --skill memo-agent-did-mainnet
```

按提示选择 Agent；默认安装到当前项目，增加 `-g` 可安装到用户级。通用安装器只复制 Skill 文件，不保证安装 Node.js 依赖。请将下面的 `<Skill目录>` 替换为安装器实际输出的目录，然后执行：

```sh
node "<Skill目录>/scripts/setup-runtime.mjs" --json
```

也可以在该 Skill 目录执行 `npm run setup:runtime`。成功返回 `ready: true`、`readyScope: "runtime-dependencies"` 和 `generatedIdentity: false`，仅表示运行依赖就绪。依赖初始化会访问 npm registry，不访问 Agent DID 平台、不生成密钥、不需要 TypeScript 编译器。

## 方式二：克隆后使用仓库安装器

```sh
git clone https://github.com/memoio/agent_did_skill.git
cd agent_did_skill

# Codex 用户级安装（默认 ~/.agents/skills）
node scripts/install.mjs --target codex-user

# 或 Claude Code 用户级安装（~/.claude/skills）
node scripts/install.mjs --target claude-user
```

仓库安装器会复制 Skill 并完成依赖初始化，输出实际安装位置。Codex 如显式设置 `CODEX_HOME`，用户级目标为 `$CODEX_HOME/skills`；项目级目标为 `.agents/skills`。旧 `.codex/skills` 安装不会被自动迁移。更多项目级、Windows 和 Runtime 安装方式见[安装手册](skills/memo-agent-did-mainnet/references/installation.zh-CN.md)。

Codex 也可以通过内置 Skill Installer 安装指定子目录：

> 使用 $skill-installer 在我的本机或已指定的长期主机上，从 memoio/agent_did_skill 的 skills/memo-agent-did-mainnet 子目录安装，完成依赖初始化并运行 doctor 检查身份存储；安装阶段不创建身份。

## 检查身份存储与离线创建

安装完成后先检查当前主机的身份存储，无需先部署或连接平台：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" doctor --json
```

| 结果 | 表示什么 |
| --- | --- |
| 安装器 `runtimeDependenciesReady: true` | 文件及依赖已安装，`identityStorageChecked: false` 表示尚未检查身份存储 |
| `doctor.data.identityStorageReady` | 当前配置能否使用身份密钥存储 |
| `doctor.data.ready`、`blockingChecks` | 现有本地身份前置检查是否通过，以及失败项 |
| `platformConnectivityChecked: false` | 没有检测平台连通性；URL 检查通过不代表服务器在线 |

系统密钥库不可用时先解决存储问题，补填平台 API 或开启 R2/R4 不能修复密钥存储。`doctor` 会初始化安装标记和状态数据库，但不生成身份密钥，也不自动配置系统密钥库。

用户已请求创建身份、检查通过，且已选择合适的运行主机后执行；如果请求本身已经包含创建身份，无需重复索取同一授权：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" identity ensure --json
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

`identity ensure` 首次在本地生成密钥与 DID，后续复用同一身份，不联网、不上链。`identity status` 显示公开身份状态，不显示私钥。系统密钥库要求：macOS Keychain、Windows Credential Manager 或已解锁的 Linux Secret Service；容器和 SSH 会话不保证具备这些条件。

“离线”表示不要求平台在线或 R2/R4 授权，身份仍绑定部署环境。未配置时使用 `local`；准备接入 preprod/production 的身份应在创建前固定对应环境和合法 HTTPS origin（见下一节），不要求此时 API 已连通。已有 `local` 身份不能直接跨环境复用为预发布或生产身份。

同一机器运行多个 Agent 时，由宿主为每个 Agent 持久化不同的 `MEMO_AGENT_MAINNET_INSTALLATION_ID` 和各自的 `MEMO_AGENT_MAINNET_HOME`。重启继续加载原配置与状态，不能共用默认身份、复制另一 Agent 的密钥或每次启动生成新 ID。

## 后续注册的连接配置

准备注册时，由管理员提供目标环境、真实 API 和 Console 地址，通过向导保存连接配置：

```sh
node "<Skill目录>/scripts/setup-client.mjs"
```

已有身份应保持原部署环境、installation ID 和状态根。配置连接不等于注册；实际注册需要可用的平台服务和明确的 R2 授权。

`env-master-key` 是已有的备用保护方式：环境变量提供包装／解密输入，身份私钥仍加密保存在文件中。配置向导默认使用系统密钥库，不会自行生成备用主密钥。代码不会仅因使用备用 provider 而禁止注册；长期使用需由管理员管理密钥保护、持久化与恢复。已有身份丢失包装密钥时必须恢复原保护材料，不得切换 provider 或生成替代身份。

## 平台边界

- 管理员需要提供 `local`、`preprod` 或 `production` 环境、API URL 和钱包 Console URL；预发布与生产 API 必须为显式允许的 HTTPS origin。
- 当前后端交付为本地／预发布实现，此仓库没有内置公共 production URL，也不表示生产服务已经部署。
- 注册、配对和管理审批需要显式 R2 服务授权；安装不会开启授权。R4 测试授权只适用于一次性 loopback chain-985 仿真。
- `memo-agent-pairing/2` 支持平台 Invitation 与 Agent Offer 两种文件交换；Pairing、链上管理关系和成果确权仍是不同步骤。此 Skill 不提供数据／作品确权登记或 Gateway 资源授权。
- 私钥、包装密钥、会话 token 和配对 handle 不得写入聊天、命令参数、仓库或日志。

## 手册与开发验证

- [安装手册](skills/memo-agent-did-mainnet/references/installation.zh-CN.md)
- [使用手册](skills/memo-agent-did-mainnet/references/user-guide.zh-CN.md)
- [故障排查](skills/memo-agent-did-mainnet/references/troubleshooting.zh-CN.md)
- [技术操作参考](skills/memo-agent-did-mainnet/references/mainnet-operations.md)

开发者使用 Node.js `22.22+`，在仓库根目录执行：

```sh
npm ci --prefix skills/memo-agent-did-mainnet --ignore-scripts --no-audit --no-fund
npm run check
```

检查包括构建、功能测试、安装失败与回滚测试、发行包验证，以及临时目录中的真实依赖安装、符号链接安装和升级冒烟测试。CI 在 Linux 和 macOS 运行上述检查，并验证提交的 `dist` 与源码一致。

安装器支持从已有发行包升级：`node scripts/install.mjs --target codex-user --upgrade`。升级先备份旧程序目录，身份状态独立保存。通过通用安装器更新 Skill 后，重新运行 `setup:runtime`；不要删除身份状态。
