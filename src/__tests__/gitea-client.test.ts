import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GiteaClient } from "../gitea-client.js";

interface FakeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function buildResponse(body: unknown, status = 200, statusText = "OK"): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body ?? "")),
  };
}

function stubFetch(response: FakeResponse) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: url as string, init: init as RequestInit };
}

describe("GiteaClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("strips trailing slashes from baseUrl", () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g.example///", token: "tok" });
      client.listMyRepos();
      expect(lastCall(fetchMock).url).toBe("https://g.example/api/v1/user/repos");
    });

    it("preserves baseUrl without trailing slash", () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "tok" });
      client.listMyRepos();
      expect(lastCall(fetchMock).url).toBe("https://g.example/api/v1/user/repos");
    });
  });

  describe("request helper", () => {
    it("sends the token as Authorization header", async () => {
      const fetchMock = stubFetch(buildResponse({ id: 1 }));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "secret" });
      await client.getIssue("o", "r", 1);
      const headers = lastCall(fetchMock).init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("token secret");
      expect(headers["Accept"]).toBe("application/json");
    });

    it("sets Content-Type only when a body is present", async () => {
      const fetchMock = stubFetch(buildResponse({ id: 1 }));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "t" });
      await client.getIssue("o", "r", 1);
      const headers = lastCall(fetchMock).init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });

    it("returns parsed JSON on success", async () => {
      stubFetch(buildResponse({ id: 9, number: 9 }));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "t" });
      const issue = await client.getIssue("o", "r", 9);
      expect(issue).toEqual({ id: 9, number: 9 });
    });

    it("returns undefined on HTTP 204", async () => {
      stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "t" });
      const result = await client.deleteIssue("o", "r", 5);
      expect(result).toBeUndefined();
    });

    it("throws with status and response body on error", async () => {
      stubFetch(buildResponse("not found", 404, "Not Found"));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "t" });
      await expect(client.getIssue("o", "r", 1)).rejects.toThrow(
        "Gitea API error (404): not found",
      );
    });

    it("falls back to statusText when body is empty", async () => {
      stubFetch(buildResponse("", 500, "Internal Server Error"));
      const client = new GiteaClient({ baseUrl: "https://g.example", token: "t" });
      await expect(client.getIssue("o", "r", 1)).rejects.toThrow(
        "Gitea API error (500): Internal Server Error",
      );
    });
  });

  describe("issues", () => {
    it("listIssues builds query from filters", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listIssues({
        owner: "own",
        repo: "rp",
        state: "closed",
        labels: "bug",
        page: 2,
        limit: 50,
      });
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/own/rp/issues?state=closed&labels=bug&page=2&limit=50");
      expect(init.method).toBe("GET");
    });

    it("listIssues omits query when no filters", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listIssues({ owner: "o", repo: "r" });
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/issues");
    });

    it("getIssue builds the issue path", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.getIssue("o", "r", 42);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/42");
      expect(init.method).toBe("GET");
    });

    it("createIssue posts the issue body", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.createIssue({
        owner: "o",
        repo: "r",
        title: "Bug",
        body: "desc",
        labels: [1, 2],
        milestone: 3,
      });
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        title: "Bug",
        body: "desc",
        assignee: undefined,
        assignees: undefined,
        labels: [1, 2],
        milestone: 3,
      });
    });

    it("updateIssue patches the issue", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.updateIssue({ owner: "o", repo: "r", index: 7, state: "closed" });
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/7");
      expect(init.method).toBe("PATCH");
    });

    it("deleteIssue sends DELETE and resolves void", async () => {
      const fetchMock = stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.deleteIssue("o", "r", 3);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/3");
      expect(init.method).toBe("DELETE");
    });

    it("searchIssues builds the search query", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.searchIssues({ query: "login", type: "issues", state: "open" });
      const { url } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/issues/search?q=login&type=issues&state=open");
    });

    it("searchIssues omits query when empty", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.searchIssues({});
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/issues/search");
    });
  });

  describe("comments", () => {
    it("listComments builds the comments path", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listComments("o", "r", 5);
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/issues/5/comments");
    });

    it("createComment posts the body", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.createComment("o", "r", 5, "hi");
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/5/comments");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ body: "hi" });
    });

    it("updateComment patches by comment id", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.updateComment("o", "r", 99, "edited");
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/comments/99");
      expect(init.method).toBe("PATCH");
    });

    it("deleteComment sends DELETE", async () => {
      const fetchMock = stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.deleteComment("o", "r", 99);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/comments/99");
      expect(init.method).toBe("DELETE");
    });
  });

  describe("labels", () => {
    it("listLabels builds pagination query", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listLabels("o", "r", 1, 20);
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/labels?page=1&limit=20");
    });

    it("createLabel posts label fields", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.createLabel({ owner: "o", repo: "r", name: "bug", color: "#ff0000" });
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/labels");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        name: "bug",
        color: "#ff0000",
        description: undefined,
      });
    });

    it("updateLabel patches by id", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.updateLabel({ owner: "o", repo: "r", id: 4, color: "00ff00" });
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/labels/4");
      expect(lastCall(fetchMock).init.method).toBe("PATCH");
    });

    it("deleteLabel sends DELETE", async () => {
      const fetchMock = stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.deleteLabel("o", "r", 4);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/labels/4");
      expect(init.method).toBe("DELETE");
    });

    it("addIssueLabels posts label names", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.addIssueLabels("o", "r", 1, ["bug", "ui"]);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/1/labels");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ labels: ["bug", "ui"] });
    });

    it("removeIssueLabel deletes by label id", async () => {
      const fetchMock = stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.removeIssueLabel("o", "r", 1, 8);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/1/labels/8");
      expect(init.method).toBe("DELETE");
    });

    it("replaceIssueLabels puts label names", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.replaceIssueLabels("o", "r", 1, ["x"]);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/1/labels");
      expect(init.method).toBe("PUT");
    });

    it("clearIssueLabels deletes all labels", async () => {
      const fetchMock = stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.clearIssueLabels("o", "r", 1);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/issues/1/labels");
      expect(init.method).toBe("DELETE");
    });
  });

  describe("milestones", () => {
    it("listMilestones builds state query", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listMilestones("o", "r", "open", 1, 10);
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/milestones?state=open&page=1&limit=10");
    });

    it("getMilestone builds the path", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.getMilestone("o", "r", 3);
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/milestones/3");
    });

    it("createMilestone posts milestone fields", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.createMilestone({ owner: "o", repo: "r", title: "v1", due_on: "2025-12-31T00:00:00Z" });
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/milestones");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        title: "v1",
        description: undefined,
        due_on: "2025-12-31T00:00:00Z",
      });
    });

    it("updateMilestone patches by id", async () => {
      const fetchMock = stubFetch(buildResponse({}));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.updateMilestone({ owner: "o", repo: "r", id: 3, state: "closed" });
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/repos/o/r/milestones/3");
      expect(lastCall(fetchMock).init.method).toBe("PATCH");
    });

    it("deleteMilestone sends DELETE", async () => {
      const fetchMock = stubFetch(buildResponse(undefined, 204));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.deleteMilestone("o", "r", 3);
      const { url, init } = lastCall(fetchMock);
      expect(url).toBe("https://g/api/v1/repos/o/r/milestones/3");
      expect(init.method).toBe("DELETE");
    });
  });

  describe("helpers", () => {
    it("listMyRepos builds pagination query", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listMyRepos(3, 30);
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/user/repos?page=3&limit=30");
    });

    it("listMyRepos omits query without pagination", async () => {
      const fetchMock = stubFetch(buildResponse([]));
      const client = new GiteaClient({ baseUrl: "https://g", token: "t" });
      await client.listMyRepos();
      expect(lastCall(fetchMock).url).toBe("https://g/api/v1/user/repos");
    });
  });
});
