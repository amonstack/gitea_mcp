# gitea-mcp

[English](https://github.com/amonstack/gitea_mcp/blob/master/README.md)

> 让 AI 助手通过 MCP 协议管理 Gitea 仓库 —— 议题、标签、里程碑、评论等功能，
> 全部通过 Gitea API 实现。

## 这是什么？

`gitea-mcp` 是一个 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
服务端，将 Gitea 仓库操作暴露为 MCP 工具。连接到 MCP 客户端（Claude Desktop、
opencode、Cursor 等）后，AI 助手即可通过自然语言在 Gitea 实例上创建、查询、
更新和删除议题、标签、里程碑和评论。

服务端通过 stdio 通信，封装了 [Gitea REST API
(`/api/v1`)](https://docs.gitea.com/api/1.22/)。

## 安装

### 从 npm（npmjs.com）安装

```bash
npm install -g @amonstack/gitea-mcp
```

或无需全局安装，直接运行：

```bash
npx @amonstack/gitea-mcp
```

### 从 GitHub Packages 安装

每个版本也会发布到 GitHub Packages。先把 `@amonstack` 作用域指向它，再安装：

```bash
echo "@amonstack:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm install -g @amonstack/gitea-mcp
```

### 从源码构建

```bash
git clone https://github.com/amonstack/gitea-mcp.git
cd gitea-mcp
npm ci
npm run build
node dist/cli.js
```

## 配置

所有变量都是可选的——`gitea-mcp` 会从项目本地 git 配置自动发现 Gitea 实例、仓库和令牌，
因此一次全局安装即可服务多个项目。仅在需要覆盖自动发现结果时才设置它们。

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `GITEA_BASE_URL` | 否 | Gitea 实例地址（如 `https://gitea.example.com`）。未设置时从项目 git 远程地址自动推导。 |
| `GITEA_TOKEN` | 否 | Gitea API 访问令牌。依次从 `.git/config`、git 凭据存储、本变量解析（见[令牌发现](#令牌发现)）。 |
| `GITEA_DEFAULT_OWNER` | 否 | 默认仓库所有者，免去每次传入 `owner` 参数 |
| `GITEA_DEFAULT_REPO` | 否 | 默认仓库名称，免去每次传入 `repo` 参数 |

### 自动发现的工作方式

启动时，`gitea-mcp` 读取 `<cwd>/.git/config` 并推导：

- **实例地址** —— 取自选中远程地址的 host。SSH 远程（`git@host:owner/repo`）会被推导为
  `https://host`。可用 `GITEA_BASE_URL` 覆盖。
- **owner / repo** —— 取自选中远程地址。可用 `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO`
  覆盖，或随时用 `resolve_repo` 工具检测。
- **远程选择** —— 优先 `upstream`，回退 `origin`，再回退其它远程。两者不同时 `resolve_repo`
  会同时返回。

若当前目录没有 git 远程、且未设置 `GITEA_BASE_URL`，服务器**不会启动**——它会打印跳过原因并
以 exit 0 退出。请在克隆的 Gitea 仓库内运行，或显式设置 `GITEA_BASE_URL` / `GITEA_TOKEN`。

### 令牌发现

令牌按以下顺序解析（先匹配者胜出）：

1. `.git/config` 中的 `[gitea "<baseUrl>"]` 段：
   ```ini
   [gitea "https://gitea.example.com"]
       token = <your-token>
   ```
   不带地址的 `[gitea]` 段中的 `token = ...` 作为全局兜底。
2. git 凭据存储（`~/.git-credentials`，或 `$XDG_CONFIG_HOME/git/credentials`）——host 匹配实例
   的那一行，如 `https://oauth2:<token>@gitea.example.com`。
3. `GITEA_TOKEN` 环境变量。

若都未解析到，服务器仍会以匿名方式启动。公开仓库可读；私有仓库和写操作返回 `401`——此时使用
`gitea-configure` 技能引导配置，或设置 `GITEA_TOKEN`。

设置 `GITEA_DEFAULT_OWNER` 和 `GITEA_DEFAULT_REPO` 后，调用工具时可以省略
`owner` 和 `repo` 参数。也可以使用 `resolve_repo` 工具自动从本地 git 仓库
检测这两个值。

## MCP 客户端配置

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "gitea-mcp": {
      "command": "gitea-mcp",
      "env": {
        "GITEA_BASE_URL": "https://gitea.example.com",
        "GITEA_TOKEN": "your-token-here",
        "GITEA_DEFAULT_OWNER": "my-org",
        "GITEA_DEFAULT_REPO": "my-repo"
      }
    }
  }
}
```

如果从源码构建，将 `command` 改为 `node /path/to/gitea-mcp/dist/cli.js`。

### opencode

在 opencode 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "gitea-mcp": {
      "command": "gitea-mcp",
      "env": {
        "GITEA_BASE_URL": "https://gitea.example.com",
        "GITEA_TOKEN": "your-token-here"
      }
    }
  }
}
```

如果从源码构建，将 `command` 改为 `node /path/to/gitea-mcp/dist/cli.js`。

opencode 及其它 AI 工具可加载原生**技能（skills）**——按动作拆分（查找、创建、
更新、打标签、评论、总结、规划里程碑、解析仓库等），教会助手针对该动作的最安全
工作流，含使用前检查与各类陷阱。用 `init` 命令一次性安装，并通过 `--tool` 指定
目标工具（默认 `opencode`）：

```bash
gitea-mcp init                      # opencode（全局 ~/.config/opencode/skills/）
gitea-mcp init --tool claude        # Claude Code（~/.claude/skills/）
gitea-mcp init --tool cursor        # Cursor（~/.cursor/skills/）
gitea-mcp init --project            # 仅当前项目（./.<tool>/skills/）
gitea-mcp init --dir /exact/path    # 自定义路径
```

支持的 `--tool` 取值：`amazon-q`、`antigravity`、`auggie`、`claude`、`cline`、
`codex`、`codebuddy`、`continue`、`costrict`、`crush`、`cursor`、`factory`、
`gemini`、`github-copilot`、`iflow`、`kilocode`、`opencode`、`qoder`、`qwen`、
`roocode`、`windsurf`。路径遵循各工具约定的 skills 目录；如需精确位置请用 `--dir`。
随后重启对应工具。详见下方 [AI 引导与技能](#ai-引导与技能)。

### 其他 MCP 客户端

 任何支持 stdio 方式运行 MCP 服务端的客户端都可以使用。安装完成后，在克隆的 Gitea 仓库内
 吏动即可（配置会自动发现）：

```bash
cd /path/to/your/gitea-repo
gitea-mcp
```

也可显式设置环境变量：

```bash
export GITEA_BASE_URL="https://gitea.example.com"
export GITEA_TOKEN="your-access-token"
gitea-mcp
```

## 可用工具

### 议题 (Issues)

| 工具 | 说明 |
|------|------|
| `list_issues` | 列出议题（可按 `state`、`labels` 筛选及分页） |
| `get_issue` | 按 `index`（议题编号）获取单个议题 |
| `create_issue` | 创建议题，支持 `title`、`body`、`assignee`、`labels`、`milestone` |
| `update_issue` | 更新议题字段或 `state` |
| `delete_issue` | 按 `index` 删除议题 |
| `search_issues` | 跨仓库搜索议题，支持 `query`、`type`、`state`、`labels` |

### 评论 (Comments)

| 工具 | 说明 |
|------|------|
| `list_comments` | 列出某个议题的评论 |
| `create_comment` | 为议题添加评论 |
| `update_comment` | 按 `id` 更新评论 |
| `delete_comment` | 按 `id` 删除评论 |

### 标签 (Labels)

| 工具 | 说明 |
|------|------|
| `list_labels` | 列出仓库标签 |
| `create_label` | 创建标签（`name`、`color`、`description`） |
| `update_label` | 按 `id` 更新标签 |
| `delete_label` | 按 `id` 删除标签 |
| `add_issue_labels` | 按名称给议题添加标签 |
| `remove_issue_label` | 按标签 `id` 从议题移除标签 |
| `replace_issue_labels` | 替换议题上的所有标签 |
| `clear_issue_labels` | 清除议题上的所有标签 |

### 里程碑 (Milestones)

| 工具 | 说明 |
|------|------|
| `list_milestones` | 列出里程碑（可按 `state` 筛选） |
| `get_milestone` | 按 `id` 获取里程碑 |
| `create_milestone` | 创建里程碑，支持 `title`、`description`、`due_on` |
| `update_milestone` | 更新里程碑字段或 `state` |
| `delete_milestone` | 按 `id` 删除里程碑 |

### 仓库辅助 (Repository Helpers)

| 工具 | 说明 |
|------|------|
| `list_my_repos` | 列出当前用户可访问的仓库 |
| `resolve_repo` | 从项目 git 远程地址检测 `baseUrl`、`owner`、`repo`（优先 `upstream`，回退 `origin`） |

## AI 引导与技能

服务端内置了引导内容，让助手正确、安全地使用工具，分三个通道：

- **`instructions`（连接时）** —— 服务端在 MCP 握手时下发一份精炼策略；支持的
  客户端会自动注入系统提示。
- **工具描述** —— 每个工具的描述都标出其关键风险（分页、标签 ID 与名称、破坏性
  作用范围）和最小用法示例。
- **Prompts 与 Resources** —— 工作流模板（`triage_issues`、`summarize_issue`、
  `audit_labels`、`milestone_report`）与按需参考文档（字段参考、标签指南、工具
  食谱），供支持的客户端使用。

### 动作技能

对 opencode 及其它工具，服务端内置了一组**按动作划分的技能**——每个工作流一
个，助手只加载所需指引（避免例如创建时把删除说明一并带入造成幻觉）。用上方展示的
`gitea-mcp init --tool <name>` 命令安装。

| 技能 | 何时触发 |
|------|----------|
| `gitea-find-issues` | 发现 / 读取 / 分流 issues |
| `gitea-create-issue` | 创建 issue（先做查重） |
| `gitea-update-issue` | 编辑字段、关闭、清空负责人/里程碑 |
| `gitea-label-issue` | 为 issue 增加 / 替换 / 移除 / 清空标签 |
| `gitea-manage-labels` | 创建或编辑标签定义 |
| `gitea-comment-issue` | 在 issue 下发表推动讨论的评论 |
| `gitea-summarize-issue` | 读取并总结某 issue 的讨论 |
| `gitea-plan-milestones` | 创建 / 编辑 / 关闭里程碑 |
| `gitea-resolve-repo` | 解析 owner/repo 或列出仓库 |
| `gitea-configure` | 修复连接——实例地址、令牌或 401/403 报错 |

每个技能都是面向 AI 的简短动作流程（目的、何时用、何时不用、规则、先检查什么）。
创建、评论、里程碑三类技能还内嵌**正文模板**（bug / 新功能 / 性能 issue、评论、
里程碑），用以规范助手所写内容的格式。破坏性的单工具操作（删除 issue / 评论 /
标签 / 里程碑）有意仅保留在工具描述里，不会污染创建类工作流。

## 二次开发

```bash
git clone https://github.com/amonstack/gitea-mcp.git
cd gitea-mcp
npm ci
```

| 命令 | 说明 |
|------|------|
| `make lint` | 仅类型检查 |
| `make build` | 将 `src/` 编译到 `dist/` |
| `make test` | 运行单元测试 |
| `make test-watch` | 监听模式运行测试 |
| `make test-integration` | 运行集成测试（需要可用的 Gitea 实例） |
| `make scan` | 用 gitleaks 扫描泄露的密钥（属于 `make verify`） |
| `make dev` | 通过 tsx 直接运行 |

完整的架构说明（模块布局、依赖关系、核心模式，以及新增工具的指引）请参阅
[`docs/architecture.md`](docs/architecture.md)。

## 许可证

MIT
