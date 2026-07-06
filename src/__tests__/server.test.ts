import { describe, it, expect, beforeEach, vi } from "vitest";
import { GiteaClient } from "../gitea-client.js";
import { readFile } from "node:fs/promises";

vi.mock("../gitea-client.js", () => ({
  GiteaClient: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

const CLIENT_METHODS = [
  "listIssues", "getIssue", "createIssue", "updateIssue", "deleteIssue", "searchIssues",
  "listComments", "createComment", "updateComment", "deleteComment",
  "listLabels", "createLabel", "updateLabel", "deleteLabel",
  "addIssueLabels", "removeIssueLabel", "replaceIssueLabels", "clearIssueLabels",
  "listMilestones", "getMilestone", "createMilestone", "updateMilestone", "deleteMilestone",
  "listMyRepos", "getCredentialStatus",
] as const;

type MockClient = Record<string, ReturnType<typeof vi.fn>>;
let mockClient: MockClient;

interface RegisteredTool {
  description: string;
  handler: (input: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;
}

function registeredTools(server: { _registeredTools: Record<string, RegisteredTool> }) {
  return server._registeredTools;
}

const EXPECTED_TOOLS = [
  "list_issues", "get_issue", "create_issue", "update_issue", "delete_issue", "search_issues",
  "list_comments", "create_comment", "update_comment", "delete_comment",
  "list_labels", "create_label", "update_label", "delete_label",
  "add_issue_labels", "remove_issue_label", "replace_issue_labels", "clear_issue_labels",
  "list_milestones", "get_milestone", "create_milestone", "update_milestone", "delete_milestone",
  "resolve_repo", "list_my_repos", "gitea_status",
];

describe("createServer", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = {};
    for (const m of CLIENT_METHODS) mockClient[m] = vi.fn();
    vi.mocked(GiteaClient).mockImplementation(function () { return mockClient; } as never);
  });

  it("constructs the GiteaClient with baseUrl", async () => {
    const { createServer } = await import("../server.js");
    await createServer("https://g.example");
    expect(GiteaClient).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: "https://g.example" }));
  });

  it("registers all expected tools", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    expect(Object.keys(registeredTools(server as never)).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("every tool has a non-empty description", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g", undefined, "o", "r");
    for (const tool of Object.values(registeredTools(server as never))) {
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe("owner/repo resolution", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = {};
    for (const m of CLIENT_METHODS) mockClient[m] = vi.fn();
    vi.mocked(GiteaClient).mockImplementation(function () { return mockClient; } as never);
  });

  it("uses explicit owner/repo when provided", async () => {
    const { createServer } = await import("../server.js");
    mockClient.listIssues.mockResolvedValue([]);
    const server = await createServer("https://g", undefined, "defOwner", "defRepo");
    const handler = registeredTools(server as never)["list_issues"].handler;
    await handler({ owner: "o", repo: "r" });
    expect(mockClient.listIssues).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r" }));
  });

  it("falls back to defaults when owner/repo omitted", async () => {
    const { createServer } = await import("../server.js");
    mockClient.listIssues.mockResolvedValue([]);
    const server = await createServer("https://g", undefined, "defOwner", "defRepo");
    await registeredTools(server as never)["list_issues"].handler({});
    expect(mockClient.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "defOwner", repo: "defRepo" }),
    );
  });

  it("throws when neither explicit nor default owner/repo is available", async () => {
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    await expect(
      registeredTools(server as never)["list_issues"].handler({}),
    ).rejects.toThrow("owner and repo are required");
  });
});

describe("tool handlers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = {};
    for (const m of CLIENT_METHODS) mockClient[m] = vi.fn();
    vi.mocked(GiteaClient).mockImplementation(function () { return mockClient; } as never);
  });

  it("list_issues returns JSON of the client result", async () => {
    const { createServer } = await import("../server.js");
    const issues = [{ id: 1, number: 1 }];
    mockClient.listIssues.mockResolvedValue(issues);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_issues"].handler({});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(issues);
  });

  it("create_issue spreads owner/repo into the create params", async () => {
    const { createServer } = await import("../server.js");
    mockClient.createIssue.mockResolvedValue({ id: 2 });
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["create_issue"].handler({
      title: "Bug",
      body: "desc",
      labels: [1, 2],
    });
    expect(mockClient.createIssue).toHaveBeenCalledWith({ owner: "o", repo: "r", title: "Bug", body: "desc", labels: [1, 2] });
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 2 });
  });

  it("delete_issue deletes and returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.deleteIssue.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["delete_issue"].handler({ index: 7 });
    expect(mockClient.deleteIssue).toHaveBeenCalledWith("o", "r", 7);
    expect(result.content[0].text).toBe("Issue #7 deleted.");
  });

  it("create_comment forwards index and body", async () => {
    const { createServer } = await import("../server.js");
    mockClient.createComment.mockResolvedValue({ id: 10 });
    const server = await createServer("https://g", undefined, "o", "r");
    await registeredTools(server as never)["create_comment"].handler({ index: 3, body: "hi" });
    expect(mockClient.createComment).toHaveBeenCalledWith("o", "r", 3, "hi");
  });

  it("remove_issue_label returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.removeIssueLabel.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["remove_issue_label"].handler({ index: 5, id: 9 });
    expect(result.content[0].text).toBe("Label #9 removed from issue #5.");
  });

  it("search_issues does not require owner/repo", async () => {
    const { createServer } = await import("../server.js");
    mockClient.searchIssues.mockResolvedValue([]);
    const server = await createServer("https://g");
    const result = await registeredTools(server as never)["search_issues"].handler({ query: "x" });
    expect(mockClient.searchIssues).toHaveBeenCalledWith({ query: "x" });
    expect(result.content[0].type).toBe("text");
  });

  it("list_my_repos forwards pagination", async () => {
    const { createServer } = await import("../server.js");
    mockClient.listMyRepos.mockResolvedValue([]);
    const server = await createServer("https://g");
    await registeredTools(server as never)["list_my_repos"].handler({ page: 2, limit: 30 });
    expect(mockClient.listMyRepos).toHaveBeenCalledWith(2, 30);
  });

  it("gitea_status returns the client credential status as JSON", async () => {
    const { createServer } = await import("../server.js");
    const status = { candidates: [{ source: "env", schemes: ["token"], status: "pending" }], activeIndex: null, totalCandidates: 1 };
    mockClient.getCredentialStatus.mockReturnValue(status);
    const server = await createServer("https://g");
    const result = await registeredTools(server as never)["gitea_status"].handler({});
    expect(mockClient.getCredentialStatus).toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text)).toEqual(status);
  });
});

describe("resolve_repo handler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = {};
    for (const m of CLIENT_METHODS) mockClient[m] = vi.fn();
    vi.mocked(GiteaClient).mockImplementation(function () { return mockClient; } as never);
  });

  it("parses an SSH remote and derives an https baseUrl", async () => {
    vi.mocked(readFile).mockResolvedValue('[remote "origin"]\n\turl = git@gitea.example:owner/repo.git\n');
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    const result = await registeredTools(server as never)["resolve_repo"].handler({ path: "/repo" });
    expect(readFile).toHaveBeenCalledWith("/repo/.git/config", "utf-8");
    expect(JSON.parse(result.content[0].text)).toEqual({
      baseUrl: "https://gitea.example",
      owner: "owner",
      repo: "repo",
      remote: "origin",
      remote_url: "git@gitea.example:owner/repo.git",
      remotes: {
        origin: { baseUrl: "https://gitea.example", owner: "owner", repo: "repo", url: "git@gitea.example:owner/repo.git" },
      },
    });
  });

  it("parses an HTTPS remote URL without .git suffix", async () => {
    vi.mocked(readFile).mockResolvedValue('[remote "origin"]\n\turl = https://gitea.example/owner/repo\n');
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    const result = await registeredTools(server as never)["resolve_repo"].handler({ path: "/repo" });
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      baseUrl: "https://gitea.example",
      owner: "owner",
      repo: "repo",
      remote: "origin",
    });
  });

  it("prefers the upstream remote over origin and surfaces both", async () => {
    vi.mocked(readFile).mockResolvedValue(
      '[remote "origin"]\n\turl = https://gitea.example/origin/repo.git\n[remote "upstream"]\n\turl = https://gitea.example/upstream/repo.git\n',
    );
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    const result = await registeredTools(server as never)["resolve_repo"].handler({ path: "/repo" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.remote).toBe("upstream");
    expect(parsed.owner).toBe("upstream");
    expect(parsed.remote_url).toBe("https://gitea.example/upstream/repo.git");
    expect(Object.keys(parsed.remotes).sort()).toEqual(["origin", "upstream"]);
  });

  it("throws when no parseable remotes are found", async () => {
    vi.mocked(readFile).mockResolvedValue("");
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    await expect(
      registeredTools(server as never)["resolve_repo"].handler({ path: "/repo" }),
    ).rejects.toThrow("No parseable git remotes found");
  });

  it("throws when the remote URL cannot be parsed", async () => {
    vi.mocked(readFile).mockResolvedValue('[remote "origin"]\n\turl = not-a-valid-url\n');
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    await expect(
      registeredTools(server as never)["resolve_repo"].handler({ path: "/repo" }),
    ).rejects.toThrow("No parseable git remotes found");
  });
});
