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
