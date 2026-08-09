# Pi Pathway

`marionettist-pathway-pi` 为 Pi 提供 Marionettist skills、prompt templates 和七个固定 subagent 角色。

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
- `marionettist_subagent` 只接受 builder、planner、coder、reviewer、critic、indexer 和 validator。
- 子 agent 使用隔离的 Pi 进程，并禁止递归委派。

## 统一配置

Pi 与 OpenCode 共用 `.marionettist/model-profiles.yml`。Pi 不会静默替换不可用的模型 ID。使用以下命令检查 package scope 和模型可用性：

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
