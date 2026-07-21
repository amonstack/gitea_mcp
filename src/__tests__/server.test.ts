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
  "listTopics", "replaceTopics", "addTopic", "removeTopic",
  "listPullRequests", "getPullRequest", "createPullRequest", "updatePullRequest",
  "mergePullRequest", "isPullMerged", "listPullCommits", "listPullFiles",
  "listActionRuns", "getActionRun", "cancelActionRun", "rerunActionRun", "rerunActionRunFailedJobs",
  "listReleases", "getRelease", "getReleaseByTag", "createRelease", "updateRelease", "deleteRelease",
  "getRepo", "updateRepo",
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
  "list_topics", "replace_topics", "add_topic", "remove_topic",
  "list_pull_requests", "get_pull_request", "create_pull_request", "update_pull_request",
  "merge_pull_request", "is_pull_merged", "list_pull_commits", "list_pull_files",
  "list_action_runs", "get_action_run", "cancel_action_run",
  "rerun_action_run", "rerun_action_run_failed_jobs",
  "list_releases", "get_release", "get_release_by_tag",
  "create_release", "update_release", "delete_release",
  "update_repo",
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

  it("list_topics returns JSON of the client result", async () => {
    const { createServer } = await import("../server.js");
    mockClient.listTopics.mockResolvedValue({ topics: ["go", "mcp"] });
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_topics"].handler({});
    expect(mockClient.listTopics).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r" }));
    expect(JSON.parse(result.content[0].text)).toEqual({ topics: ["go", "mcp"] });
  });

  it("replace_topics spreads owner/repo into the replace params", async () => {
    const { createServer } = await import("../server.js");
    mockClient.replaceTopics.mockResolvedValue({ topics: ["go"] });
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["replace_topics"].handler({ topics: ["go"] });
    expect(mockClient.replaceTopics).toHaveBeenCalledWith({ owner: "o", repo: "r", topics: ["go"] });
    expect(JSON.parse(result.content[0].text)).toEqual({ topics: ["go"] });
  });

  it("add_topic forwards owner/repo/topic and returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.addTopic.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["add_topic"].handler({ topic: "go" });
    expect(mockClient.addTopic).toHaveBeenCalledWith("o", "r", "go");
    expect(result.content[0].text).toBe("Topic 'go' added to o/r.");
  });

  it("remove_topic forwards owner/repo/topic and returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.removeTopic.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["remove_topic"].handler({ topic: "go" });
    expect(mockClient.removeTopic).toHaveBeenCalledWith("o", "r", "go");
    expect(result.content[0].text).toBe("Topic 'go' removed from o/r.");
  });

  it("list_pull_requests returns JSON of the client result", async () => {
    const { createServer } = await import("../server.js");
    const pulls = [{ number: 1 }];
    mockClient.listPullRequests.mockResolvedValue(pulls);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_pull_requests"].handler({});
    expect(mockClient.listPullRequests).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r" }));
    expect(JSON.parse(result.content[0].text)).toEqual(pulls);
  });

  it("create_pull_request spreads owner/repo into the create params", async () => {
    const { createServer } = await import("../server.js");
    const pull = { number: 7 };
    mockClient.createPullRequest.mockResolvedValue(pull);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["create_pull_request"].handler({
      title: "T", head: "feature", base: "main",
    });
    expect(mockClient.createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "o", repo: "r", title: "T", head: "feature", base: "main" }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual(pull);
  });

  it("get_pull_request forwards owner/repo/index and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const pull = { number: 42, title: "T" };
    mockClient.getPullRequest.mockResolvedValue(pull);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["get_pull_request"].handler({ index: 42 });
    expect(mockClient.getPullRequest).toHaveBeenCalledWith("o", "r", 42);
    expect(JSON.parse(result.content[0].text)).toEqual(pull);
  });

  it("update_pull_request spreads owner/repo into the update params", async () => {
    const { createServer } = await import("../server.js");
    mockClient.updatePullRequest.mockResolvedValue({ number: 3 });
    const server = await createServer("https://g", undefined, "o", "r");
    await registeredTools(server as never)["update_pull_request"].handler({ index: 3, state: "closed" });
    expect(mockClient.updatePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "o", repo: "r", index: 3, state: "closed" }),
    );
  });

  it("merge_pull_request returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.mergePullRequest.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["merge_pull_request"].handler({ index: 9, Do: "squash" });
    expect(mockClient.mergePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "o", repo: "r", index: 9, Do: "squash" }),
    );
    expect(result.content[0].text).toContain("merged");
  });

  it("is_pull_merged returns the merged boolean as JSON", async () => {
    const { createServer } = await import("../server.js");
    mockClient.isPullMerged.mockResolvedValue(true);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["is_pull_merged"].handler({ index: 1 });
    expect(mockClient.isPullMerged).toHaveBeenCalledWith("o", "r", 1);
    expect(JSON.parse(result.content[0].text)).toEqual({ merged: true });
  });

  it("list_pull_commits forwards owner/repo/index/pagination", async () => {
    const { createServer } = await import("../server.js");
    const commits = [{ sha: "abc" }];
    mockClient.listPullCommits.mockResolvedValue(commits);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_pull_commits"].handler({ index: 5, page: 1 });
    expect(mockClient.listPullCommits).toHaveBeenCalledWith("o", "r", 5, 1, undefined);
    expect(JSON.parse(result.content[0].text)).toEqual(commits);
  });

  it("list_pull_files forwards owner/repo/index/pagination", async () => {
    const { createServer } = await import("../server.js");
    const files = [{ filename: "a.ts" }];
    mockClient.listPullFiles.mockResolvedValue(files);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_pull_files"].handler({ index: 5 });
    expect(mockClient.listPullFiles).toHaveBeenCalledWith("o", "r", 5, undefined, undefined);
    expect(JSON.parse(result.content[0].text)).toEqual(files);
  });

  it("list_action_runs returns JSON of the client result", async () => {
    const { createServer } = await import("../server.js");
    const runs = { workflow_runs: [{ id: 1, status: "success" }], count: 1 };
    mockClient.listActionRuns.mockResolvedValue(runs);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_action_runs"].handler({ status: "failure" });
    expect(mockClient.listActionRuns).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r", status: "failure" }));
    expect(JSON.parse(result.content[0].text)).toEqual(runs);
  });

  it("get_action_run forwards owner/repo/runId and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const run = { id: 42, status: "in_progress" };
    mockClient.getActionRun.mockResolvedValue(run);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["get_action_run"].handler({ runId: 42 });
    expect(mockClient.getActionRun).toHaveBeenCalledWith("o", "r", 42);
    expect(JSON.parse(result.content[0].text)).toEqual(run);
  });

  it("cancel_action_run returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.cancelActionRun.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["cancel_action_run"].handler({ runId: 7 });
    expect(mockClient.cancelActionRun).toHaveBeenCalledWith("o", "r", 7);
    expect(result.content[0].text).toBe("Action run #7 cancelled.");
  });

  it("rerun_action_run returns the new run JSON when body present", async () => {
    const { createServer } = await import("../server.js");
    const newRun = { id: 100, status: "queued" };
    mockClient.rerunActionRun.mockResolvedValue(newRun);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["rerun_action_run"].handler({ runId: 9 });
    expect(mockClient.rerunActionRun).toHaveBeenCalledWith("o", "r", 9);
    expect(JSON.parse(result.content[0].text)).toEqual(newRun);
  });

  it("rerun_action_run returns a confirmation string when body absent", async () => {
    const { createServer } = await import("../server.js");
    mockClient.rerunActionRun.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["rerun_action_run"].handler({ runId: 9 });
    expect(result.content[0].text).toContain("rerun started");
  });

  it("rerun_action_run_failed_jobs returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.rerunActionRunFailedJobs.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["rerun_action_run_failed_jobs"].handler({ runId: 12 });
    expect(mockClient.rerunActionRunFailedJobs).toHaveBeenCalledWith("o", "r", 12);
    expect(result.content[0].text).toContain("Failed jobs rerun started");
  });

  it("list_releases returns JSON of the client result", async () => {
    const { createServer } = await import("../server.js");
    const releases = [{ id: 1, tag_name: "v1.0.0" }];
    mockClient.listReleases.mockResolvedValue(releases);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["list_releases"].handler({ prerelease: false });
    expect(mockClient.listReleases).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r", prerelease: false }));
    expect(JSON.parse(result.content[0].text)).toEqual(releases);
  });

  it("get_release forwards owner/repo/id and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const release = { id: 42, tag_name: "v1.2.0", name: "Title" };
    mockClient.getRelease.mockResolvedValue(release);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["get_release"].handler({ id: 42 });
    expect(mockClient.getRelease).toHaveBeenCalledWith("o", "r", 42);
    expect(JSON.parse(result.content[0].text)).toEqual(release);
  });

  it("get_release_by_tag forwards owner/repo/tag and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const release = { id: 5, tag_name: "v1.0.0" };
    mockClient.getReleaseByTag.mockResolvedValue(release);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["get_release_by_tag"].handler({ tag: "v1.0.0" });
    expect(mockClient.getReleaseByTag).toHaveBeenCalledWith("o", "r", "v1.0.0");
    expect(JSON.parse(result.content[0].text)).toEqual(release);
  });

  it("create_release forwards fields and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const release = { id: 1, tag_name: "v1.0.0" };
    mockClient.createRelease.mockResolvedValue(release);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["create_release"].handler({
      tag_name: "v1.0.0", name: "Title", body: "notes",
    });
    expect(mockClient.createRelease).toHaveBeenCalledWith(expect.objectContaining({
      owner: "o", repo: "r", tag_name: "v1.0.0", name: "Title", body: "notes",
    }));
    expect(JSON.parse(result.content[0].text)).toEqual(release);
  });

  it("update_release forwards fields and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const release = { id: 7, name: "New" };
    mockClient.updateRelease.mockResolvedValue(release);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["update_release"].handler({ id: 7, name: "New" });
    expect(mockClient.updateRelease).toHaveBeenCalledWith(expect.objectContaining({ owner: "o", repo: "r", id: 7, name: "New" }));
    expect(JSON.parse(result.content[0].text)).toEqual(release);
  });

  it("delete_release returns a confirmation string", async () => {
    const { createServer } = await import("../server.js");
    mockClient.deleteRelease.mockResolvedValue(undefined);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["delete_release"].handler({ id: 3 });
    expect(mockClient.deleteRelease).toHaveBeenCalledWith("o", "r", 3);
    expect(result.content[0].text).toBe("Release #3 deleted.");
  });

  it("update_repo spreads owner/repo into the update params and returns JSON", async () => {
    const { createServer } = await import("../server.js");
    const repo = { id: 1, name: "r", description: "new desc" };
    mockClient.updateRepo.mockResolvedValue(repo);
    const server = await createServer("https://g", undefined, "o", "r");
    const result = await registeredTools(server as never)["update_repo"].handler({ description: "new desc" });
    expect(mockClient.updateRepo).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "o", repo: "r", description: "new desc" }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual(repo);
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

  it("follows gitdir -> commondir when run inside a git worktree", async () => {
    const files: Record<string, string> = {
      "/wt/.git": "gitdir: /data/repo/.git/worktrees/wt\n",
      "/data/repo/.git/worktrees/wt/commondir": "../..\n",
      "/data/repo/.git/config": '[remote "origin"]\n\turl = git@gitea.example:owner/repo.git\n',
    };
    vi.mocked(readFile).mockImplementation(async (path) => files[String(path)]);
    const { createServer } = await import("../server.js");
    const server = await createServer("https://g");
    const result = await registeredTools(server as never)["resolve_repo"].handler({ path: "/wt" });
    expect(readFile).toHaveBeenCalledWith("/data/repo/.git/config", "utf-8");
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      owner: "owner",
      repo: "repo",
      baseUrl: "https://gitea.example",
    });
  });
});
