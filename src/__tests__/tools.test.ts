import { describe, it, expect } from "vitest";
import {
  ListIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  DeleteIssueSchema,
  SearchIssuesSchema,
  CreateLabelSchema,
  CreateMilestoneSchema,
  ResolveRepoSchema,
  ListTopicsSchema,
  ReplaceTopicsSchema,
  AddTopicSchema,
  RemoveTopicSchema,
  ListActionRunsSchema,
  GetActionRunSchema,
  CancelActionRunSchema,
  RerunActionRunSchema,
  RerunActionRunFailedJobsSchema,
  UpdateRepoSchema,
} from "../tools.js";

describe("ListIssuesSchema", () => {
  it("accepts minimal input", () => {
    const result = ListIssuesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("defaults state to open", () => {
    const result = ListIssuesSchema.parse({});
    expect(result.state).toBe("open");
  });

  it("accepts all optional fields", () => {
    const result = ListIssuesSchema.parse({
      owner: "myorg",
      repo: "myrepo",
      state: "closed",
      labels: "bug,enhancement",
      page: 2,
      limit: 50,
    });
    expect(result.owner).toBe("myorg");
    expect(result.repo).toBe("myrepo");
    expect(result.state).toBe("closed");
  });
});

describe("GetIssueSchema", () => {
  it("requires index", () => {
    const result = GetIssueSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("accepts with owner/repo optional", () => {
    const result = GetIssueSchema.safeParse({ index: 1 });
    expect(result.success).toBe(true);
  });
});

describe("CreateIssueSchema", () => {
  it("requires title", () => {
    const result = CreateIssueSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input", () => {
    const result = CreateIssueSchema.parse({ title: "Bug report" });
    expect(result.title).toBe("Bug report");
  });
});

describe("UpdateIssueSchema", () => {
  it("requires index", () => {
    const result = UpdateIssueSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("accepts partial update", () => {
    const result = UpdateIssueSchema.parse({ index: 5, title: "Updated" });
    expect(result.index).toBe(5);
    expect(result.title).toBe("Updated");
  });
});

describe("DeleteIssueSchema", () => {
  it("requires index", () => {
    const result = DeleteIssueSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts index only", () => {
    const result = DeleteIssueSchema.parse({ index: 3 });
    expect(result.index).toBe(3);
  });
});

describe("SearchIssuesSchema", () => {
  it("accepts empty input", () => {
    const result = SearchIssuesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts query only", () => {
    const result = SearchIssuesSchema.parse({ query: "login bug" });
    expect(result.query).toBe("login bug");
  });
});

describe("CreateLabelSchema", () => {
  it("requires name and color", () => {
    const result = CreateLabelSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("accepts valid hex color", () => {
    const result = CreateLabelSchema.safeParse({ name: "bug", color: "#ff0000" });
    expect(result.success).toBe(true);
  });

  it("accepts color without #", () => {
    const result = CreateLabelSchema.safeParse({ name: "bug", color: "ff0000" });
    expect(result.success).toBe(true);
  });
});

describe("CreateMilestoneSchema", () => {
  it("requires title", () => {
    const result = CreateMilestoneSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("accepts title only", () => {
    const result = CreateMilestoneSchema.parse({ title: "v1.0" });
    expect(result.title).toBe("v1.0");
  });
});

describe("ResolveRepoSchema", () => {
  it("accepts empty input", () => {
    const result = ResolveRepoSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts path", () => {
    const result = ResolveRepoSchema.parse({ path: "/tmp/repo" });
    expect(result.path).toBe("/tmp/repo");
  });
});

describe("ListTopicsSchema", () => {
  it("accepts minimal input", () => {
    const result = ListTopicsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts owner/repo and pagination", () => {
    const result = ListTopicsSchema.parse({ owner: "o", repo: "r", page: 2, limit: 50 });
    expect(result.owner).toBe("o");
    expect(result.page).toBe(2);
  });
});

describe("ReplaceTopicsSchema", () => {
  it("requires topics", () => {
    const result = ReplaceTopicsSchema.safeParse({ owner: "o", repo: "r" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty list (clears all topics)", () => {
    const result = ReplaceTopicsSchema.parse({ topics: [] });
    expect(result.topics).toEqual([]);
  });

  it("accepts valid lowercase topic names", () => {
    const result = ReplaceTopicsSchema.parse({ topics: ["go", "mcp-server", "node-js"] });
    expect(result.topics).toEqual(["go", "mcp-server", "node-js"]);
  });

  it("rejects uppercase topic names", () => {
    const result = ReplaceTopicsSchema.safeParse({ topics: ["Go"] });
    expect(result.success).toBe(false);
  });

  it("rejects a topic name starting with a hyphen", () => {
    const result = ReplaceTopicsSchema.safeParse({ topics: ["-bad"] });
    expect(result.success).toBe(false);
  });
});

describe("AddTopicSchema", () => {
  it("requires topic", () => {
    const result = AddTopicSchema.safeParse({ owner: "o", repo: "r" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid topic name", () => {
    const result = AddTopicSchema.parse({ topic: "go" });
    expect(result.topic).toBe("go");
  });

  it("rejects an uppercase topic name", () => {
    const result = AddTopicSchema.safeParse({ topic: "GoLang" });
    expect(result.success).toBe(false);
  });
});

describe("RemoveTopicSchema", () => {
  it("requires topic", () => {
    const result = RemoveTopicSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a valid topic name", () => {
    const result = RemoveTopicSchema.parse({ topic: "mcp" });
    expect(result.topic).toBe("mcp");
  });
});

// ── Actions ──

describe("ListActionRunsSchema", () => {
  it("accepts empty input", () => {
    const result = ListActionRunsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts all optional filters", () => {
    const result = ListActionRunsSchema.parse({
      owner: "o",
      repo: "r",
      branch: "main",
      event: "push",
      status: "failure",
      actor: "alice",
      head_sha: "abc123",
      page: 2,
      limit: 50,
    });
    expect(result.status).toBe("failure");
    expect(result.actor).toBe("alice");
  });
});

describe("GetActionRunSchema", () => {
  it("requires runId", () => {
    const result = GetActionRunSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("accepts runId only", () => {
    const result = GetActionRunSchema.parse({ runId: 42 });
    expect(result.runId).toBe(42);
  });
});

describe("CancelActionRunSchema", () => {
  it("requires runId", () => {
    const result = CancelActionRunSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts runId with owner/repo", () => {
    const result = CancelActionRunSchema.parse({ owner: "o", repo: "r", runId: 7 });
    expect(result.runId).toBe(7);
  });
});

describe("RerunActionRunSchema", () => {
  it("requires runId", () => {
    const result = RerunActionRunSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts runId only", () => {
    const result = RerunActionRunSchema.parse({ runId: 99 });
    expect(result.runId).toBe(99);
  });
});

describe("RerunActionRunFailedJobsSchema", () => {
  it("requires runId", () => {
    const result = RerunActionRunFailedJobsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts runId only", () => {
    const result = RerunActionRunFailedJobsSchema.parse({ runId: 5 });
    expect(result.runId).toBe(5);
  });
});

describe("UpdateRepoSchema", () => {
  it("accepts empty input (no fields to update)", () => {
    const result = UpdateRepoSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts owner/repo and a single metadata field", () => {
    const result = UpdateRepoSchema.parse({ owner: "o", repo: "r", description: "new desc" });
    expect(result.owner).toBe("o");
    expect(result.description).toBe("new desc");
    expect(result.name).toBeUndefined();
  });

  it("accepts all metadata fields", () => {
    const result = UpdateRepoSchema.parse({
      name: "new-name",
      description: "d",
      website: "https://x.example",
      private: true,
      default_branch: "main",
    });
    expect(result.private).toBe(true);
    expect(result.default_branch).toBe("main");
  });

  it("rejects a non-boolean private value", () => {
    const result = UpdateRepoSchema.safeParse({ private: "yes" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty description (clears it)", () => {
    const result = UpdateRepoSchema.parse({ description: "" });
    expect(result.description).toBe("");
  });
});
