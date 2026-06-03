import { z } from "zod";

export const GiteaConfigSchema = z.object({
  baseUrl: z.string().describe("Gitea instance base URL (e.g., https://gitea.example.com)"),
  token: z.string().describe("Gitea API access token"),
});

export const ListIssuesSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Issue state filter"),
  labels: z.string().optional().describe("Comma-separated label names"),
  page: z.number().int().min(1).optional().describe("Page number"),
  limit: z.number().int().min(1).max(100).optional().describe("Issues per page"),
});

export const GetIssueSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  index: z.number().int().min(1).describe("Issue number"),
});

export const CreateIssueSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  title: z.string().describe("Issue title"),
  body: z.string().optional().describe("Issue body/description"),
  assignee: z.string().optional().describe("Assignee username"),
  assignees: z.array(z.string()).optional().describe("List of assignee usernames"),
  labels: z.array(z.number()).optional().describe("List of label IDs"),
  milestone: z.number().optional().describe("Milestone ID"),
});

export const UpdateIssueSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  index: z.number().int().min(1).describe("Issue number"),
  title: z.string().optional().describe("New issue title"),
  body: z.string().optional().describe("New issue body/description"),
  assignee: z.string().optional().describe("Assignee username"),
  assignees: z.array(z.string()).optional().describe("List of assignee usernames"),
  labels: z.array(z.number()).optional().describe("List of label IDs"),
  milestone: z.number().optional().describe("Milestone ID"),
  state: z.enum(["open", "closed"]).optional().describe("Issue state"),
});

export const ListCommentsSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  index: z.number().int().min(1).describe("Issue number"),
});

export const CreateCommentSchema = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  index: z.number().int().min(1).describe("Issue number"),
  body: z.string().describe("Comment body"),
});
