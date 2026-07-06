import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
import { parseRemotes, selectRemote } from "./git-config.js";

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export async function createServer(
  baseUrl: string,
  token?: string,
  defaultOwner?: string,
  defaultRepo?: string,
) {
  const client = new GiteaClient({ baseUrl, token });

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  let instructions: string | undefined;
  try {
    instructions = await readFile(join(moduleDir, "assets", "instructions.md"), "utf-8");
  } catch {
    // Guidance assets may be absent during a partial build or `make dev` that did
    // not run copy-assets; the server still works, just without the instructions hint.
  }

  const server = new McpServer(
    {
      name: "gitea-mcp",
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
      instructions,
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
      description:
        "List issues in one Gitea repository. Paginated: page is 1-based, limit <= 100; keep paging until a page returns fewer than `limit`. Filters: state (default open), labels (comma-separated NAMES). RISK: Gitea may include pull requests here; to list only issues use search_issues with type='issues'. Example: list_issues({ state: 'open', page: 1, limit: 50 })",
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
      description:
        "Fetch one issue by its `index` — the number shown in the issue URL (e.g. #42), NOT the internal `id`. Use to read the full body, labels, assignee, or milestone of a single issue.",
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
      description:
        "Create an issue. `title` is required. `labels` takes label IDs (numbers) — call list_labels first to map names to IDs, or add labels by name after creation via add_issue_labels. `assignees` is an array of usernames. Returns the created issue including its `number`.",
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
      description:
        "Update one issue by `index` (PATCH: only provided fields change). RISK: passing `labels` REPLACES the entire label set (give the full desired ID list) — to change a single label use add_issue_labels/remove_issue_label instead. `state` is 'open' or 'closed'; set milestone by ID.",
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
      description:
        "PERMANENTLY delete an issue by `index`. IRREVERSIBLE (no recycle bin) and may fail if the instance disallows deletion. Confirm the index with the user first; prefer update_issue({ state: 'closed' }) to close instead of delete.",
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
      description:
        "Search issues (and pull requests) across ALL repositories the token can see, by keyword/type/state/labels. Use for 'find issues about X' or duplicate detection across repos; set type='issues' to exclude pull requests. For listing one repo's issues use list_issues instead.",
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
      description:
        "List comments on one issue by its `index`. RISK: returns only the server's DEFAULT first page (this tool exposes no pagination), so long threads may be TRUNCATED — do not assume a short list means few comments. Gitea returns oldest-first. Each comment has an `id` (used to update/delete it), `body` (Markdown), `user`, and timestamps.",
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
      description:
        "Add a comment to an issue by its `index`. `body` is required and supports Markdown. Returns the comment including its `id` — retain it to later update_comment/delete_comment that exact comment.",
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
      description:
        "Edit a comment by its `id` (NOT the issue `index` — get the id from list_comments). `body` is the full replacement Markdown. Only the comment author or a repo admin may edit (403 otherwise).",
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
      description:
        "Delete a comment by its `id` (NOT the issue `index` — get the id from list_comments). IRREVERSIBLE. Confirm with the user first; only the author or a repo admin may delete (403 otherwise).",
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
      description:
        "List labels in a repo. Paginated (page 1-based, limit <= 100); page until a page returns fewer than `limit`. Each label has `id` (number), `name`, `color` (hex), `description`. ALWAYS call this before any label mutation — label endpoints mix names and ids (add/replace use NAMES, remove/update/delete use IDS).",
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
      description:
        "Create a label. `name` required and MUST be unique in the repo (a duplicate -> conflict error). `color` is 6-digit hex, with or without a leading '#' (e.g. '#ff0000' or 'ff0000'). `description` optional. Returns the label with its `id`.",
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
      description:
        "Update a label by `id` (number — NOT the name). Provide any of name/color/description (PATCH semantics). `color` is 6-digit hex. Get the id from list_labels.",
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
      description:
        "Permanently delete a label by `id` (number — NOT the name). IRREVERSIBLE and also removes it from EVERY issue that currently has it. Get the id from list_labels and confirm with the user before deleting.",
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
      description:
        "Add labels to an issue by its `index`. `labels` is an array of label NAMES (strings) — NOT ids. Get valid names from list_labels; a name that does not exist errors (404). ADDITIVE: existing labels are kept.",
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
      description:
        "Remove ONE label from an issue. Takes the label `id` (number) — NOT the name. Get the id from list_labels (issue labels carry their id). Errors if the label is not currently on the issue.",
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
      description:
        "REPLACE the issue's ENTIRE label set. `labels` is an array of label NAMES. Every existing label is removed and ONLY the listed ones remain. Read current labels first if any must survive; confirm with the user before replacing.",
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
      description:
        "Remove ALL labels from an issue by its `index`. Destructive for that issue's labels. Confirm with the user first; if a known subset must remain, use replace_issue_labels with that subset instead.",
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
      description:
        "List milestones in a repo. Paginated (page 1-based, limit <= 100). RISK: Gitea's DEFAULT returns only OPEN milestones — pass state='all' or 'closed' if you need closed/completed ones. Each milestone has `id`, `title`, `state`, `open_issues`, `closed_issues`, `due_on`.",
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
      description:
        "Fetch one milestone by `id` (the internal id from list_milestones, NOT the title). Returns progress counts (open_issues / closed_issues), description, state, and due_on.",
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
      description:
        "Create a milestone. `title` required. `description` optional. `due_on` optional ISO 8601 (e.g. '2025-12-31T23:59:59Z'). New milestones start in state 'open'. Returns the milestone with its `id`.",
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
      description:
        "Update a milestone by `id` (PATCH: only provided fields change). Provide any of title/description/due_on/state. `state` is 'open' or 'closed'. NOTE: closing a milestone does NOT close its open issues (they stay open, merely ungrouped) — close the issues separately if required.",
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
      description:
        "Permanently delete a milestone by `id`. IRREVERSIBLE. Issues assigned to it are NOT deleted — they keep existing but lose the milestone assignment (milestone becomes null). Confirm with the user first; prefer update_milestone({ state: 'closed' }) to preserve history.",
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
      description:
        "Detect baseUrl/owner/repo from a git repository's remotes (SSH or HTTPS). Reads `upstream` first, then `origin`, then any other remote; all discovered remotes are returned. `path` defaults to the current directory. Call ONCE at the start of a session to establish owner/repo for later calls instead of guessing. Errors if no parseable remote is found.",
      inputSchema: ResolveRepoSchema.shape,
    },
    async (input) => {
      const dir = input.path || process.cwd();
      const gitConfigPath = join(dir, ".git", "config");
      const content = await readFile(gitConfigPath, "utf-8");
      const parsed = parseRemotes(content);
      if (parsed.length === 0) {
        throw new Error(`No parseable git remotes found in ${gitConfigPath}`);
      }
      const selected = selectRemote(parsed);
      if (!selected) {
        throw new Error(`No parseable git remote found in ${gitConfigPath}`);
      }
      const remotes: Record<string, { baseUrl: string; owner: string; repo: string; url: string }> = {};
      for (const r of parsed) {
        remotes[r.remote] = { baseUrl: r.baseUrl, owner: r.owner, repo: r.repo, url: r.url };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            baseUrl: selected.baseUrl,
            owner: selected.owner,
            repo: selected.repo,
            remote: selected.remote,
            remote_url: selected.url,
            remotes,
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "list_my_repos",
    {
      description:
        "List repositories the authenticated token's user can access (across ALL owners/orgs). Paginated (page 1-based, limit <= 100). Each repo object is large — keep `limit` modest. Use to DISCOVER owner/repo values or find where to work, not to list one repo's issues.",
      inputSchema: ListMyReposSchema.shape,
    },
    async (input) => {
      const repos = await client.listMyRepos(input.page, input.limit);
      return {
        content: [{ type: "text", text: JSON.stringify(repos, null, 2) }],
      };
    },
  );

  // ── Resources (on-demand reference docs for clients that surface them) ──

  const registerDocResource = (
    name: string,
    file: string,
    description: string,
  ): void => {
    const uri = `gitea-mcp://guide/${name}`;
    server.registerResource(
      name,
      uri,
      { mimeType: "text/markdown", description },
      async () => {
        let text: string;
        try {
          text = await readFile(join(moduleDir, "assets", "resources", file), "utf-8");
        } catch {
          text = `# ${name}\n\nThis reference is unavailable in the current build.`;
        }
        return {
          contents: [{ uri, mimeType: "text/markdown", text }],
        };
      },
    );
  };

  registerDocResource(
    "field-reference",
    "field-reference.md",
    "Gitea object field reference (Issue, Label, Milestone, Comment, Repo, User)",
  );
  registerDocResource(
    "label-guide",
    "label-guide.md",
    "Label management guide: name-vs-id matrix, conventions, safe/unsafe operations",
  );
  registerDocResource(
    "tool-cookbook",
    "tool-cookbook.md",
    "Task-to-tool recipes: discover, read, create, edit, destructive ops, pagination, errors",
  );

  // ── Prompts (multi-tool workflow triggers; the model runs the tools) ──

  server.registerPrompt(
    "triage_issues",
    {
      title: "Triage issues",
      description:
        "List open issues in a repo, read context on ambiguous ones, and propose priority labels + next actions. Returns an instruction the model executes via the tools.",
      argsSchema: {
        owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
        repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
        state: z
          .enum(["open", "closed", "all"])
          .optional()
          .describe("Which issues to triage (default open)"),
      },
    },
    async ({ owner, repo, state }) => {
      const target = `${owner ?? "<GITEA_DEFAULT_OWNER>"}/${repo ?? "<GITEA_DEFAULT_REPO>"}`;
      const st = state ?? "open";
      const text = [
        `Triage ${st} issues in the Gitea repository ${target}.`,
        "",
        "Steps:",
        `1. Call list_issues({ state: "${st}", page: 1, limit: 50 }). Page forward while a page returns exactly 50.`,
        "   NOTE: list_issues may include pull requests — use search_issues({ type: 'issues' }) if you must exclude PRs.",
        "2. For stale, ambiguous, or high-activity issues, call get_issue + list_comments to read context.",
        "3. Propose for each issue: a priority/severity label, an assignee if obvious, and a one-line next action.",
        "4. Apply labels with add_issue_labels (label NAMES) — confirm with the user first if the change is large.",
        "5. Summarize: total triaged, how many need a human response, how many look stale.",
        "",
        "Do NOT delete issues. To resolve, use update_issue({ state: 'closed' }) after confirmation.",
      ].join("\n");
      return {
        description: `Triage ${st} issues in ${target}`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  server.registerPrompt(
    "summarize_issue",
    {
      title: "Summarize an issue",
      description:
        "Read one issue plus its comment thread and produce a concise status: decisions, open questions, and a recommended next action.",
      argsSchema: {
        owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
        repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
        index: z.number().int().min(1).describe("Issue number (the # shown in the URL)"),
      },
    },
    async ({ owner, repo, index }) => {
      const target = `${owner ?? "<GITEA_DEFAULT_OWNER>"}/${repo ?? "<GITEA_DEFAULT_REPO>"}#${index}`;
      const text = [
        `Summarize Gitea issue ${target}.`,
        "",
        "Steps:",
        "1. get_issue to read the title, body, labels, assignee(s), milestone, and state.",
        "2. list_comments to read the discussion (oldest-first).",
        "   CAVEAT: list_comments returns only the server's default page and has no pagination here — if the count looks capped, say so.",
        "3. Produce a summary with: a 2-3 sentence status, the key DECISIONS made, unresolved QUESTIONS/blockers, and one recommended NEXT ACTION.",
        "4. Attribute statements to their author (user.login); never invent quotes.",
        "5. Distinguish the reporter from maintainers/assignees.",
        "",
        "Do not edit or delete anything. This is read-only analysis.",
      ].join("\n");
      return {
        description: `Summarize issue ${target}`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  server.registerPrompt(
    "audit_labels",
    {
      title: "Audit label taxonomy",
      description:
        "List every label in a repo and report duplicates, inconsistent colors, missing descriptions, and a proposed cleanup. Read-only analysis; applies nothing.",
      argsSchema: {
        owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
        repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
      },
    },
    async ({ owner, repo }) => {
      const target = `${owner ?? "<GITEA_DEFAULT_OWNER>"}/${repo ?? "<GITEA_DEFAULT_REPO>"}`;
      const text = [
        `Audit the label taxonomy of Gitea repository ${target}.`,
        "",
        "Steps:",
        "1. list_labels with page 1, limit 100; page forward while a page returns exactly 100 so the audit is complete.",
        "2. Report: duplicate or near-duplicate NAMES (case/spelling), inconsistent or clashing COLORS, labels missing a description, and any obvious scope/name conventions (e.g. 'scope/name').",
        "3. Propose a concrete cleanup per problem: rename via update_label (by id), recolor, or delete_label (by id).",
        "4. DO NOT apply any change. delete_label removes the label from EVERY issue — only propose it; the user decides.",
        "",
        "Keep the name-vs-id matrix in mind: add/replace use NAMES, remove/update/delete use IDS.",
      ].join("\n");
      return {
        description: `Audit labels in ${target}`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  server.registerPrompt(
    "milestone_report",
    {
      title: "Milestone progress report",
      description:
        "List all milestones in a repo, compute completion % for each, and flag overdue milestones that still have open issues. Read-only.",
      argsSchema: {
        owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
        repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
      },
    },
    async ({ owner, repo }) => {
      const target = `${owner ?? "<GITEA_DEFAULT_OWNER>"}/${repo ?? "<GITEA_DEFAULT_REPO>"}`;
      const text = [
        `Produce a milestone progress report for Gitea repository ${target}.`,
        "",
        "Steps:",
        "1. list_milestones with state='all' (the default returns ONLY open milestones — you would miss completed ones otherwise). Page through if needed.",
        "2. For each milestone compute completion = closed_issues / (open_issues + closed_issues).",
        "3. Flag any milestone whose due_on is in the past AND open_issues > 0 as AT RISK.",
        "4. Summarize as a table: title, state, open/closed counts, % complete, due_on, and an AT RISK marker.",
        "5. Recommend where to focus effort next.",
        "",
        "Do not edit or delete anything. Read-only analysis.",
      ].join("\n");
      return {
        description: `Milestone report for ${target}`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  return server;
}

export async function runServer(
  baseUrl: string,
  token?: string,
  defaultOwner?: string,
  defaultRepo?: string,
) {
  const server = await createServer(baseUrl, token, defaultOwner, defaultRepo);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
