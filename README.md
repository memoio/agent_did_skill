# MEMO Agent DID · opBNB Testnet Skill

本仓库只提供 [`memo-agent-did-opbnb-testnet`](skills/memo-agent-did-opbnb-testnet/SKILL.md)。它支持 opBNB Testnet（chain ID `5611`）上的 Agent DID 注册、Invitation/Offer 配对、钱包管理关系双签、身份生命周期和实例管理。Agent 身份密钥留在本机系统密钥库；平台负责发送测试链交易。

## 安装

需要 Node.js 22.5.0 或更新版本。在目标 Agent 的电脑上执行：

```sh
npx skills add memoio/agent_did_skill --skill memo-agent-did-opbnb-testnet -g
```

通用 Skill 安装器只复制文件。进入它显示的 Skill 目录后执行：

```sh
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
```

也可以克隆仓库并使用自带安装器，它会复制 Skill 并安装依赖：

```sh
git clone https://github.com/memoio/agent_did_skill.git
cd agent_did_skill
node scripts/install.mjs --target codex-user
```

默认目标为 `~/.agents/skills/memo-agent-did-opbnb-testnet`。还支持 `codex-project`、`claude-user`、`claude-project` 和 `runtime --dest <目录>`。已有安装需显式加 `--upgrade`；旧程序目录会被备份。安装不会创建 DID 或发送交易。

给 Agent 的安装提示词（[Skill 的 GitHub 目录](https://github.com/memoio/agent_did_skill/tree/main/skills/memo-agent-did-opbnb-testnet)）：

> 请在这台运行 Codex 的电脑上安装 GitHub 仓库 `https://github.com/memoio/agent_did_skill.git` 的 `main` 分支中 `skills/memo-agent-did-opbnb-testnet/SKILL.md`，Skill 名称是 `memo-agent-did-opbnb-testnet`；安装后才使用 `$memo-agent-did-opbnb-testnet` 调用它。若尚未克隆仓库，运行 `git clone --branch main --single-branch https://github.com/memoio/agent_did_skill.git`；若已克隆，先更新到 `origin/main`。然后在仓库根目录运行 `node scripts/install.mjs --target codex-user`；如果目标 Skill 已安装，增加 `--upgrade`。安装器会安装锁定的运行依赖。完成后报告仓库提交号、实际安装路径、依赖检查结果，以及平台 API 和两份 Registry 地址是否已配置。安装阶段不要创建 DID、Offer 或发送链上交易；缺少平台配置时只报告缺项，不自行猜测地址。

## 连接平台

管理员应从已核验的部署清单提供平台 API 和两份合约地址。运行 Skill 的进程需要这些环境变量：

```sh
export MEMO_AGENT_OPBNB_API_URL="http://127.0.0.1:4273"
export MEMO_AGENT_OPBNB_DID_REGISTRY="<已核验的 DID Registry 地址>"
export MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY="<已核验的 Management Registry 地址>"
```

`127.0.0.1` 只适用于 Agent 与平台在同一电脑上运行；跨机器应使用可访问的 HTTPS API。Skill 会核对 chain ID、创世块哈希及合约地址。默认状态目录为 `~/.memo-agent-opbnb-testnet`。

## 创建 DID、注册及生成 Offer

在 Skill 目录运行：

```sh
node bin/memo-agent-opbnb-testnet identity ensure
node bin/memo-agent-opbnb-testnet identity status
node bin/memo-agent-opbnb-testnet register <profile.json> <document.json>
```

`identity ensure` 只在本机生成或复用 DID；`register` 才会请求平台发送测试链注册交易。注册确认且没有有效管理关系后，可创建 Offer：

```sh
mkdir -p "$HOME/.memo-agent-opbnb-testnet/offers"
chmod 700 "$HOME/.memo-agent-opbnb-testnet/offers"
node bin/memo-agent-opbnb-testnet pair offer create "$HOME/.memo-agent-opbnb-testnet/offers/agent.memo-offer.json" agent.read 30 900
```

此例权限上限为 `agent.read`，最长管理期限 30 天，文件有效期 900 秒。钱包用户在 Console 导入 Offer 并签名，Agent 再执行 `binding pending`、`binding inspect <requestId>`、`binding approve <requestId>`。新 Agent 也可接受 Console 创建的 Invitation：`pair invitation accept <invitation.json> <profile.json> <document.json>`。

安装后可直接发给 Agent 的 Offer 提示词：

> 请使用 `$memo-agent-did-opbnb-testnet` 检查当前 Agent 的链上注册和管理状态；如果 DID 已注册且尚未绑定，请用权限 `agent.read`、最长 30 天、有效期 900 秒，在 Agent 私有目录中新建 Offer 文件。只返回 DID、exchangeId、文件路径和到期时间，并说明如何在 Console 导入和完成双方签名；不要输出文件内容或密钥。

安装本身不会创建 Offer。更多命令和签名校验要求见 [SKILL.md](skills/memo-agent-did-opbnb-testnet/SKILL.md)。

## 离线验证

```sh
npm ci --prefix skills/memo-agent-did-opbnb-testnet --ignore-scripts --no-audit --no-fund
npm run check
```

`check` 不会注册 DID 或发送测试链交易。
