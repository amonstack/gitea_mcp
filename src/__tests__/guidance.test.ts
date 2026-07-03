import { describe, it, expect, beforeEach, vi } from "vitest";
import { GiteaClient } from "../gitea-client.js";

vi.mock("../gitea-client.js", () => ({
  GiteaClient: vi.fn(),
}));

// NOTE: node:fs/promises is intentionally NOT mocked here — guidance assets are
// read from real local files so the instructions/resources wiring is exercised.

const CLIENT_METHODS = [
  "listIssues", "getIssue", "createIssue", "updateIssue", "deleteIssue", "searchIssues",
  "listComments", "createComment", "updateComment", "deleteComment",
  "listLabels", "createLabel", "updateLabel", "deleteLabel",
  "addIssueLabels", "removeIssueLabel", "replaceIssueLabels", "clearIssueLabels",
  "listMilestones", "getMilestone", "createMilestone", "updateMilestone", "deleteMilestone",
  "listMyRepos",
] as const;

type MockClient = Record<string, ReturnType<typeof vi.fn>>;
let mockClient: MockClient;

interface ToolLike {
  description: string;
}
interface PromptLike {
  description?: string;
  callback: (args: Record<string, unknown>, extra: unknown) => Promise<unknown>;
}
interface ResourceLike {
  readCallback: (uri: URL, extra: unknown) => Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toolsOf(server: any): Record<string, ToolLike> {
  return server._registeredTools;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function promptsOf(server: any): Record<string, PromptLike> {
  return server._registeredPrompts;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resourcesOf(server: any): Record<string, ResourceLike> {
  return server._registeredResources;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  mockClient = {};
  for (const m of CLIENT_METHODS) mockClient[m] = vi.fn();
  vi.mocked(GiteaClient).mockImplementation(function () {
    return mockClient;
  } as never);
});

describe("server instructions (handshake guidance)", () => {
  it("loads instructions.md into the server and it carries the core strategy", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instructions = (server as any).server._instructions as string | undefined;
    expect(typeof instructions).toBe("string");
    expect(instructions).toContain("Resolve owner/repo FIRST");
    expect(instructions).toContain("IDs vs names");
  });
});

describe("enriched tool descriptions", () => {
  it("every registered tool has a substantive description (>40 chars)", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t", "o", "r");
    for (const [name, tool] of Object.entries(toolsOf(server))) {
      expect(tool.description.length, `${name} description too short`).toBeGreaterThan(40);
    }
  });

  it("flags the critical risk on each high-risk tool", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t", "o", "r");
    const d = (n: string) => toolsOf(server)[n].description;
    expect(d("update_issue")).toContain("REPLACE"); // labels replace whole set
    expect(d("delete_issue")).toContain("IRREVERSIBLE");
    expect(d("list_issues").toLowerCase()).toContain("page");
    expect(d("list_comments")).toContain("TRUNCAT"); // truncation risk
    expect(d("update_comment")).toContain("NOT the issue");
    expect(d("delete_comment")).toContain("NOT the issue");
    expect(d("add_issue_labels")).toContain("NAMES");
    expect(d("remove_issue_label")).toMatch(/id/i);
    expect(d("replace_issue_labels")).toContain("REPLACE");
    expect(d("list_milestones")).toContain("OPEN");
    expect(d("create_label")).toContain("hex");
    expect(d("delete_label")).toContain("EVERY issue");
    expect(d("resolve_repo")).toContain("origin");
  });
});

describe("workflow prompts", () => {
  const PROMPTS = ["triage_issues", "summarize_issue", "audit_labels", "milestone_report"];

  it("registers all four prompts with descriptions", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t", "o", "r");
    const prompts = promptsOf(server);
    for (const name of PROMPTS) {
      expect(prompts[name], `missing prompt ${name}`).toBeDefined();
      expect(typeof prompts[name].description).toBe("string");
    }
  });

  it("each prompt returns a user text message with actionable guidance", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t", "o", "r");
    const prompts = promptsOf(server);
    const cases: Array<[string, Record<string, unknown>]> = [
      ["triage_issues", {}],
      ["summarize_issue", { index: 7 }],
      ["audit_labels", {}],
      ["milestone_report", {}],
    ];
    for (const [name, args] of cases) {
      const result = (await prompts[name].callback(args, {})) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };
      expect(result.messages.length).toBeGreaterThan(0);
      const msg = result.messages[0];
      expect(msg.role).toBe("user");
      expect(msg.content.type).toBe("text");
      expect(msg.content.text.length).toBeGreaterThan(20);
    }
  });
});

describe("reference resources", () => {
  const RESOURCES = [
    "gitea-mcp://guide/field-reference",
    "gitea-mcp://guide/label-guide",
    "gitea-mcp://guide/tool-cookbook",
  ];

  it("registers all three resources", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t", "o", "r");
    const resources = resourcesOf(server);
    for (const uri of RESOURCES) {
      expect(resources[uri], `missing resource ${uri}`).toBeDefined();
    }
  });

  it("each resource reads non-empty markdown from the bundled assets", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", "t", "o", "r");
    const resources = resourcesOf(server);
    for (const uri of RESOURCES) {
      const result = (await resources[uri].readCallback(new URL(uri), {})) as {
        contents: Array<{ uri: string; mimeType: string; text: string }>;
      };
      expect(result.contents.length).toBe(1);
      expect(result.contents[0].mimeType).toBe("text/markdown");
      expect(result.contents[0].text.length).toBeGreaterThan(50);
    }
  });
});
