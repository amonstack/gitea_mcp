import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { GiteaClient } from "./gitea-client.js";
import {
  ListIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  ListCommentsSchema,
  CreateCommentSchema,
} from "./tools.js";

export async function createServer(baseUrl: string, token: string) {
  const client = new GiteaClient({ baseUrl, token });

  const server = new McpServer(
    {
      name: "gitea-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.registerTool(
    "list_issues",
    {
      description: "List issues in a Gitea repository",
      inputSchema: ListIssuesSchema.shape,
    },
    async (input) => {
      const issues = await client.listIssues(input);
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
      const issue = await client.getIssue(input.owner, input.repo, input.index);
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
      const issue = await client.createIssue(input);
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
      const issue = await client.updateIssue(input);
      return {
        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_comments",
    {
      description: "List comments on a Gitea issue",
      inputSchema: ListCommentsSchema.shape,
    },
    async (input) => {
      const comments = await client.listComments(
        input.owner,
        input.repo,
        input.index,
      );
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
      const comment = await client.createComment(
        input.owner,
        input.repo,
        input.index,
        input.body,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(comment, null, 2) }],
      };
    },
  );

  return server;
}

export async function runServer(baseUrl: string, token: string) {
  const server = await createServer(baseUrl, token);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
