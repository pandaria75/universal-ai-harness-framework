# Pi Pathway

`marionettist-pathway-pi` 为 Pi 提供 Marionettist skills、prompt templates、七个默认 agents，以及标准 `pi-subagents` runtime。

## 项目局部安装

在目标项目中执行：

```bash
pi install -l npm:marionettist-pathway-pi
```

也可以同时初始化框架和 Pi package：

```bash
marionettist init --with-pi
```

不支持全局安装。Package manifest 只静态暴露局部安装守卫；守卫确认最近的 `.pi/settings.json` 包含当前 package 后，才动态加载 skills、prompts 和 subagent tool。

## 资源

- Skills 从框架根目录 `skills/` 生成。
- Prompt templates 提供 `/marionettist` 和各个聚焦 workflow wrapper。
- 标准 `subagent` tool 会发现 builder、planner、coder、reviewer、critic、indexer 和 validator，它们以 `marionettist-*` package agents 的形式提供。
- 如果用户级或项目级已经安装 `pi-subagents`，pathway 会复用该 runtime，不会重复注册 `subagent` 或 `subagent_wait`。
- 项目中的 `.pi/agents/**/*.md` 会被递归发现；既可以增加任意 agent，也可以通过相同的 `name` 覆盖 package 默认 agent。
- 调用方式遵循 `pi-subagents`，例如 `subagent(agent="marionettist-indexer", task="梳理认证流程")`。

例如，目标项目可以增加 `.pi/agents/domain-expert.md`：

```markdown
---
name: domain-expert
description: Understands the project's domain rules and terminology.
tools: read, grep, find, ls
model: deepseek/deepseek-v4-pro
---

Study the relevant project context and answer with evidence from the repository.
```

主 agent 随后即可用 `agent: "domain-expert"` 调用 `subagent`，无需重新构建 package 或注册 extension。

## 统一配置

Pi 与 OpenCode 共用 `.marionettist/model-profiles.yml`。执行 `marionettist init --with-pi` 或 `marionettist sync --with-pi` 时，Marionettist 会把解析后的模型写入 `.pi/settings.json` 的 `subagents.agentOverrides`，同时保留其他设置和每个 agent 的附加配置。只执行 `pi install` 时，package agents 会继承当前 Pi 模型；如需应用各角色的统一模型 profiles，请执行 `marionettist sync --with-pi`。Pi 不会静默替换不可用的模型 ID。使用以下命令检查 package scope 和模型可用性：

```bash
marionettist doctor --with-pi
```

## 生命周期

```bash
marionettist diff --with-pi
marionettist sync --with-pi
marionettist doctor --with-pi
```

`diff` 只读；`sync` 保留 manifest 中记录的 Pi pathway，并通过 Pi package manager 协调项目局部 package。
