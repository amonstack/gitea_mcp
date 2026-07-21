import { z } from "zod";

export const GiteaConfigSchema = z.object({
  baseUrl: z.string().describe("Gitea instance base URL (e.g., https://gitea.example.com)"),
  token: z.string().describe("Gitea API access token"),
});

export const ListIssuesSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Issue state filter"),
  labels: z.string().optional().describe("Comma-separated label names"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Issues per page"),
});

export const GetIssueSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
});

export const CreateIssueSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  title: z.string().describe("Issue title"),
  body: z.string().optional().describe("Issue body/description"),
  assignee: z.string().optional().describe("Assignee username"),
  assignees: z.array(z.string()).optional().describe("List of assignee usernames"),
  labels: z.array(z.number()).optional().describe("List of label IDs"),
  milestone: z.number().optional().describe("Milestone ID"),
});

export const UpdateIssueSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
  title: z.string().optional().describe("New issue title"),
  body: z.string().optional().describe("New issue body/description"),
  assignee: z.string().optional().describe("Assignee username"),
  assignees: z.array(z.string()).optional().describe("List of assignee usernames"),
  labels: z.array(z.number()).optional().describe("List of label IDs"),
  milestone: z.number().optional().describe("Milestone ID"),
  state: z.enum(["open", "closed"]).optional().describe("Issue state"),
});

export const DeleteIssueSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
});

export const SearchIssuesSchema = z.object({
  query: z.string().optional().describe("Search keyword"),
  type: z.enum(["issues", "pulls"]).optional().describe("Filter by type"),
  state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter"),
  labels: z.string().optional().describe("Comma-separated label names"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Results per page"),
});

export const ListCommentsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
});

export const CreateCommentSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
  body: z.string().describe("Comment body"),
});

export const UpdateCommentSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Comment ID"),
  body: z.string().describe("New comment body"),
});

export const DeleteCommentSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Comment ID"),
});

export const ListLabelsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Results per page"),
});

export const CreateLabelSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  name: z.string().describe("Label name"),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).describe("Label color (6-digit hex, e.g. #ff0000)"),
  description: z.string().optional().describe("Label description"),
});

export const UpdateLabelSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Label ID"),
  name: z.string().optional().describe("New label name"),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional().describe("New label color (6-digit hex)"),
  description: z.string().optional().describe("New label description"),
});

export const DeleteLabelSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Label ID"),
});

export const AddIssueLabelsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
  labels: z.array(z.string()).min(1).describe("List of label names to add"),
});

export const RemoveIssueLabelSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
  id: z.number().int().min(1).describe("Label ID to remove"),
});

export const ReplaceIssueLabelsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
  labels: z.array(z.string()).describe("List of label names to replace with"),
});

export const ClearIssueLabelsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Issue number"),
});

export const ListMilestonesSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  state: z.enum(["open", "closed", "all"]).optional().describe("Milestone state filter"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Results per page"),
});

export const GetMilestoneSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Milestone ID"),
});

export const CreateMilestoneSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  title: z.string().describe("Milestone title"),
  description: z.string().optional().describe("Milestone description"),
  due_on: z.string().optional().describe("Due date (ISO 8601 format, e.g. 2025-12-31T23:59:59Z)"),
});

export const UpdateMilestoneSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Milestone ID"),
  title: z.string().optional().describe("New milestone title"),
  description: z.string().optional().describe("New milestone description"),
  due_on: z.string().optional().describe("New due date (ISO 8601 format)"),
  state: z.enum(["open", "closed"]).optional().describe("Milestone state"),
});

export const DeleteMilestoneSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Milestone ID"),
});

export const ResolveRepoSchema = z.object({
  path: z.string().optional().describe("Path to the git repository (defaults to current directory)"),
});

export const ListMyReposSchema = z.object({
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Results per page"),
});

export const ListTopicsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Results per page"),
});

export const ReplaceTopicsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  topics: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]*$/)
        .max(35),
    )
    .describe("Full list of topic names to set (REPLACES the entire set). Lowercase letters, digits, and hyphens; start with a letter/digit."),
});

export const AddTopicSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  topic: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(35)
    .describe("Topic name to add. Lowercase letters, digits, and hyphens; must start with a letter or digit."),
});

export const RemoveTopicSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  topic: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(35)
    .describe("Topic name to remove. Lowercase letters, digits, and hyphens; must start with a letter or digit."),
});

export const GiteaStatusSchema = z.object({});

// ── Pull Requests ──

export const ListPullRequestsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Pull request state filter"),
  labels: z.string().optional().describe("Comma-separated label names"),
  sort: z
    .enum(["oldest", "recentupdate", "leastupdate", "mostcomment", "leastcomment", "priority"])
    .optional()
    .describe("Sort order for the pull request list"),
  milestone: z.number().int().min(1).optional().describe("Milestone ID"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Pull requests per page"),
});

export const GetPullRequestSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Pull request number"),
});

export const CreatePullRequestSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  title: z.string().describe("Pull request title"),
  body: z.string().optional().describe("Pull request body/description (supports Markdown)"),
  head: z.string().describe("Source branch name (the branch you want to merge FROM). For forks use 'owner:branch'"),
  base: z.string().describe("Target branch name (the branch you want to merge INTO)"),
  assignee: z.string().optional().describe("Assignee username"),
  assignees: z.array(z.string()).optional().describe("List of assignee usernames"),
  labels: z.array(z.number()).optional().describe("List of label IDs"),
  milestone: z.number().optional().describe("Milestone ID"),
});

export const UpdatePullRequestSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Pull request number"),
  title: z.string().optional().describe("New pull request title"),
  body: z.string().optional().describe("New pull request body/description"),
  base: z.string().optional().describe("New target branch name (retargeting a PR is rarely reversible)"),
  assignee: z.string().optional().describe("Assignee username"),
  assignees: z.array(z.string()).optional().describe("List of assignee usernames"),
  labels: z.array(z.number()).optional().describe("List of label IDs (REPLACES the entire set)"),
  milestone: z.number().optional().describe("Milestone ID"),
  state: z.enum(["open", "closed"]).optional().describe("Pull request state — 'closed' closes the PR without merging"),
});

export const MergePullRequestSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Pull request number"),
  Do: z
    .enum(["merge", "squash", "rebase", "rebase-merge"])
    .describe("Merge strategy: 'merge' (merge commit), 'squash' (single commit), 'rebase' (rebase then fast-forward), 'rebase-merge' (rebase then merge commit)"),
  MergeTitleField: z.string().optional().describe("Title for the merge commit"),
  MergeMessageField: z.string().optional().describe("Message body for the merge commit"),
  SHA: z.string().optional().describe("The expected HEAD SHA of the PR (fails if the branch moved since)"),
});

export const IsPullMergedSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Pull request number"),
});

export const ListPullCommitsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Pull request number"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Commits per page"),
});

export const ListPullFilesSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  index: z.number().int().min(1).describe("Pull request number"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Files per page"),
});

// ── Releases ──

export const ListReleasesSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  draft: z.boolean().optional().describe("Filter by draft status (true = drafts only, false = published only)"),
  prerelease: z
    .boolean()
    .optional()
    .describe("Filter by prerelease status (true = prereleases only, false = stable releases only)"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Releases per page"),
});

export const GetReleaseSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Release ID (the numeric id from list_releases, NOT the tag name)"),
});

export const GetReleaseByTagSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  tag: z.string().describe("Git tag name the release was published from (e.g. 'v1.2.0')"),
});

export const CreateReleaseSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  tag_name: z.string().describe("Git tag name to create the release from (e.g. 'v1.2.0')"),
  name: z.string().optional().describe("Release title (the human-readable name)"),
  body: z.string().optional().describe("Release notes / content (supports Markdown)"),
  target_commitish: z
    .string()
    .optional()
    .describe("Branch or commit SHA the tag is created from (defaults to the repo default branch)"),
  draft: z.boolean().optional().describe("Create as a draft (unpublished) release"),
  prerelease: z.boolean().optional().describe("Create as a prerelease"),
});

export const UpdateReleaseSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Release ID (the numeric id from list_releases, NOT the tag name)"),
  tag_name: z.string().optional().describe("New tag name (renames the tag; use with care)"),
  name: z.string().optional().describe("New release title"),
  body: z.string().optional().describe("New release notes / content (supports Markdown)"),
  target_commitish: z.string().optional().describe("New target branch or commit SHA"),
  draft: z.boolean().optional().describe("Draft status"),
  prerelease: z.boolean().optional().describe("Prerelease status"),
});

export const DeleteReleaseSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  id: z.number().int().min(1).describe("Release ID (the numeric id from list_releases, NOT the tag name)"),
});

// ── Repository ──

export const UpdateRepoSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  name: z
    .string()
    .optional()
    .describe("New repository name (RENAME). Renaming changes the repo URL; use with care."),
  description: z
    .string()
    .optional()
    .describe("New repository description. Pass an empty string to clear the description."),
  website: z
    .string()
    .optional()
    .describe("New repository homepage/website URL. Pass an empty string to clear."),
  private: z.boolean().optional().describe("New visibility: true = private, false = public"),
  default_branch: z
    .string()
    .optional()
    .describe("New default branch name (the branch must already exist in the repo)"),
});

// ── Actions ──

export const ListActionRunsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  branch: z.string().optional().describe("Filter by head branch name"),
  event: z
    .string()
    .optional()
    .describe("Filter by trigger event (e.g. push, pull_request, schedule)"),
  status: z
    .string()
    .optional()
    .describe(
      "Filter by run status: pending, queued, waiting, in_progress, running, success, failure, skipped, cancelled",
    ),
  actor: z.string().optional().describe("Filter by the user who triggered the run (username)"),
  head_sha: z.string().optional().describe("Filter by the head commit SHA"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Runs per page"),
});

export const GetActionRunSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  runId: z.number().int().min(1).describe("Action workflow run ID"),
});

export const CancelActionRunSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  runId: z.number().int().min(1).describe("Action workflow run ID"),
});

export const RerunActionRunSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  runId: z.number().int().min(1).describe("Action workflow run ID"),
});

export const RerunActionRunFailedJobsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITEA_DEFAULT_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITEA_DEFAULT_REPO)"),
  runId: z.number().int().min(1).describe("Action workflow run ID"),
});
