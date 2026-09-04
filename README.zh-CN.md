<p align="center">
  <img alt="gitea-mcp" src="https://raw.githubusercontent.com/amonstack/gitea_mcp/master/docs/assets/gitea-mcp-banner.png" />
  <h3 align="center">gitea-mcp</h3>
  <p align="center">MCP 服务端，将 Gitea 与 GitLab 的仓库操作——议题、标签、里程碑、评论、合并请求、Release、Actions 与 Wiki——封装为工具，供 AI 助手调用</p>
</p>

---

[![npm version](https://img.shields.io/npm/v/@amonstack/gitea-mcp?logo=npm)](https://www.npmjs.com/package/@amonstack/gitea-mcp)
[![codecov](https://codecov.io/gh/amonstack/gitea_mcp/branch/master/graph/badge.svg)](https://codecov.io/gh/amonstack/gitea_mcp)
[![license](https://img.shields.io/npm/l/@amonstack/gitea-mcp)](https://github.com/amonstack/gitea_mcp/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@amonstack/gitea-mcp?logo=node.js)](https://www.npmjs.com/package/@amonstack/gitea-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-server-6f42c1?logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)

[English](https://github.com/amonstack/gitea_mcp/blob/master/README.md) | **中文文档**

`gitea-mcp` 是一个 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务端，将 Gitea 仓库操作暴露为 MCP 工具。连接到 MCP 客户端（Claude Desktop、opencode、Cursor 等）后，AI 助手即可通过自然语言在 Gitea 实例上创建、查询、更新和删除议题、标签、里程碑、评论、合并请求、Release、Actions 运行与 Wiki 页面。

服务端通过 stdio 通信，封装了 [Gitea REST API (`/api/v1`)](https://docs.gitea.com/api/1.22/)。同时支持 **GitLab**（gitlab.com 与自建实例）作为第二平台——见 [GitLab 支持](#gitlab-支持)。

## 功能特性

- **GitLab 支持** —— 同一套工具运行于 gitlab.com 与自建 GitLab 实例（`MCP_PLATFORM=gitlab` 或 `GITLAB_*` 环境变量契约）
- **完整的 Gitea 项目管理** —— 通过自然语言管理议题、标签、里程碑、评论与主题
- **零配置自动发现** —— 从项目 git 配置读取 `baseUrl`、`owner`、`repo` 与令牌；一次全局安装即可服务多个仓库
- **多来源认证 + 自动容错** —— 依次尝试 `GITEA_REPO_URL` 内嵌的 userinfo、`[gitea]` 配置令牌、`GITEA_TOKEN`、git 自身的凭据机制（`git credential fill`，支持存储文件与 OS 钥匙串），遇 `401`/`403` 自动切换
- **按动作划分的技能** —— 每个工作流一个技能（查找、创建、打标签、评论、规划里程碑……），适配 opencode、Claude Code、Cursor 等
- **客户端无关** —— 兼容任何基于 stdio 的 MCP 客户端；同时内置引导提示与按需参考资源

## 目录

- [功能特性](#功能特性)
- [环境要求](#环境要求)
- [安装](#安装)
- [配置](#配置)
- [MCP 客户端配置](#mcp-客户端配置)
- [可用工具](#可用工具)
- [AI 引导与技能](#ai-引导与技能)
- [二次开发](#二次开发)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 环境要求

- **Node.js ≥ 24** —— 使用全局 `fetch`
- **git ≥ 2.46**（在 `PATH` 上）—— 用于凭据发现（`git config get` / `git credential fill`；`git credential fill` 同时支持所有已配置的凭据 helper，含 OS 钥匙串）。git 完全不可用时，发现降级为仅环境变量来源（`GITEA_REPO_URL` / `GITEA_TOKEN`）/ 匿名模式——`gitea_status` 会报告 `gitAvailable: false`。git < 2.46 时，`.git/config [gitea]` 令牌来源会静默失效（退出码不可区分）；凭据 helper 与环境变量来源仍可用。
- 一个可通过 HTTP 访问的 **Gitea 实例**（自托管或 Gitea Cloud）——或 **GitLab 实例**（gitlab.com 与自建实例）
- 一个 **Gitea API 令牌**（或一条 git 凭据），用于读取公开仓库以外的操作

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
git clone https://github.com/amonstack/gitea_mcp.git
cd gitea_mcp
npm ci
npm run build
node dist/cli.js
```

## 配置

所有变量都是可选的——`gitea-mcp` 会从项目本地 git 配置自动发现 Gitea 实例、仓库和令牌，
因此一次全局安装即可服务多个项目。仅在需要覆盖自动发现结果或限制工具面时才设置它们。

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `GITEA_BASE_URL` | 否 | Gitea 实例地址（如 `https://gitea.example.com`）。未设置时从项目 git 远程地址自动推导。 |
| `GITEA_TOKEN` | 否 | Gitea API 访问令牌。是多个认证候选之一；排在 `GITEA_REPO_URL` userinfo 与 `.git/config [gitea]` 令牌之后、git 凭据机制之前（见[令牌发现](#令牌发现)）。 |
| `GITEA_REPO_URL` | 否 | 一个自包含的带凭据克隆地址——`https://<user>:<token>@<host>[:<port>]/<owner>/<repo>.git`——用单个变量同时提供实例地址、默认 owner/repo 和一个认证候选。各部分分别位于其显式覆盖变量（`GITEA_BASE_URL`、`GITEA_DEFAULT_OWNER`、`GITEA_DEFAULT_REPO`）之下、git 远程之上；纯内存解析，git 不可用时同样生效，内嵌密钥绝不会出现在任何输出中。 |
| `GITEA_DEFAULT_OWNER` | 否 | 默认仓库所有者，免去每次传入 `owner` 参数 |
| `GITEA_DEFAULT_REPO` | 否 | 默认仓库名称，免去每次传入 `repo` 参数 |
| `GITEA_UPLOAD_ROOT` | 否 | 附件上传（`create_issue_attachment` / `create_issue_comment_attachment`）允许读取的根目录。默认为服务器工作目录；解析后的路径必须位于该根目录内。 |
| `MCP_PLATFORM` | 否 | 当前服务进程服务的平台：`gitea`（默认）或 `gitlab`。设置后优先于 [GitLab 支持](#gitlab-支持)中描述的自动判定。 |
| `MCP_TOOL_ALLOWLIST` | 否 | 服务器允许暴露的工具名列表，逗号分隔的 `snake_case` 名称（条目去除首尾空白后精确匹配）。未设置或为空时所有工具可用；条目在当前平台上没有对应工具时启动即报 `Fatal error` 退出。 |
| `GITLAB_BASE_URL` | 否 | GitLab 实例地址（如 `https://gitlab.example.com`）。未设置时从项目 git 远程地址自动推导；其存在（且无 `GITEA_*` 连接变量）会选定 GitLab 模式。 |
| `GITLAB_TOKEN` | 否 | GitLab API 访问令牌。是多个认证候选之一；排在 `GITLAB_REPO_URL` userinfo 与 `.git/config [gitlab]` 令牌之后、git 凭据机制之前。始终以 `Authorization: Bearer <token>` 头发送。 |
| `GITLAB_REPO_URL` | 否 | `GITEA_REPO_URL` 的 GitLab 对应变量——一个带凭据的克隆地址，同时提供实例地址、默认 owner/project 和一个 `Bearer` 认证候选。其存在（且无 `GITEA_*` 连接变量）会选定 GitLab 模式。 |
| `GITLAB_DEFAULT_OWNER` | 否 | 默认项目所有者（GitLab 模式），免去每次传入 `owner` 参数 |
| `GITLAB_DEFAULT_REPO` | 否 | 默认项目名称（GitLab 模式），免去每次传入 `repo` 参数 |

### GitLab 支持

`gitea-mcp` 也可以运行在 **GitLab**（gitlab.com 与自建实例）之上。一个服务进程
只服务一个平台——需要同时使用两者时，请在 MCP 客户端中注册两个条目。平台在启动时
按下述规则选定：

1. 设置了 `MCP_PLATFORM=gitlab`（或 `gitea`）时以其为准；
2. 否则，当设置了 `GITLAB_BASE_URL`、`GITLAB_TOKEN` 或 `GITLAB_REPO_URL` 任意其一，
   且未设置任何 `GITEA_*` 连接变量时，自动选定 GitLab；
3. 默认仍为 `gitea`（既有配置行为不变）。

GitLab 模式下，相同的 68 个业务工具名运行在 GitLab REST API v4（`/api/v4`）之上，
并以 `configure_gitlab` / `gitlab_status` 取代 `configure_gitea` / `gitea_status`。
发现机制与 Gitea 契约一致：`GITLAB_REPO_URL` 仓库地址、git 配置中的
`[gitlab "<baseUrl>"] token`、`GITLAB_TOKEN`
以及 `git credential fill`——所有凭据只以 `Authorization: Bearer <token>` 头发送
（绝不通过 URL 查询参数传递）。

覆盖说明——无 GitLab 对应物的操作会返回类型化的 `GitLabUnsupportedError`，仅
Premium/Ultimate 可用的操作会返回 `GitLabTierError`（都不是原始 API 错误）：

- **完全可用**：议题、评论（列出/创建）、标签、里程碑、主题、合并请求、
  Release（列出/创建/按 tag 查询）、Wiki 页面、流水线（Actions 工具组：
  列出/查询/取消/重跑）。
- **付费层限制（GitLab Premium/Ultimate）**：议题依赖/阻塞工具组
  （`list_issue_dependencies`、`add/remove_issue_dependency`、`list_issue_blocks`、
  `add/remove_issue_block`、`check_issue_blocked`）——GitLab Free 会拒绝阻塞类
  链接类型。
- **GitLab 上不可用**：议题附件工具；`update_comment` / `delete_comment`
  （GitLab 评论按议题内 note 寻址）；`get_release`、`update_release`、
  `delete_release`（GitLab Release 以 `tag_name` 寻址——请用
  `get_release_by_tag`）；`rerun_action_run_failed_jobs`；`list_wiki_revisions`；
  `merge_pull_request` 的 `rebase` / `rebase-merge` 策略；以及 release 的
  `draft`/`prerelease` 标志、`update_repo` 的 `website`/`private`、wiki 的
  `message`、`search_issues` 的 `labels` 过滤参数。
- **寻址规则**遵循 GitLab 约定：议题与合并请求按项目内 `iid`，里程碑与流水线按
  数字 ID，Release 按 `tag_name`，Wiki 按 slug；响应返回 GitLab 原生 JSON
  （`iid`、`web_url`、`references` 等）。
- 内置动作技能与三个参考资源面向 Gitea 场景，仅在 Gitea 平台注册；GitLab 的
  使用指引随服务端 instructions 下发。

### 自动发现的工作方式

启动时，`gitea-mcp` 读取 `<cwd>/.git/config` 并推导：

- **实例地址** —— 取自选中远程地址的 host。SSH 远程（`git@host:owner/repo`）会被推导为
  `https://host`。可用 `GITEA_BASE_URL` 覆盖。
- **owner / repo** —— 取自选中远程地址。可用 `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO`
  覆盖，或随时用 `resolve_repo` 工具检测。
- **远程选择** —— 优先 `upstream`，回退 `origin`，再回退其它远程。两者不同时 `resolve_repo`
  会同时返回。

`GITEA_REPO_URL`——形如 `https://<user>:<token>@<host>[:<port>]/<owner>/<repo>.git`
的一个带凭据克隆地址——是上述整条链路的自包含替代：一个变量同时提供实例地址、
默认 owner/repo 和一个认证候选（纯内存解析，git 不可用时同样生效）。其各部分
位于显式覆盖变量 `GITEA_BASE_URL` / `GITEA_DEFAULT_OWNER` / `GITEA_DEFAULT_REPO`
之下、git 远程之上；原始地址绝不会被回显——`resolve_repo` 会对报告的远程地址
剥离内嵌的 userinfo。

若当前目录没有 git 远程、且未设置 `GITEA_BASE_URL` 或 `GITEA_REPO_URL`，服务器会
以**未配置**状态启动——
`tools/list` 完全可用，但业务工具调用时返回 `NotConfiguredError`。使用 `configure_gitea`
工具在运行时配置连接（仅当前会话，不持久化），或在克隆的 Gitea 仓库内运行，或显式设置
`GITEA_BASE_URL` / `GITEA_TOKEN`。

### 令牌发现

`gitea-mcp` 从四个来源收集认证**候选**，按以下优先级排序：

1. `GITEA_REPO_URL` 仓库地址——当其 host 与实例一致时，内嵌的 `user:secret` userinfo
   会成为最高优先级候选，并按与 git 凭据相同的用户名启发式确定尝试顺序（真实用户名
   先试 `basic`；`oauth2` / `x-oauth-basic` / 令牌写在用户名位置时先试 `token`）。
2. `.git/config` 中的 `[gitea "<baseUrl>"]` 段（不带地址的 `[gitea]` 段作为全局兜底），通过
   `git config get --url=<baseUrl> gitea.token` 读取：
   ```ini
   [gitea "https://gitea.example.com"]
       token = <your-token>
   ```
   始终以 `Authorization: token <token>` 发送。
3. `GITEA_TOKEN` 环境变量 —— 同样以 `Authorization: token` 发送。运行时无法使用 `git` 时，
   上述环境变量来源是仅剩的候选。
4. git 自身会为实例 host 使用的凭据，通过 `git credential fill` 获取（配置链 + 凭据 helper——
   存储文件、OS 钥匙串或你配置的任何 helper）。同一 host 存在多个身份时由 git 选取；
   `configure_gitea` 的 `username` 可将查找收窄到该身份。

git 凭据的 `password` 字段可能是真正的 PAT、账户登录密码，或 OAuth token —— git 存的是
用户在密码提示里输入的任何内容，服务端无法静态区分。因此凭据会以**两种认证方案**
依次尝试：

- `Authorization: Basic <base64(user:pass)>` —— 账户密码和 PAT 都能通过（Gitea 会校验用户名与
  密钥属主一致）。
- `Authorization: token <secret>` —— 仅对真正的 PAT 有效。

尝试顺序由用户名启发式决定：约定用户名（`oauth2`、`x-oauth-basic`、空）先试 `token`；真实用户名
（如 `alice`）先试 `basic`。

**容错。** 遇到 `401`/`403`，服务端会切换到下一个方案/候选并重试同一请求；一旦某组凭据成功，
它会被锁定到本会话结束（不再重复探测）。非认证类错误（`404`、`500`、网络错误）立即向上抛出，
**不会**触发重试。

**诊断。** `gitea_status` 工具（见[仓库辅助](#仓库辅助-repository-helpers)）返回当前状态的脱敏
视图 —— 哪个候选处于 active、哪些已耗尽、最近一次的状态码 —— 永不暴露密钥本身。排查 `401` 时
用它代替盲猜。

若所有来源都未解析到凭据，服务器仍会以匿名方式启动。公开仓库可读；私有仓库和写操作返回
`401` —— 此时使用 `gitea-configure` 技能引导配置，或设置 `GITEA_TOKEN`。

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
`gemini`、`github-copilot`、`iflow`、`kimi`、`kilocode`、`opencode`、`qoder`、`qwen`、
`roocode`、`windsurf`。路径遵循各工具约定的 skills 目录；如需精确位置请用 `--dir`。
随后重启对应工具。详见下方 [AI 引导与技能](#ai-引导与技能)。

### 其他 MCP 客户端

 任何支持 stdio 方式运行 MCP 服务端的客户端都可以使用。安装完成后，在克隆的 Gitea 仓库内
 启动即可（配置会自动发现）：

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

> 下表描述工具契约。在 GitLab 平台上，相同的 68 个业务工具运行于 GitLab REST
> API v4（并以 `configure_gitlab` / `gitlab_status` 取代 `configure_gitea` /
> `gitea_status`）——各工具的覆盖差异见 [GitLab 支持](#gitlab-支持)。

### 议题 (Issues)

| 工具 | 说明 |
|------|------|
| `list_issues` | 列出议题（可按 `state`、`labels` 筛选及分页） |
| `get_issue` | 按 `index`（议题编号）获取单个议题 |
| `create_issue` | 创建议题，支持 `title`、`body`、`assignee`、`labels`、`milestone` |
| `update_issue` | 更新议题字段或 `state` |
| `delete_issue` | 按 `index` 删除议题 |
| `search_issues` | 跨仓库搜索议题，支持 `query`、`type`、`state`、`labels` |

### 议题依赖 (Issue Dependencies)

| 工具 | 说明 |
|------|------|
| `list_issue_dependencies` | 列出阻塞某议题的议题（`blocked by`），支持 page/limit 分页 |
| `add_issue_dependency` | 让一个议题依赖于（被阻塞于）另一个议题 — `dep_index` 为阻塞者 |
| `remove_issue_dependency` | 移除依赖，使议题不再被 `dep_index` 阻塞 |
| `list_issue_blocks` | 列出被某议题阻塞的议题（`blocking`），支持 page/limit 分页 |
| `add_issue_block` | 让一个议题阻塞另一个议题 — `index` 为阻塞者，`dep_index` 被阻塞 |
| `remove_issue_block` | 移除阻塞，使 `dep_index` 不再被 `index` 阻塞 |
| `check_issue_blocked` | 检查议题是否被未关闭的依赖阻塞 — 一次调用返回 `blocked`、`blockers`、`total_dependencies`、`open_blockers`（内部聚合 `list_issue_dependencies`） |

> **说明：** 依赖类工具要求仓库开启 `enable_issue_dependencies`（返回 404 表示未开启）。
> `dep_owner` / `dep_repo` 默认与该议题同库，也可指向其它仓库（需实例开启
> `AllowCrossRepositoryDependencies`）。变更类工具返回路径议题的 JSON。

### 评论 (Comments)

| 工具 | 说明 |
|------|------|
| `list_comments` | 列出某个议题的评论 |
| `create_comment` | 为议题添加评论 |
| `update_comment` | 按 `id` 更新评论 |
| `delete_comment` | 按 `id` 删除评论 |

### 议题附件 (Issue Attachments)

| 工具 | 说明 |
|------|------|
| `create_issue_attachment` | 将本地文件（`file_path`）上传为议题（`index`）的附件，可选 `name` 重命名。路径受限：必须位于上传根目录（cwd 或 `GITEA_UPLOAD_ROOT`）内，且通过扩展名白名单与大小上限 |
| `list_issue_attachments` | 列出议题的附件 |
| `get_issue_attachment` | 按 `attachment_id` 获取单个附件的元数据 |
| `edit_issue_attachment` | 按 `attachment_id` 重命名附件 |
| `delete_issue_attachment` | 按 `attachment_id` 删除附件 |
| `create_issue_comment_attachment` | 将本地文件上传为评论（`comment_id`）的附件，可选 `name` 重命名；路径限制与 `create_issue_attachment` 相同 |

> **说明：** 附件工具的 `file_path` 读取运行 `gitea-mcp` 的机器上的本地文件。
> 实例可能禁用附件功能（返回 404 表示未开启），并限制上传大小（超限返回 413/422）。

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

### 主题 (Topics)

| 工具 | 说明 |
|------|------|
| `list_topics` | 列出仓库的主题（标签） |
| `replace_topics` | 用指定列表替换全部主题（传 `[]` 即清空） |
| `add_topic` | 按名称添加单个主题 |
| `remove_topic` | 按名称移除单个主题 |

### 合并请求 (Pull Requests)

| 工具 | 说明 |
|------|------|
| `list_pull_requests` | 列出仓库的 PR（按状态、标签、排序、里程碑筛选） |
| `get_pull_request` | 按 PR 编号获取单个 PR 详情 |
| `create_pull_request` | 创建 PR（标题、源分支 head、目标分支 base、正文） |
| `update_pull_request` | 编辑 PR 或关闭/重开（state: open \| closed） |
| `merge_pull_request` | 合并 PR（策略: merge \| squash \| rebase \| rebase-merge）—— **不可逆** |
| `is_pull_merged` | 检查 PR 是否已合并 |
| `list_pull_commits` | 列出 PR 中的提交 |
| `list_pull_files` | 列出 PR 变更的文件 |

> **说明：** PR 与 issue 共享编号空间（PR #N == Issue #N）。PR 的评论、标签、
> 里程碑复用 **issue** 工具——把 PR 编号当作 `index` 传入即可。只有 PR 专属操作
> 才使用上表工具。

### Actions

| 工具 | 说明 |
|------|------|
| `list_action_runs` | 列出 Gitea Actions 工作流运行（按 `status`、`branch`、`event`、`actor`、`head_sha` 筛选） |
| `get_action_run` | 按 `runId` 获取单个工作流运行——取消/重试前检查状态 |
| `cancel_action_run` | 取消**进行中**的运行（queued、in_progress、running）——部分破坏性 |
| `rerun_action_run` | 重试整个**已完成**的运行——需 Gitea 1.26.0+ |
| `rerun_action_run_failed_jobs` | 仅重试已完成运行中失败的 job——需 Gitea 1.26.0+ |

> **说明：** 取消仅对进行中的运行有效；重试仅对已完成的运行有效。操作前务必先调用
> `get_action_run` 确认当前状态，并向用户确认 `runId` 后再取消或重试。

### Releases (版本发布)

| 工具 | 说明 |
|------|------|
| `list_releases` | 列出仓库的版本发布（按 `draft`、`prerelease`、page/limit 筛选） |
| `get_release` | 按数字 `id` 获取单个版本发布 |
| `get_release_by_tag` | 按 `tag` 标签名获取版本发布（如 `v1.2.0`） |
| `create_release` | 创建版本发布（`tag_name`、`name` 标题、`body` 发行说明、`target_commitish`、`draft`、`prerelease`） |
| `update_release` | 更新版本发布的标题、内容、draft/prerelease 标记或重命名 tag |
| `delete_release` | 按 `id` 删除版本发布——**不可逆** |

> **说明：** 版本发布用数字 `id` 标识（来自 `list_releases` 或 `get_release_by_tag`），
> 而非 tag 名。`create_release` 和 `update_release` 负责维护标题（`name`）与发行说明
> （`body`）。删除版本发布时是否一并删除底层 Git tag 取决于 Gitea 配置。

### 仓库 (Repository)

| 工具 | 说明 |
|------|------|
| `update_repo` | 编辑仓库元数据——`description`、`name`（重命名）、`website`、`private`、`default_branch`（仅传入的字段会更新） |

> **说明：** `name` 会重命名仓库并改变其 URL，操作前请向用户确认。修改仓库描述时
> 只需传入 `description`（传空字符串可清空）。

### Wiki

| 工具 | 说明 |
|------|------|
| `list_wiki_pages` | 列出仓库全部 wiki 页面（仅元数据，page/limit 分页） |
| `get_wiki_page` | 按 `pageName` 获取一个 wiki 页面——`content` 以纯 Markdown 返回（已解码 base64） |
| `create_wiki_page` | 创建 wiki 页面（`title`、纯 Markdown `content`、可选 `message`） |
| `update_wiki_page` | 按 `pageName` 编辑 wiki 页面；传 `title` 可重命名（仅传入的字段会更新） |
| `delete_wiki_page` | 按 `pageName` 删除 wiki 页面——只能从 wiki git 克隆中恢复 |
| `list_wiki_revisions` | 按 `pageName` 列出一个 wiki 页面的修订历史 |

> **说明：** `pageName` 是 wiki URL 中显示的页面标题（如 `Home`、
> `Getting-Started`）。`Home` 是落地页，`_Sidebar` 与 `_Footer` 是布局页。页面
> 内容始终是纯 Markdown——工具会自动处理 API 的 base64 编解码。需要仓库已开启
> wiki 功能（否则返回 404）。

### 项目看板 (Projects — 占位工具)

| 工具 | 说明 |
|------|------|
| `list_projects` | 列出项目看板（看板视图）—— **占位工具：始终返回 `[]`**（Gitea 尚无项目看板 REST API） |
| `get_project` | 按 `id` 获取项目看板 —— **占位工具：始终返回未找到**（Gitea 尚无项目看板 REST API） |

> **说明：** 这两个工具作为稳定契约存在，让规划类工作流可以查询项目看板而不报错。
> 它们不会发起 HTTP 请求，始终返回空列表 / 未找到。当 Gitea 项目看板 REST API
> 落地后（[go-gitea/gitea#36824](https://github.com/go-gitea/gitea/issues/36824)），
> 真实的 HTTP 调用将被透明接入。

### 仓库辅助 (Repository Helpers)

| 工具 | 说明 |
|------|------|
| `list_my_repos` | 列出当前用户可访问的仓库 |
| `resolve_repo` | 从项目 git 远程地址检测 `baseUrl`、`owner`、`repo`（优先 `upstream`，回退 `origin`）；回显的远程地址会剥离内嵌的 userinfo |
| `gitea_status` | 查看认证处理状态 —— active 候选、已耗尽候选、最近一次错误（脱敏；永不暴露密钥） |
| `configure_gitea` | 在运行时配置 Gitea 连接（仅当前会话，不持久化）。接受 `base_url`、`owner`、`repo`、`username`。提供 `base_url` 或 `username` 会触发从本地来源重新发现凭据——令牌永不通过此工具传递 |

## AI 引导与技能

服务端内置了引导内容，让助手正确、安全地使用工具，分三个通道：

- **`instructions`（连接时）** —— 服务端在 MCP 握手时下发一份精炼策略；支持的
  客户端会自动注入系统提示。
- **工具描述** —— 每个工具的描述都标出其关键风险（分页、标签 ID 与名称、破坏性
  作用范围）和最小用法示例。
- **Prompts 与 Resources** —— 工作流模板（`triage_issues`、`summarize_issue`、
  `triage_pull_requests`、`summarize_pull_request`、`audit_labels`、
  `milestone_report`、`triage_action_runs`）与按需参考文档（字段参考、标签指南、
  工具食谱），供支持的客户端使用。

### 动作技能

对 opencode 及其它工具，服务端内置了一组**按动作划分的技能**——每个工作流一
个，助手只加载所需指引（避免例如创建时把删除说明一并带入造成幻觉）。用上方展示的
`gitea-mcp init --tool <name>` 命令安装。

| 技能 | 何时触发 |
|------|----------|
| `gitea-find-issues` | 发现 / 读取 / 分流 issues |
| `gitea-update-issue` | 编辑字段、关闭、清空负责人/里程碑 |
| `gitea-label-issue` | 为 issue 增加 / 替换 / 移除 / 清空标签 |
| `gitea-manage-labels` | 创建或编辑标签定义 |
| `gitea-comment-issue` | 在 issue 下发表推动讨论的评论 |
| `gitea-summarize-issue` | 读取并总结某 issue 的讨论 |
| `gitea-plan-milestones` | 创建 / 编辑 / 关闭里程碑 |
| `gitea-resolve-repo` | 解析 owner/repo 或列出仓库 |
| `gitea-configure` | 修复连接——实例地址、令牌或 401/403 报错 |
| `gitea-find-pulls` | 发现 / 读取 PR 及其提交与变更文件 |
| `gitea-create-pull` | 创建 PR（先做查重） |
| `gitea-update-pull` | 编辑字段、关闭不合并、重开、WIP 切换 |
| `gitea-merge-pull` | 合并 PR（先检查可合并性并经用户确认） |
| `gitea-summarize-pull` | 读取并总结 PR 以供审查 |
| `gitea-find-actions` | 发现 / 读取 Actions 工作流运行 |
| `gitea-cancel-action` | 取消进行中的运行（先检查状态并经用户确认） |
| `gitea-rerun-action` | 重试已完成的运行——全部或仅失败的 job |
| `gitea-write-wiki` | 按内置开源 wiki 格式规范编写 / 编辑 wiki 页面 |

每个技能都是面向 AI 的简短动作流程（目的、何时用、何时不用、规则、先检查什么）。
评论、里程碑两类技能还内嵌**正文模板**（评论、
里程碑），用以规范助手所写内容的格式。破坏性的单工具操作（删除 issue / 评论 /
标签 / 里程碑）有意仅保留在工具描述里，不会污染创建类工作流。

## 二次开发

```bash
git clone https://github.com/amonstack/gitea_mcp.git
cd gitea_mcp
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
| `make verify` | 完整 CI 门禁：安装依赖、密钥扫描、类型检查、构建、单元测试与冒烟运行 |
| `make dev` | 通过 tsx 直接运行 |

完整的架构说明（模块布局、依赖关系、核心模式，以及新增工具的指引）请参阅
[`docs/architecture.md`](docs/architecture.md)。

## 参与贡献

欢迎贡献！

- 发现 bug 或有功能建议？请[提交一个 issue](https://github.com/amonstack/gitea_mcp/issues)。
- 欢迎提交 Pull Request。本仓库遵循 [Conventional Commits](https://www.conventionalcommits.org/)，工作流见 [`AGENTS.md`](AGENTS.md) —— 首次 PR 前请先浏览一遍。
- 模块布局、依赖关系、核心模式以及新增工具的指引，请参阅 [`docs/architecture.md`](docs/architecture.md)。

## 许可证

[MIT](LICENSE) —— 版权所有 (c) 2026 [amonstack](https://github.com/amonstack)。
