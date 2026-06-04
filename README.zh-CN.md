# gitea-mcp

[English](README.md)

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

### 从 GitHub Packages 安装

```bash
npm set @amonstack:registry https://npm.pkg.github.com
npm set //npm.pkg.github.com/:_authToken <你的 GitHub PAT>
npm install -g @amonstack/gitea-mcp
```

GitHub PAT 需要 `read:packages` 权限。

### 从源码构建

```bash
git clone https://github.com/amonstack/gitea-mcp.git
cd gitea-mcp
npm ci
npm run build
node dist/cli.js
```

## 配置

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `GITEA_BASE_URL` | 是 | Gitea 实例地址（如 `https://gitea.example.com`） |
| `GITEA_TOKEN` | 是 | Gitea API 访问令牌 |
| `GITEA_DEFAULT_OWNER` | 否 | 默认仓库所有者，免去每次传入 `owner` 参数 |
| `GITEA_DEFAULT_REPO` | 否 | 默认仓库名称，免去每次传入 `repo` 参数 |

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

### 其他 MCP 客户端

任何支持 stdio 方式运行 MCP 服务端的客户端都可以使用。安装完成后设置环境
变量并启动：

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
| `resolve_repo` | 从本地 git 仓库的远程地址自动检测 `owner` 和 `repo` |

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
| `make dev` | 通过 tsx 直接运行 |

### 项目结构

```
src/
  cli.ts           # 入口文件
  server.ts        # MCP 服务端搭建与工具注册
  tools.ts         # 所有工具的 Zod 输入模式定义
  gitea-client.ts  # 封装 Gitea /api/v1 端点的 REST 客户端
```

## 许可证

MIT
