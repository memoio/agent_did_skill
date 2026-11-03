# MEMO Agent DID Skill

为具备本地终端执行能力的 Agent 创建并使用 MEMO chain-985 身份。私钥由 Agent 的本地运行环境加密保管；平台通过挑战签名认证 Agent，并提供注册、配对和链上管理关系流程。

仓库：<https://github.com/memoio/agent_did_skill>。当前版本为 `1.0.0-preprod`，许可标记为 `UNLICENSED`。本仓库包含独立 Agent 端 Skill，不需要后端源码；链上操作需要管理员提供可访问的平台 API。

## 直接告诉 Agent 安装

将下面这句话发给 Codex、Claude Code 或支持本地 Skill 的其他 Agent：

> 请从 https://github.com/memoio/agent_did_skill 安装 memo-agent-did-mainnet，按照安装说明完成依赖初始化，并检查运行环境。安装期间不要创建身份、配对或链上交易，不要开启 R2/R4 授权。

普通网页聊天模型或单独的模型 API 需要具备本地执行能力的宿主，才能安装和运行此 Skill。

## 方式一：通用 Skill 安装器

推荐 Node.js `22.22+`（Skill 运行时最低要求保留为 `22.5.0`）。在目标项目内执行：

```sh
npx skills add memoio/agent_did_skill --skill memo-agent-did-mainnet
```

按提示选择 Agent；默认安装到当前项目，增加 `-g` 可安装到用户级。通用安装器只复制 Skill 文件，不保证安装 Node.js 依赖。请将下面的 `<Skill目录>` 替换为安装器实际输出的目录，然后执行：

```sh
node "<Skill目录>/scripts/setup-runtime.mjs" --json
```

也可以在该 Skill 目录执行 `npm run setup:runtime`。成功返回 `ready: true` 和 `generatedIdentity: false`。依赖初始化会访问 npm registry，不访问 Agent DID 平台、不生成密钥、不需要 TypeScript 编译器。

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

> 使用 $skill-installer 从 memoio/agent_did_skill 仓库的 skills/memo-agent-did-mainnet 子目录安装 Skill，然后运行安装目录中的 scripts/setup-runtime.mjs --json 完成依赖初始化。

## 配置与首次创建身份

安装完成后，运行配置向导，填写管理员提供的环境和 API 地址：

```sh
node "<Skill目录>/scripts/setup-client.mjs"
node "<Skill目录>/bin/memo-agent-mainnet" doctor --json
```

检查 `doctor` 的 `data.ready`。系统密钥库不可用时先解决环境问题，不要把安装成功当作身份已就绪。用户明确请求创建身份后再执行：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" identity ensure --json
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

`identity ensure` 首次在本地生成密钥与 DID，后续复用同一身份，不联网、不上链。`identity status` 显示公开身份状态，不显示私钥。系统密钥库要求：macOS Keychain、Windows Credential Manager 或已解锁的 Linux Secret Service；容器和 SSH 会话不保证具备这些条件。

同一机器运行多个 Agent 时，由宿主为每个 Agent 持久化不同的 `MEMO_AGENT_MAINNET_INSTALLATION_ID` 和各自的 `MEMO_AGENT_MAINNET_HOME`。重启继续加载原配置与状态，不能共用默认身份、复制另一 Agent 的密钥或每次启动生成新 ID。

## 平台边界

- 管理员需要提供 `local`、`preprod` 或 `production` 环境、API URL 和钱包 Console URL；预发布与生产 API 必须为显式允许的 HTTPS origin。
- 当前后端交付为本地／预发布实现，此仓库没有内置公共 production URL，也不表示生产服务已经部署。
- 注册、配对和管理审批需要显式 R2 服务授权；安装不会开启授权。R4 测试授权只适用于一次性 loopback chain-985 仿真。
- 平台 Pairing、链上管理关系和成果确权是不同步骤。此 Skill 不提供数据／作品确权登记或 Gateway 资源授权。
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
