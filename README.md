# MEMO Agent DID · opBNB Testnet Skill

本仓库只提供 [`memo-agent-did-opbnb-testnet`](skills/memo-agent-did-opbnb-testnet/SKILL.md)。它支持 opBNB Testnet（chain ID `5611`）上的 Agent DID 注册、Invitation/Offer 配对、钱包管理关系双签、身份生命周期和实例管理。核心是可由任意 Agent 阅读的 `SKILL.md` 和独立 Node CLI，不依赖特定模型。Agent 身份密钥留在运行 CLI 的机器的系统密钥库；平台负责发送测试链交易。

## 安装

需要 Node.js 22.5.0 或更新版本，并且 Agent 能在运行 CLI 的机器上访问终端、Skill 文件和系统密钥库。先从唯一的 [GitHub 仓库 `main` 分支](https://github.com/memoio/agent_did_skill/tree/main)安装：

```sh
git clone --branch main --single-branch https://github.com/memoio/agent_did_skill.git
cd agent_did_skill
node scripts/install.mjs --target agent-user
```

`agent-user` 安装到 `~/.agents/skills/memo-agent-did-opbnb-testnet`。若 Agent 宿主不读取这个目录，指定它实际能读取的**绝对路径**：

```sh
node scripts/install.mjs --target runtime --dest "/absolute/path/to/agent/skills/memo-agent-did-opbnb-testnet"
```

安装器会复制 Skill 并安装锁定的运行依赖。安装目标选择如下；`DeepSeek`、`WorkBuddy` 等名称本身不决定目录，应按其实际 Agent 宿主的文件读取方式选择：

| 运行环境 | 安装目标 | 使用方式 |
| --- | --- | --- |
| 可读取通用 Skill 目录的 Agent | `agent-user` 或 `agent-project --project <项目目录>` | 从 `~/.agents/skills` 或项目 `.agents/skills` 加载 `SKILL.md` |
| Codex / Claude | `codex-user`、`codex-project` / `claude-user`、`claude-project` | 使用各自的已知 Skill 目录 |
| DeepSeek、WorkBuddy 或其他自定义宿主 | `runtime --dest <宿主可读的绝对目录>` | 让宿主显式读取该目录的 `SKILL.md`，并在同一机器上运行 CLI |

支持 `npx skills` 的宿主也可使用 `npx skills add memoio/agent_did_skill --skill memo-agent-did-opbnb-testnet -g`，然后在安装目录执行 `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`。仓库中的 `agents/openai.yaml` 和 `.codex-plugin` 只是对应宿主的可选入口，其他 Agent 直接使用 `SKILL.md` 与 CLI。已有安装需显式加 `--upgrade`；旧程序目录会被备份。安装不会创建 DID 或发送交易。仅提供网页聊天、不能访问本机文件/终端/系统密钥库的 Agent，需要先连接可执行上述命令的本地运行环境。

给 Agent 的安装提示词（[Skill 的 GitHub 目录](https://github.com/memoio/agent_did_skill/tree/main/skills/memo-agent-did-opbnb-testnet)）：

> 请在你实际运行、能访问终端和系统密钥库的机器上安装 `memo-agent-did-opbnb-testnet`。唯一来源是 `https://github.com/memoio/agent_did_skill.git` 的 `main` 分支，入口为 `skills/memo-agent-did-opbnb-testnet/SKILL.md`。未克隆时运行 `git clone --branch main --single-branch https://github.com/memoio/agent_did_skill.git`；已克隆时先更新到 `origin/main`。在仓库根目录执行 `node scripts/install.mjs --target agent-user`；如果你的宿主不读取 `~/.agents/skills`，改用 `--target runtime --dest <宿主可读的绝对目录>`。目标已存在时增加 `--upgrade`。安装后为本 Agent 选择唯一的本地 `agent-id`，先运行 `agent list`，不要把另一 Agent 的 DID 当作自己的身份；初始化和上链注册是分开的步骤。完成后报告提交号、安装路径与本机公开平台配置核对结果。安装阶段不要创建 DID、Offer 或发送链上交易。

## 连接平台

Skill 内置当前本机测试部署的公开配置：API 为 `http://127.0.0.1:4273`，chain ID 为 `5611`，DID Registry 为 `0x456Df7c0C189BF0187a8c0A70c713F8Da609c9d7`，Management Registry 为 `0x9e589B142543ea9E15eE25C53823354319dB3929`。每次链操作仍与平台 `/api/v1/chain/config` 比较部署 ID、创世块与合约地址，不匹配就停止。它不包含 Relayer 私钥。

若 Agent 不在平台所在主机，或使用另一份经过核验的部署，请**同时**配置以下三项；只覆盖其中一部分会报错：

```sh
export MEMO_AGENT_OPBNB_API_URL="http://127.0.0.1:4273"
export MEMO_AGENT_OPBNB_DID_REGISTRY="<该部署的 DID Registry 地址>"
export MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY="<该部署的 Management Registry 地址>"
```

`127.0.0.1` 只适用于 Agent 与平台在同一电脑上运行；跨机器应使用可访问的 HTTPS API。运行 `node bin/memo-agent-opbnb-testnet config check` 可只读核对当前公开配置，不需要选择 Agent ID 或签名。

## 创建 DID、注册及生成 Offer

同一主机可共用 Skill 程序，但每个独立 Agent 必须有不同的本地 ID。首次创建只写本机身份与注册资料模板：

```sh
node bin/memo-agent-opbnb-testnet agent list
node bin/memo-agent-opbnb-testnet agent init agent-b
node bin/memo-agent-opbnb-testnet --agent agent-b identity status
```

新 Agent 的 `document.json` 与 `profile.template.json` 位于返回的 `stateDirectory`。把模板复制为 `profile.json`，填写并确认非空的名称与描述，然后单独注册：

```sh
node bin/memo-agent-opbnb-testnet --agent agent-b register --profile "$HOME/.memo-agent-opbnb-testnet/agents/agent-b/profile.json"
node bin/memo-agent-opbnb-testnet --agent agent-b pair offer create "$HOME/.memo-agent-opbnb-testnet/agents/agent-b/offers/agent.memo-offer.json" agent.read 30 900
```

`agent init` 不发送交易；`register` 才请求平台发送注册交易。此 Offer 示例权限上限为 `agent.read`，最长管理期限 30 天，文件有效期 900 秒。钱包用户在 Console 导入 Offer 并签名，Agent 使用同一 `--agent agent-b` 执行 `binding pending`、`binding inspect <requestId>`、`binding approve <requestId>`。新 Agent 接受 Invitation 时，先运行 `--agent agent-b pair invitation accept <invitation.json>` 领取；确认 Profile 并独立注册后，重复接受命令完成配对。

已有默认目录中的注册 DID 应由原 Agent 一次性领取，领取时必须核对完整 DID：`node bin/memo-agent-opbnb-testnet agent claim-default <原Agent-ID> --expect-did <现有DID>`。此操作不更换钥匙或发送交易。此后所有身份命令都带 `--agent <ID>`；没有 ID 时 CLI 拒绝执行。

安装后可直接发给 Agent 的 Offer 提示词：

> 请阅读已安装的 `memo-agent-did-opbnb-testnet/SKILL.md`。先确定本 Agent 的唯一 `agent-id`，运行 `agent list`，再用 `--agent <ID>` 查询身份；不要把另一 Agent 的 DID 当作自己的。如果本 Agent 的 DID 已注册且尚未绑定，请用权限 `agent.read`、最长 30 天、有效期 900 秒，在该 Agent 的独立 `offers` 目录中新建 Offer。只返回 DID、exchangeId、文件路径和到期时间；不要输出文件内容或密钥。

安装本身不会创建 Offer。更多命令和签名校验要求见 [SKILL.md](skills/memo-agent-did-opbnb-testnet/SKILL.md)。

## 离线验证

```sh
npm ci --prefix skills/memo-agent-did-opbnb-testnet --ignore-scripts --no-audit --no-fund
npm run check
```

`check` 不会注册 DID 或发送测试链交易。
