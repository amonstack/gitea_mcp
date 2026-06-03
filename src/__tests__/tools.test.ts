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
