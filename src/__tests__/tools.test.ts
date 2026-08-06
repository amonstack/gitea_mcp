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
  ListWikiPagesSchema,
  GetWikiPageSchema,
  CreateWikiPageSchema,
  UpdateWikiPageSchema,
  DeleteWikiPageSchema,
  ListWikiRevisionsSchema,
  ListIssueDependenciesSchema,
  AddIssueDependencySchema,
  RemoveIssueDependencySchema,
  ListIssueBlocksSchema,
  AddIssueBlockSchema,
  RemoveIssueBlockSchema,
  CheckIssueBlockedSchema,
  ListProjectsSchema,
  GetProjectSchema,
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

// ── Wiki ──

describe("ListWikiPagesSchema", () => {
  it("accepts empty input", () => {
    const result = ListWikiPagesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts pagination", () => {
    const result = ListWikiPagesSchema.parse({ owner: "o", repo: "r", page: 2, limit: 50 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it("rejects limit above 100", () => {
    const result = ListWikiPagesSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});

describe("GetWikiPageSchema", () => {
  it("requires pageName", () => {
    const result = GetWikiPageSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty pageName", () => {
    const result = GetWikiPageSchema.safeParse({ pageName: "" });
    expect(result.success).toBe(false);
  });

  it("accepts pageName only", () => {
    const result = GetWikiPageSchema.parse({ pageName: "Getting-Started" });
    expect(result.pageName).toBe("Getting-Started");
  });
});

describe("CreateWikiPageSchema", () => {
  it("requires title and content", () => {
    expect(CreateWikiPageSchema.safeParse({ title: "Home" }).success).toBe(false);
    expect(CreateWikiPageSchema.safeParse({ content: "# Hi" }).success).toBe(false);
  });

  it("accepts minimal valid input", () => {
    const result = CreateWikiPageSchema.parse({ title: "Home", content: "# Welcome" });
    expect(result.title).toBe("Home");
    expect(result.message).toBeUndefined();
  });

  it("accepts an optional commit message", () => {
    const result = CreateWikiPageSchema.parse({ title: "Home", content: "x", message: "add home" });
    expect(result.message).toBe("add home");
  });
});

describe("UpdateWikiPageSchema", () => {
  it("requires pageName", () => {
    const result = UpdateWikiPageSchema.safeParse({ content: "x" });
    expect(result.success).toBe(false);
  });

  it("accepts pageName only (no-op update)", () => {
    const result = UpdateWikiPageSchema.parse({ pageName: "Home" });
    expect(result.title).toBeUndefined();
    expect(result.content).toBeUndefined();
  });

  it("accepts a rename without content", () => {
    const result = UpdateWikiPageSchema.parse({ pageName: "Old-Name", title: "New-Name" });
    expect(result.title).toBe("New-Name");
    expect(result.content).toBeUndefined();
  });
});

describe("DeleteWikiPageSchema", () => {
  it("requires pageName", () => {
    const result = DeleteWikiPageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts pageName with owner/repo", () => {
    const result = DeleteWikiPageSchema.parse({ owner: "o", repo: "r", pageName: "Home" });
    expect(result.pageName).toBe("Home");
  });
});

describe("ListWikiRevisionsSchema", () => {
  it("requires pageName", () => {
    const result = ListWikiRevisionsSchema.safeParse({ page: 1 });
    expect(result.success).toBe(false);
  });

  it("accepts pageName and optional page", () => {
    const result = ListWikiRevisionsSchema.parse({ pageName: "Home", page: 3 });
    expect(result.pageName).toBe("Home");
    expect(result.page).toBe(3);
  });
});

describe("ListIssueDependenciesSchema", () => {
  it("requires index", () => {
    const result = ListIssueDependenciesSchema.safeParse({ owner: "o", repo: "r" });
    expect(result.success).toBe(false);
  });

  it("accepts index with optional pagination", () => {
    const result = ListIssueDependenciesSchema.parse({ index: 7, page: 2, limit: 50 });
    expect(result.index).toBe(7);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });
});

describe("CheckIssueBlockedSchema", () => {
  it("requires index", () => {
    const result = CheckIssueBlockedSchema.safeParse({ owner: "o", repo: "r" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive index", () => {
    const result = CheckIssueBlockedSchema.safeParse({ index: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts index with optional owner/repo", () => {
    const result = CheckIssueBlockedSchema.parse({ owner: "o", repo: "r", index: 42 });
    expect(result.index).toBe(42);
    expect(result.owner).toBe("o");
    expect(result.repo).toBe("r");
  });

  it("exposes no page/limit parameters (unknown keys are stripped)", () => {
    const result = CheckIssueBlockedSchema.parse({ index: 42, page: 1, limit: 50 });
    expect(result.index).toBe(42);
    expect(result).not.toHaveProperty("page");
    expect(result).not.toHaveProperty("limit");
  });
});

describe("AddIssueDependencySchema", () => {
  it("requires index and dep_index", () => {
    const result = AddIssueDependencySchema.safeParse({ index: 7 });
    expect(result.success).toBe(false);
  });

  it("accepts same-repo defaults and cross-repo targets", () => {
    const sameRepo = AddIssueDependencySchema.parse({ index: 7, dep_index: 9 });
    expect(sameRepo.dep_index).toBe(9);
    expect(sameRepo.dep_owner).toBeUndefined();

    const crossRepo = AddIssueDependencySchema.parse({
      index: 7, dep_index: 9, dep_owner: "other", dep_repo: "proj",
    });
    expect(crossRepo.dep_owner).toBe("other");
    expect(crossRepo.dep_repo).toBe("proj");
  });
});

describe("RemoveIssueDependencySchema", () => {
  it("requires index and dep_index", () => {
    expect(RemoveIssueDependencySchema.safeParse({ index: 7 }).success).toBe(false);
    expect(RemoveIssueDependencySchema.safeParse({ dep_index: 9 }).success).toBe(false);
  });

  it("accepts index + dep_index", () => {
    const result = RemoveIssueDependencySchema.parse({ index: 7, dep_index: 9 });
    expect(result.index).toBe(7);
    expect(result.dep_index).toBe(9);
  });
});

describe("ListIssueBlocksSchema", () => {
  it("requires index", () => {
    expect(ListIssueBlocksSchema.safeParse({}).success).toBe(false);
  });

  it("accepts index with optional pagination", () => {
    const result = ListIssueBlocksSchema.parse({ index: 7 });
    expect(result.index).toBe(7);
  });
});

describe("AddIssueBlockSchema", () => {
  it("requires index and dep_index", () => {
    expect(AddIssueBlockSchema.safeParse({ index: 7 }).success).toBe(false);
  });

  it("accepts index + dep_index with optional dep owner/repo", () => {
    const result = AddIssueBlockSchema.parse({ index: 7, dep_index: 9, dep_owner: "x" });
    expect(result.dep_index).toBe(9);
    expect(result.dep_owner).toBe("x");
  });
});

describe("RemoveIssueBlockSchema", () => {
  it("requires index and dep_index", () => {
    expect(RemoveIssueBlockSchema.safeParse({ index: 7 }).success).toBe(false);
    expect(RemoveIssueBlockSchema.safeParse({ dep_index: 9 }).success).toBe(false);
  });

  it("accepts index + dep_index", () => {
    const result = RemoveIssueBlockSchema.parse({ index: 7, dep_index: 9 });
    expect(result.index).toBe(7);
    expect(result.dep_index).toBe(9);
  });
});

// ── Projects (placeholder) ──

describe("ListProjectsSchema", () => {
  it("accepts empty input", () => {
    const result = ListProjectsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts owner/repo", () => {
    const result = ListProjectsSchema.parse({ owner: "o", repo: "r" });
    expect(result.owner).toBe("o");
    expect(result.repo).toBe("r");
  });
});

describe("GetProjectSchema", () => {
  it("requires id", () => {
    const result = GetProjectSchema.safeParse({ owner: "a", repo: "b" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive id", () => {
    const result = GetProjectSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts id with optional owner/repo", () => {
    const result = GetProjectSchema.parse({ owner: "o", repo: "r", id: 5 });
    expect(result.id).toBe(5);
    expect(result.owner).toBe("o");
    expect(result.repo).toBe("r");
  });
});
