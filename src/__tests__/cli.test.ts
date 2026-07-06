import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runServer } from "../server.js";
import { discoverConfig } from "../git-config.js";

vi.mock("../server.js", () => ({
  runServer: vi.fn(),
}));

vi.mock("../git-config.js", () => ({
  discoverConfig: vi.fn(),
}));

vi.mock("../skills.js", () => ({
  runInitCommand: vi.fn(),
}));

const SKIP_PREFIX = "gitea-mcp: no git remote found in";

describe("cli entry point", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let outSpy: ReturnType<typeof vi.spyOn>;
  let savedArgv: string[];

  beforeEach(() => {
    vi.resetModules();
    savedArgv = process.argv.slice();
    process.argv = ["node", "cli.js"];
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
      }) as never);
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    outSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.mocked(runServer).mockReset();
    vi.mocked(discoverConfig).mockReset();
  });

  afterEach(() => {
    process.argv = savedArgv;
    vi.restoreAllMocks();
  });

  it("exits 0 with a skip reason when no config can be discovered", async () => {
    vi.mocked(discoverConfig).mockResolvedValue(null);
    await expect(import("../cli.js")).rejects.toThrow("process.exit(0)");
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining(SKIP_PREFIX));
    expect(runServer).not.toHaveBeenCalled();
  });

  it("starts the server with the discovered baseUrl/candidates/owner/repo", async () => {
    vi.mocked(discoverConfig).mockResolvedValue({
      baseUrl: "https://gitea.example",
      candidates: [{ source: "env", secret: "tok", schemes: ["token"], status: "pending", nextSchemeIndex: 0 }],
      defaultOwner: "owner",
      defaultRepo: "repo",
      remote: "origin",
    });
    vi.mocked(runServer).mockResolvedValue(undefined);
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(runServer).toHaveBeenCalledWith(
        "https://gitea.example",
        [{ source: "env", secret: "tok", schemes: ["token"], status: "pending", nextSchemeIndex: 0 }],
        "owner",
        "repo",
      );
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("starts the server with empty candidates when discovery yields none", async () => {
    vi.mocked(discoverConfig).mockResolvedValue({
      baseUrl: "https://gitea.example",
      candidates: [],
      defaultOwner: "owner",
      defaultRepo: "repo",
      remote: "origin",
    });
    vi.mocked(runServer).mockResolvedValue(undefined);
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(runServer).toHaveBeenCalledWith("https://gitea.example", [], "owner", "repo");
    });
  });

  it("logs a fatal error and exits 1 when runServer rejects", async () => {
    vi.mocked(discoverConfig).mockResolvedValue({
      baseUrl: "https://gitea.example",
      candidates: [],
    });
    exitSpy.mockImplementation((() => undefined) as never);
    vi.mocked(runServer).mockRejectedValue(new Error("boom"));
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(errSpy).toHaveBeenCalledWith("Fatal error:", expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("dispatches the init subcommand to runInitCommand without credentials", async () => {
    process.argv = ["node", "cli.js", "init", "--tool", "claude"];
    const skills = await import("../skills.js");
    vi.mocked(skills.runInitCommand).mockResolvedValue(undefined);
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(skills.runInitCommand).toHaveBeenCalledWith(["--tool", "claude"]);
    });
    expect(runServer).not.toHaveBeenCalled();
    expect(discoverConfig).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("logs a fatal error and exits 1 when runInitCommand rejects", async () => {
    process.argv = ["node", "cli.js", "init"];
    exitSpy.mockImplementation((() => undefined) as never);
    const skills = await import("../skills.js");
    vi.mocked(skills.runInitCommand).mockRejectedValue(new Error("boom"));
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(errSpy).toHaveBeenCalledWith("Fatal error:", expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("prints top-level usage and exits 0 on --help", async () => {
    process.argv = ["node", "cli.js", "--help"];
    await expect(import("../cli.js")).rejects.toThrow("process.exit(0)");
    const out = outSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(out).toContain("Usage: gitea-mcp");
    expect(out).toContain("Commands:");
    expect(out).toContain("init");
    expect(out).toContain("-h, --help");
    expect(runServer).not.toHaveBeenCalled();
    expect(discoverConfig).not.toHaveBeenCalled();
  });

  it("prints top-level usage and exits 0 on -h", async () => {
    process.argv = ["node", "cli.js", "-h"];
    await expect(import("../cli.js")).rejects.toThrow("process.exit(0)");
    expect(outSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("")).toContain("Usage: gitea-mcp");
    expect(runServer).not.toHaveBeenCalled();
  });

  it("prints top-level usage and exits 0 on help subcommand", async () => {
    process.argv = ["node", "cli.js", "help"];
    await expect(import("../cli.js")).rejects.toThrow("process.exit(0)");
    expect(outSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("")).toContain("Usage: gitea-mcp");
    expect(discoverConfig).not.toHaveBeenCalled();
  });

  it("prints version and exits 0 on --version", async () => {
    process.argv = ["node", "cli.js", "--version"];
    await expect(import("../cli.js")).rejects.toThrow("process.exit(0)");
    const out = outSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(out).toMatch(/gitea-mcp \d+\.\d+\.\d+/);
    expect(runServer).not.toHaveBeenCalled();
    expect(discoverConfig).not.toHaveBeenCalled();
  });

  it("prints version and exits 0 on -V", async () => {
    process.argv = ["node", "cli.js", "-V"];
    await expect(import("../cli.js")).rejects.toThrow("process.exit(0)");
    expect(outSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("")).toMatch(/gitea-mcp \d+\.\d+\.\d+/);
    expect(runServer).not.toHaveBeenCalled();
  });
});
