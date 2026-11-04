# MEMO Mainnet Agent DID Skill 安装手册

本手册给第一次接触 Agent Skill 的用户使用。安装只复制 Skill 和安装依赖；不会创建 DID、不会生成私钥、不会连接链、不会产生 Gas。

默认请 Agent 在你的本机或你明确指定的长期运行主机上安装、初始化依赖并运行 `doctor`。实际执行主机与聊天客户端、模型名称不同；桌面客户端、Skill 安装目录或 `/root` 路径都不能单独证明程序运行在你的电脑上。

推荐安装提示词：

> 请在我的本机或我已明确指定的长期运行主机上，从 https://github.com/memoio/agent_did_skill 安装 memo-agent-did-mainnet，完成依赖初始化并检查身份密钥存储。若实际执行在临时云环境且缺少密钥保护或持久化条件，请说明阻塞原因并提供本机运行指引。安装阶段不创建身份、不上链，不自行生成备用主密钥。

## 1. 安装前准备

你需要：

- 64 位 macOS、Windows 或可访问已解锁 Secret Service 的 Linux；受控服务器也可使用下述管理员配置方案；
- Node.js `22.5.0` 或更高版本，执行 `node --version` 检查；使用通用安装器和开发验证推荐 `22.22+`；
- 配置平台连接时需要管理员提供的运行环境、Agent DID API 地址和 Console 地址；
- 从 `https://github.com/memoio/agent_did_skill` 获取的完整 Skill 或发行仓库。

如果 `node --version` 低于 `v22.5.0`，先从 [Node.js 官网](https://nodejs.org/) 安装当前 Node 22 LTS 或更新版本。

系统密钥库要求：

- macOS：登录钥匙串可用；首次使用可能弹出系统授权框。
- Windows：Credential Manager 可用。
- Linux：当前执行会话可访问已启动且已解锁的 Secret Service；本 Skill 不会回退到临时 kernel keyring。

不要在服务器、容器或 SSH 会话里假设系统密钥库一定可用。先执行后面的 `doctor`。

受控云端长期身份需要管理员提供稳定的 installation ID、持久化身份目录，以及重启后仍可持续取得的同一密钥保护材料。没有系统密钥库时，已有的 `env-master-key` 方案允许管理员通过可信启动环境提供至少 32 字符的包装输入，身份私钥仍加密保存在文件中。不要由 Agent 自动生成备用主密钥；临时测试身份只按用户明确的测试意图处理。诊断通过不代表已验证长期持久性或恢复能力。

## 2. 选择一种安装方式

### 从 GitHub 使用通用安装器

在目标项目内执行：

```sh
npx skills add memoio/agent_did_skill --skill memo-agent-did-mainnet
```

按提示选择 Agent，增加 `-g` 可安装到用户级。安装器只复制文件，必须继续对实际安装目录运行：

```sh
node "<Skill目录>/scripts/setup-runtime.mjs" --json
```

也可以在该 Skill 目录执行 `npm run setup:runtime`。它按锁文件安装生产依赖并验证导入，不需要后端源码或 TypeScript 编译器；此步骤访问 npm registry，不访问平台、不生成身份、不启用 R2/R4。

初始化结果的 `readyScope: "runtime-dependencies"` 表明 `ready` 仅描述依赖。仓库安装器的 `runtimeDependenciesReady: true`、`identityStorageChecked: false` 也不表示身份存储已可用；安装后继续执行 `doctor`。

如果 `dist`、锁文件或 CLI 缺失，会返回 `RUNTIME_PACKAGE_INCOMPLETE`，请重新安装完整 Skill。依赖安装失败返回 `DEPENDENCY_INSTALL_FAILED`，检查网络和 npm registry 后重试；原生模块无法导入返回 `RUNTIME_IMPORT_FAILED`，检查操作系统、架构和 Node.js 版本。出现这些错误应停止，不要继续创建身份。

### 克隆后使用仓库安装器

仓库安装器会自动完成上述依赖初始化。先获取仓库：

```sh
git clone https://github.com/memoio/agent_did_skill.git
cd agent_did_skill
```

### Codex 用户

安装到当前用户，所有 Codex 项目都能发现：

```sh
node scripts/install.mjs --target codex-user
```

只给一个项目使用：

```sh
node scripts/install.mjs --target codex-project --project /你的项目目录
```

安装后新开一个 Codex 对话，在 `/skills` 中确认 `memo-agent-did-mainnet`，或直接输入：

```text
$memo-agent-did-mainnet 在我的本机或已明确指定的长期主机上完成依赖初始化并运行 doctor，报告身份存储检查结果。安装阶段不创建身份，不自行生成备用主密钥。
```

Codex 默认用户级目标为 `~/.agents/skills/<name>`，项目级目标为 `.agents/skills/<name>`。若显式设置 `CODEX_HOME`，用户级目标仍使用 `$CODEX_HOME/skills/<name>`。参考 [OpenAI Skills 文档](https://learn.chatgpt.com/docs/build-skills)。已有 `.codex/skills` 不会被自动迁移；升级旧路径可用 `--target runtime --dest <旧Skill目录> --upgrade`，不要重复安装同名 Skill 后误用旧版本。

也可以告诉 Codex：使用 `$skill-installer` 从 `memoio/agent_did_skill` 的 `skills/memo-agent-did-mainnet` 子目录安装，再运行安装目录中的 `scripts/setup-runtime.mjs --json`。内置安装器可能使用自己的目录约定，以它的输出路径为准。

### Claude Code 用户

安装到当前用户：

```sh
node scripts/install.mjs --target claude-user
```

只给一个项目使用：

```sh
node scripts/install.mjs --target claude-project --project /你的项目目录
```

安装后重启 Claude Code，或执行 `/reload-skills`，然后输入：

```text
/memo-agent-did-mainnet 在我的本机或已明确指定的长期主机上完成依赖初始化并运行 doctor，报告身份存储检查结果。安装阶段不创建身份，不自行生成备用主密钥。
```

Claude Code 官方支持用户级 `~/.claude/skills/<name>` 和项目级 `.claude/skills/<name>`。参考 [Claude Code Skills 文档](https://code.claude.com/docs/en/skills)。

在你电脑上的本地 Claude Code 会话中，上述命令使用该电脑的存储服务。在 Claude 云端会话中，命令运行在远端，不能直接使用你电脑的 Keychain；桌面聊天窗口也不能单独证明执行发生在本机。若实际会话缺少密钥保护或持久化条件，应在本机终端重新执行安装命令并运行 `doctor`，或由管理员先准备符合条件的长期主机；不要把存储阻塞归因于 Claude 模型本身。

### DeepSeek 用户

最省事的方式是让 DeepSeek 模型运行在具备本地 shell 和 Skill 目录的 Codex 宿主中。先安装并至少启动一次 Codex，再按 [DeepSeek 官方 Codex 集成说明](https://api-docs.deepseek.com/quick_start/agent_integrations/codex/) 配置模型。官方当前提供的一键命令是：

macOS/Linux：

```sh
bash <(curl -fsSL https://cdn.deepseek.com/api-docs/codex-deepseek-setup-en.sh)
```

Windows PowerShell：

```powershell
irm https://cdn.deepseek.com/api-docs/codex-deepseek-setup-en.ps1 | iex
```

远程脚本会要求 DeepSeek API Key，并备份后修改 `~/.codex/config.toml`。只从上述 DeepSeek 官方域名执行；高安全环境应先下载、审阅脚本，或按官方页面手工配置。配置完成后，再执行本手册的 `codex-user` 安装命令，并通过 `$memo-agent-did-mainnet` 使用。

DeepSeek 网页聊天或单独调用 DeepSeek API 不能直接保管本机密钥、执行 CLI 或访问系统密钥库。官方工具调用机制也要求宿主程序真正实现和执行工具，模型本身只提出调用。参考 [DeepSeek Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)。如果你的 DeepSeek 宿主具备受控 shell，可安装成普通 Runtime：

```sh
node scripts/install.mjs --target runtime --dest /独立路径/memo-agent-did-mainnet
```

然后把该目录的 `SKILL.md` 和 `bin/memo-agent-mainnet` 接入宿主。不要让模型获得读取 `keys.enc.json`、系统密钥库或 Pairing handle 文件的权限。

## 3. 检查存储与离线创建身份

安装器会显示实际安装目录。下面用 `<Skill目录>` 代表它。先执行：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" doctor --json
```

检查 `data.ready`、`identityStorageReady`、`blockingChecks` 和 `guidance`。顶层 `ok: true` 和成功退出码只表示诊断命令执行完成。`ready: false` 时按阻塞项修复；系统密钥库不可用时检查服务、解锁和当前会话访问权限，或使用管理员已配置的保护方案。R2/R4 未开启、没有环境变量主密钥不会单独阻塞已有可用系统密钥库的离线流程。

`platformConnectivityChecked: false` 表示没有联系平台；`networkEgress` 检查的是地址配置策略，不能证明 API 可达。`doctor` 会初始化安装标记和状态数据库，不生成身份或包装密钥，也不验证存储长期持久性。

只请求安装或环境检查时到此结束。用户同时明确请求创建身份且检查通过时，可继续执行，无需重复索取同一授权：

```sh
node "<Skill目录>/bin/memo-agent-mainnet" identity ensure --json
node "<Skill目录>/bin/memo-agent-mainnet" identity status --json
```

正确结果是 `LOCAL_IDENTITY_READY`、`registered: false`，并返回 `did:memo:agent:985:0x...`。再次执行 `identity ensure` 应返回相同 DID 和 `reused: true`。这不需要平台、Console、RPC 在线，也不需要 R2/R4。

身份仍绑定部署环境：默认是 `local`；计划用于 preprod/production 的身份应在创建前确定该环境和合法 HTTPS origin，按下一节保存配置即可，无需平台此时在线。已有 local 身份不能跨环境复用。多 Agent 还需在创建前分别固定 installation ID 和持久化状态根。

## 4. 后续注册的平台连接配置

真实 API 和明确的 R2 授权用于后续注册，不是修复离线密钥存储的条件。由管理员提供目标环境和地址，再运行配置向导：

```sh
node "<Skill目录>/scripts/setup-client.mjs"
```

向导会询问：

1. 环境：`local`、`preprod` 或 `production`；
2. 平台 API：由平台管理员提供；
3. installation ID：一台机器运行多个 Agent 时必须为每个 Agent 设置不同且稳定的值，并分别持久化各自的状态根；
4. 密钥保护方式：普通用户选择 `auto`。

规则如下：

- `local` 只接受 `http://127.0.0.1` 或 `http://localhost`；
- `preprod` 和 `production` 只接受 HTTPS；
- URL 不得包含用户名、密码、query 或 fragment；
- 配置文件只保存非秘密参数，权限为 `0600`；
- 此步骤仍不会生成 DID 或密钥。

无人值守示例：

```sh
node "<Skill目录>/scripts/setup-client.mjs" \
  --non-interactive \
  --environment preprod \
  --api-url https://agent-did-preprod.example.com \
  --installation-id my-agent-01 \
  --key-provider auto
```

请把示例域名替换为管理员给你的真实地址。当前发行包没有内置或虚构 production URL。

同一系统用户下有多个 Agent 时，宿主应为每个 Agent 保存独立的 `MEMO_AGENT_MAINNET_HOME`，再在该 Agent 的启动环境中持续加载它。配置向导会把非秘密连接参数写入该根目录的 `client.json`，后续 CLI 自动读取。两个 Agent 不要共用同一份 `client.json` 或默认 `.installation-id`；重启不得更换 installation ID 或使用临时状态目录。

已有身份要保持原部署环境、installation ID 和状态根，不能通过切换环境、provider 或重新生成包装密钥来修复。原保护材料丢失时先恢复其访问。代码不会仅因使用 `env-master-key` 而禁止注册，长期保管责任仍由主机管理员承担。

## 5. Windows PowerShell 示例

在 PowerShell 中，`$HOME` 是用户目录。Codex 默认路径示例：

```powershell
node "$HOME\.agents\skills\memo-agent-did-mainnet\bin\memo-agent-mainnet" doctor --json
```

安装或检查请求到此结束。已经请求创建身份、确定部署环境且检查通过时才执行：

```powershell
node "$HOME\.agents\skills\memo-agent-did-mainnet\bin\memo-agent-mainnet" identity ensure --json
node "$HOME\.agents\skills\memo-agent-did-mainnet\bin\memo-agent-mainnet" identity status --json
```

Claude Code 把 `.agents` 换成 `.claude` 即可。若安装器显示了不同路径，以安装器输出为准。

## 6. 升级

回到新发行包目录，执行同一安装命令并增加 `--upgrade`：

```sh
node scripts/install.mjs --target codex-user --upgrade
```

安装器会先把旧 Skill 目录改名为带时间戳的备份；不会删除身份状态。`~/.memo-agent-mainnet` 是独立状态根，不位于 Skill 安装目录中。

升级后重新运行 `doctor`；已有身份可用 `identity status` 核对 DID、公钥和 key handle。仅在已请求创建或复用身份时运行 `identity ensure`。没有原保护材料时停止并恢复它，不生成替代身份。

若通过通用安装器安装，可使用其更新功能；更新后重新运行 `scripts/setup-runtime.mjs --json`。更新 Skill 程序与删除身份状态无关，不要清理状态根或系统密钥库。

## 7. 不要做的事情

- 不要把 `keys.enc.json`、master key、Pairing handle、session token 或钱包私钥发给任何 Agent 或客服。
- 不要从旧 Anvil Skill、preprod、另一台机器或另一 installation 复制密钥目录。
- 不要使用 npm `postinstall` 自动创建身份；本发行包没有任何安装生命周期脚本。
- 不要因为网络注册失败而删除状态并重新生成 DID。
- 不要把同一个状态根同时用于 preprod 和 production。

下一步请阅读 [新手使用手册](user-guide.zh-CN.md)。安装异常请查阅 [故障排查](troubleshooting.zh-CN.md)。
