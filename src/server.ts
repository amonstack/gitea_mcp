import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GiteaClient } from "./gitea-client.js";
import {
  ListIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  DeleteIssueSchema,
  SearchIssuesSchema,
  ListCommentsSchema,
  CreateCommentSchema,
  UpdateCommentSchema,
  DeleteCommentSchema,
  ListLabelsSchema,
  CreateLabelSchema,
  UpdateLabelSchema,
  DeleteLabelSchema,
  AddIssueLabelsSchema,
  RemoveIssueLabelSchema,
  ReplaceIssueLabelsSchema,
  ClearIssueLabelsSchema,
  ListMilestonesSchema,
  GetMilestoneSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  DeleteMilestoneSchema,
  ResolveRepoSchema,
  ListMyReposSchema,
} from "./tools.js";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

function parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
  // SSH: git@host:owner/repo.git
  const sshMatch = remoteUrl.match(/^[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  // HTTPS: https://host/owner/repo.git
  const httpsMatch = remoteUrl.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  return null;
}

export async function createServer(
  baseUrl: string,
  token: string,
  defaultOwner?: string,
  defaultRepo?: string,
) {
  const client = new GiteaClient({ baseUrl, token });

  const server = new McpServer(
    {
      name: "gitea-mcp",
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  function resolve(input: { owner?: string; repo?: string }) {
    const owner = input.owner || defaultOwner;
    const repo = input.repo || defaultRepo;
    if (!owner || !repo) {
      throw new Error(
        "owner and repo are required. Provide them directly, set GITEA_DEFAULT_OWNER/GITEA_DEFAULT_REPO env vars, or use resolve_repo to detect from git.",
      );
    }
    return { owner, repo };
  }

  // ── Issue CRUD ──

  server.registerTool(
    "list_issues",
    {
      description: "List issues in a Gitea repository",
      inputSchema: ListIssuesSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const issues = await client.listIssues({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_issue",
    {
      description: "Get a single issue from a Gitea repository",
      inputSchema: GetIssueSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const issue = await client.getIssue(owner, repo, input.index);
      return {
        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_issue",
    {
      description: "Create a new issue in a Gitea repository",
      inputSchema: CreateIssueSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const issue = await client.createIssue({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_issue",
    {
      description: "Update an existing issue in a Gitea repository",
      inputSchema: UpdateIssueSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const issue = await client.updateIssue({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_issue",
    {
      description: "Delete an issue from a Gitea repository",
      inputSchema: DeleteIssueSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      await client.deleteIssue(owner, repo, input.index);
      return {
        content: [{ type: "text", text: `Issue #${input.index} deleted.` }],
      };
    },
  );

  server.registerTool(
    "search_issues",
    {
      description: "Search issues across Gitea repositories",
      inputSchema: SearchIssuesSchema.shape,
    },
    async (input) => {
      const issues = await client.searchIssues(input);
      return {
        content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
      };
    },
  );

  // ── Comments ──

  server.registerTool(
    "list_comments",
    {
      description: "List comments on a Gitea issue",
      inputSchema: ListCommentsSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const comments = await client.listComments(owner, repo, input.index);
      return {
        content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_comment",
    {
      description: "Create a comment on a Gitea issue",
      inputSchema: CreateCommentSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const comment = await client.createComment(owner, repo, input.index, input.body);
      return {
        content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_comment",
    {
      description: "Update an existing comment on a Gitea issue",
      inputSchema: UpdateCommentSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const comment = await client.updateComment(owner, repo, input.id, input.body);
      return {
        content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_comment",
    {
      description: "Delete a comment from a Gitea issue",
      inputSchema: DeleteCommentSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      await client.deleteComment(owner, repo, input.id);
      return {
        content: [{ type: "text", text: `Comment #${input.id} deleted.` }],
      };
    },
  );

  // ── Labels ──

  server.registerTool(
    "list_labels",
    {
      description: "List labels in a Gitea repository",
      inputSchema: ListLabelsSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const labels = await client.listLabels(owner, repo, input.page, input.limit);
      return {
        content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_label",
    {
      description: "Create a new label in a Gitea repository",
      inputSchema: CreateLabelSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const label = await client.createLabel({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_label",
    {
      description: "Update an existing label in a Gitea repository",
      inputSchema: UpdateLabelSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const label = await client.updateLabel({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_label",
    {
      description: "Delete a label from a Gitea repository",
      inputSchema: DeleteLabelSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      await client.deleteLabel(owner, repo, input.id);
      return {
        content: [{ type: "text", text: `Label #${input.id} deleted.` }],
      };
    },
  );

  server.registerTool(
    "add_issue_labels",
    {
      description: "Add labels to a Gitea issue",
      inputSchema: AddIssueLabelsSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const labels = await client.addIssueLabels(owner, repo, input.index, input.labels);
      return {
        content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
      };
    },
  );

  server.registerTool(
    "remove_issue_label",
    {
      description: "Remove a label from a Gitea issue by label ID",
      inputSchema: RemoveIssueLabelSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      await client.removeIssueLabel(owner, repo, input.index, input.id);
      return {
        content: [{ type: "text", text: `Label #${input.id} removed from issue #${input.index}.` }],
      };
    },
  );

  server.registerTool(
    "replace_issue_labels",
    {
      description: "Replace all labels on a Gitea issue",
      inputSchema: ReplaceIssueLabelsSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const labels = await client.replaceIssueLabels(owner, repo, input.index, input.labels);
      return {
        content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
      };
    },
  );

  server.registerTool(
    "clear_issue_labels",
    {
      description: "Remove all labels from a Gitea issue",
      inputSchema: ClearIssueLabelsSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      await client.clearIssueLabels(owner, repo, input.index);
      return {
        content: [{ type: "text", text: `All labels cleared from issue #${input.index}.` }],
      };
    },
  );

  // ── Milestones ──

  server.registerTool(
    "list_milestones",
    {
      description: "List milestones in a Gitea repository",
      inputSchema: ListMilestonesSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const milestones = await client.listMilestones(owner, repo, input.state, input.page, input.limit);
      return {
        content: [{ type: "text", text: JSON.stringify(milestones, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_milestone",
    {
      description: "Get a single milestone from a Gitea repository",
      inputSchema: GetMilestoneSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const milestone = await client.getMilestone(owner, repo, input.id);
      return {
        content: [{ type: "text", text: JSON.stringify(milestone, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_milestone",
    {
      description: "Create a new milestone in a Gitea repository",
      inputSchema: CreateMilestoneSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const milestone = await client.createMilestone({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(milestone, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_milestone",
    {
      description: "Update an existing milestone in a Gitea repository",
      inputSchema: UpdateMilestoneSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      const milestone = await client.updateMilestone({ ...input, owner, repo });
      return {
        content: [{ type: "text", text: JSON.stringify(milestone, null, 2) }],
      };
    },
  );

  server.registerTool(
    "delete_milestone",
    {
      description: "Delete a milestone from a Gitea repository",
      inputSchema: DeleteMilestoneSchema.shape,
    },
    async (input) => {
      const { owner, repo } = resolve(input);
      await client.deleteMilestone(owner, repo, input.id);
      return {
        content: [{ type: "text", text: `Milestone #${input.id} deleted.` }],
      };
    },
  );

  // ── Helpers ──

  server.registerTool(
    "resolve_repo",
    {
      description: "Detect owner and repo from a git repository's remote URL",
      inputSchema: ResolveRepoSchema.shape,
    },
    async (input) => {
      const dir = input.path || process.cwd();
      const gitConfigPath = join(dir, ".git", "config");
      const content = await readFile(gitConfigPath, "utf-8");
      const remoteMatch = content.match(/\[remote "origin"\]\s*\n(?:.*\n)*?\s*url\s*=\s*(.+)$/m);
      if (!remoteMatch) {
        throw new Error(`No "origin" remote found in ${gitConfigPath}`);
      }
      const remoteUrl = remoteMatch[1].trim();
      const parsed = parseGitRemoteUrl(remoteUrl);
      if (!parsed) {
        throw new Error(`Cannot parse remote URL: ${remoteUrl}`);
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ...parsed, remote_url: remoteUrl }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "list_my_repos",
    {
      description: "List all repositories the authenticated user has access to",
      inputSchema: ListMyReposSchema.shape,
    },
    async (input) => {
      const repos = await client.listMyRepos(input.page, input.limit);
      return {
        content: [{ type: "text", text: JSON.stringify(repos, null, 2) }],
      };
    },
  );

  return server;
}

export async function runServer(
  baseUrl: string,
  token: string,
  defaultOwner?: string,
  defaultRepo?: string,
) {
  const server = await createServer(baseUrl, token, defaultOwner, defaultRepo);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
