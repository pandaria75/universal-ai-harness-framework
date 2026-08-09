# Marionettist

[English](./README.md)

Marionettist 是一套可复用的文件型工作流，让任意仓库中的 AI 辅助开发更安全。

它为 AI agent 和人类团队提供一份共享契约：规则放在哪里、任务上下文如何准备、何时可以编码、agent 必须在何处停下等待批准。

## Marionettist 是什么

Marionettist 帮助团队把 AI 工作流中的关键信息从聊天记录移回仓库文件。

适合以下需求：

- 希望规则和 onboarding 文件留在仓库里
- 希望编码前先准备任务上下文
- 希望对非平凡任务设置明确的批准 gate
- 希望框架更新时保留项目自己的本地内容

## 如果你是来…

- **给目标项目安装 Marionettist：** 从 [安装](#安装) 和 [面向目标项目团队](#面向目标项目团队) 开始。
- **先了解工作流再决定是否采用：** 先读 [解决的问题](#解决的问题)，再看 [延伸阅读](#延伸阅读)。
- **维护当前这个 framework 仓库本身：** 直接跳到 [面向本仓库的 framework 维护者](#面向本仓库的-framework-维护者)。

## 解决的问题

AI 辅助开发常因简单原因失败：

- agent 忘记了对话早期的约束
- 项目知识留在聊天中，不在仓库里
- 实现过程中范围悄悄扩张
- review 发生得太晚，或依据不清晰的需求
- agent prompt 升级覆盖了本地的团队规则

这套框架把重要内容移到普通文件中。任何 agent 都能读取，能在 Git 中 review，能安全地升级。

如果你想先用适合初学者的方式理解为什么它强调先规划、gate、slice 和项目中立设计，请阅读 [docs/philosophy.zh-CN.md](./docs/philosophy.zh-CN.md)。

## 亮点

- **仓库内的契约。** `AGENTS.md`、rules、docs、任务状态和 manifest 都是普通文件。
- **Agent 中立的工作流。** 这套方法适用于任何能读 Markdown、能编辑文件的 agent。
- **显式 gate。** 非平凡工作在 analysis 完成后、以及每个已批准 slice 完成后停下。
- **编码前先建任务上下文。** Agent 应准备紧凑的 context pack，而不是仅凭聊天记录就开始编码。
- **安全同步。** `marionettist diff` 预览变更；`marionettist sync` 更新受管资产，同时保留本地内容。
- **OpenCode 可选支持。** Slash commands 和角色 agent 改善体验，但 Marionettist 不依赖 OpenCode。
- **Pi 项目局部分发版。** Pi package 自动安装 skills、prompt workflows 和七个固定 Marionettist subagents，且不会全局启用。
- **统一模型分层。** OpenCode 与 Pi 共用 `.marionettist/model-profiles.yml`。

## 安装

```powershell
# 从 GitHub 安装
npm install -g github:pandaria75/marionettist

# 或从本框架仓库的本地克隆安装
npm link
```

## 面向目标项目团队

在目标项目中执行以下命令：

```powershell
# 预览将要安装的内容
marionettist init --dry-run

# 交互式安装 Marionettist
marionettist init

# 可选：同时安装 OpenCode commands 和 agents
marionettist init --with-opencode

# 可选：初始化并安装项目局部 Pi pathway
marionettist init --with-pi

# 已初始化的项目也可以只安装 Pi package
pi install -l npm:marionettist-pathway-pi
```

Pi pathway 只支持项目局部安装。错误执行全局安装后，插件保持禁用并提示使用 `-l` 重新安装。

初始化后，目标项目会得到以下文件：

- `AGENTS.md` — 仓库级 agent 行为
- `marionettist.config.yaml` — 本地 Marionettist 设置
- `docs/project/*` — 工作流和知识路由
- `.aiassistant/rules/*` — 约束规则
- `.agents/skills/*` — 可移植工作流 skills
- `.marionettist/manifest.json` — 用于安全升级

这个仓库是 framework 源码仓库，但普通用户的日常路径是：把 Marionettist 安装到你自己的仓库里，检查已安装文件，然后遵循目标项目本地的 `AGENTS.md` 和文档。

## 首次使用示例

不使用 OpenCode 时，可以给 agent 这样的提示词：

```text
请按照本仓库的 Marionettist 工作流执行。

任务：添加一个小功能：<描述改动>。

从任务 intake 和上下文准备开始。
在 analysis gate 获批前不要开始编码。
```

安装了 OpenCode 后，从 builder 命令开始：

```text
/marionettist 添加一个小功能：<描述改动>
```

Agent 应分类任务、准备所需上下文，在 analysis gate 停下等待批准后再编码。

## 目标项目常用命令

```powershell
# 预览框架更新
marionettist diff

# 应用安全的受管内容更新
marionettist sync

# 诊断已安装的 Marionettist
marionettist doctor
```

更多安装模式、命令面选项、任务 tier 和 gate 行为，请阅读使用指南。

## 面向本仓库的 Framework 维护者

本仓库是 **framework 源码仓库**，不是普通的 target project。

- 维护本仓库时使用 `marionettist self init --apply`。
- 进行自维护检查时使用 `marionettist self doctor` 和 `marionettist self test`。
- 不要在这里运行普通的 `marionettist init`，仿佛它是 target project。
- `templates/` 和 `skills/` 是面向目标项目的可发布资产。
- `.marionettist-self/` 是可删除的本地运行态。
- OpenCode 是可选的。核心 Marionettist 工作流通过文件和提示词即可运行。

## 延伸阅读

| 文档 | 适合人群 | 内容 |
| --- | --- | --- |
| [docs/user-guide/README.zh-CN.md](./docs/user-guide/README.zh-CN.md) | 刚开始采用 Marionettist 的用户 | 推荐阅读路径与用户指南入口 |
| [docs/philosophy.zh-CN.md](./docs/philosophy.zh-CN.md) | 想先理解方法论的初学者 | 为什么 Marionettist 强调先规划、gate 与项目中立 |
| [docs/DESIGN.zh-CN.md](./docs/DESIGN.zh-CN.md) | 技术负责人、架构师、框架评估者 | 设计思想、工作流哲学、资产所有权、非目标 |
| [docs/GUIDELINES.zh-CN.md](./docs/GUIDELINES.zh-CN.md) | 采用 Marionettist 的团队 | 安装、日常使用、任务 tier、gate、升级 |
| [docs/OPENCODE.zh-CN.md](./docs/OPENCODE.zh-CN.md) | 使用 OpenCode 的团队 | Slash commands、agent 角色、模型 profiles、权限姿态 |
| [docs/PI.zh-CN.md](./docs/PI.zh-CN.md) | 使用 Pi 的团队 | 项目局部 package、workflows、固定 subagents、统一模型 profiles |
