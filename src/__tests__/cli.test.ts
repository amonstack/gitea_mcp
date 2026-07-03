import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runServer } from "../server.js";

vi.mock("../server.js", () => ({
  runServer: vi.fn(),
}));

vi.mock("../skills.js", () => ({
  runInitCommand: vi.fn(),
}));

const REQUIRED_MESSAGE = "GITEA_BASE_URL and GITEA_TOKEN environment variables are required";

describe("cli entry point", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let savedEnv: NodeJS.ProcessEnv;
  let savedArgv: string[];

  beforeEach(() => {
    vi.resetModules();
    savedEnv = { ...process.env };
    savedArgv = process.argv.slice();
    // Deterministic argv so tests do not depend on the vitest runner's flags.
    process.argv = ["node", "cli.js"];
    delete process.env.GITEA_BASE_URL;
    delete process.env.GITEA_TOKEN;
    delete process.env.GITEA_DEFAULT_OWNER;
    delete process.env.GITEA_DEFAULT_REPO;
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
      }) as never);
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(runServer).mockReset();
  });

  afterEach(() => {
    process.env = savedEnv;
    process.argv = savedArgv;
    vi.restoreAllMocks();
  });

  it("exits with code 1 when GITEA_BASE_URL is missing", async () => {
    process.env.GITEA_TOKEN = "t";
    await expect(import("../cli.js")).rejects.toThrow("process.exit(1)");
    expect(errSpy).toHaveBeenCalledWith(REQUIRED_MESSAGE);
    expect(runServer).not.toHaveBeenCalled();
  });

  it("exits with code 1 when GITEA_TOKEN is missing", async () => {
    process.env.GITEA_BASE_URL = "https://g.example";
    await expect(import("../cli.js")).rejects.toThrow("process.exit(1)");
    expect(errSpy).toHaveBeenCalledWith(REQUIRED_MESSAGE);
    expect(runServer).not.toHaveBeenCalled();
  });

  it("exits with code 1 when both required vars are missing", async () => {
    await expect(import("../cli.js")).rejects.toThrow("process.exit(1)");
    expect(errSpy).toHaveBeenCalledWith(REQUIRED_MESSAGE);
    expect(runServer).not.toHaveBeenCalled();
  });

  it("calls runServer with env values when required vars are present", async () => {
    process.env.GITEA_BASE_URL = "https://g.example";
    process.env.GITEA_TOKEN = "tok";
    vi.mocked(runServer).mockResolvedValue(undefined);
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(runServer).toHaveBeenCalledWith("https://g.example", "tok", undefined, undefined);
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("passes GITEA_DEFAULT_OWNER and GITEA_DEFAULT_REPO through", async () => {
    process.env.GITEA_BASE_URL = "https://g.example";
    process.env.GITEA_TOKEN = "tok";
    process.env.GITEA_DEFAULT_OWNER = "myorg";
    process.env.GITEA_DEFAULT_REPO = "myrepo";
    vi.mocked(runServer).mockResolvedValue(undefined);
    await import("../cli.js");
    await vi.waitFor(() => {
      expect(runServer).toHaveBeenCalledWith("https://g.example", "tok", "myorg", "myrepo");
    });
  });

  it("logs a fatal error and exits when runServer rejects", async () => {
    process.env.GITEA_BASE_URL = "https://g.example";
    process.env.GITEA_TOKEN = "tok";
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
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("logs a fatal error and exits when runInitCommand rejects", async () => {
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
});
