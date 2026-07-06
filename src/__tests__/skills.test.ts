import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readdir, access, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("parseInitArgs", () => {
  it("defaults tool to opencode", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(parseInitArgs([])).toEqual({ tool: "opencode", project: false, help: false });
  });

  it("parses --tool value and --tool= form", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(parseInitArgs(["--tool", "claude"]).tool).toBe("claude");
    expect(parseInitArgs(["--tool=cursor"]).tool).toBe("cursor");
  });

  it("parses --project", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(parseInitArgs(["--project"]).project).toBe(true);
  });

  it("parses --dir value and --dir= form", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(parseInitArgs(["--dir", "/a/b"]).dir).toBe("/a/b");
    expect(parseInitArgs(["--dir=/c/d"]).dir).toBe("/c/d");
  });

  it("throws when --tool has no value", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(() => parseInitArgs(["--tool"])).toThrow("--tool requires a name argument");
  });

  it("throws when --dir has no value", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(() => parseInitArgs(["--dir"])).toThrow("--dir requires a path argument");
  });

  it("throws on unknown flags", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(() => parseInitArgs(["--bogus"])).toThrow("Unknown argument");
  });

  it("sets help=true on -h / --help and stops parsing", async () => {
    const { parseInitArgs } = await import("../skills.js");
    expect(parseInitArgs(["--help"]).help).toBe(true);
    expect(parseInitArgs(["-h"]).help).toBe(true);
    // help short-circuits: later args are not validated
    expect(parseInitArgs(["--help", "--bogus"]).help).toBe(true);
  });
});

describe("tool registry", () => {
  const EXPECTED_TOOLS = [
    "amazon-q", "antigravity", "auggie", "claude", "cline", "codex", "codebuddy",
    "continue", "costrict", "crush", "cursor", "factory", "gemini", "github-copilot",
    "iflow", "kilocode", "opencode", "qoder", "qwen", "roocode", "windsurf",
  ];

  it("registers every supported tool", async () => {
    const { TOOL_REGISTRY, supportedTools } = await import("../skills.js");
    for (const name of EXPECTED_TOOLS) expect(TOOL_REGISTRY[name]).toBeDefined();
    expect(supportedTools()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("resolveTool returns the target, throws listing supported tools on unknown", async () => {
    const { resolveTool } = await import("../skills.js");
    expect(resolveTool("claude").label).toBe("Claude Code");
    expect(() => resolveTool("nope")).toThrow("Unsupported tool: nope");
    expect(() => resolveTool("nope")).toThrow("claude");
  });

  it("every tool resolves to a global and project dir ending in skills", async () => {
    const { TOOL_REGISTRY, resolveInstallDir } = await import("../skills.js");
    for (const name of Object.keys(TOOL_REGISTRY)) {
      expect(resolveInstallDir({ tool: name, project: false }).endsWith("skills")).toBe(true);
      expect(resolveInstallDir({ tool: name, project: true }).endsWith("skills")).toBe(true);
    }
  });
});

describe("resolveInstallDir", () => {
  const SAVED = process.env.OPENCODE_CONFIG_DIR;

  beforeEach(() => {
    delete process.env.OPENCODE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.OPENCODE_CONFIG_DIR = SAVED;
  });

  it("--dir wins over --tool and --project", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    expect(resolveInstallDir({ tool: "claude", project: true, dir: "/explicit" })).toBe("/explicit");
  });

  it("global dir for a non-opencode tool", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    const dir = resolveInstallDir({ tool: "claude", project: false });
    expect(dir.endsWith(join(".claude", "skills"))).toBe(true);
  });

  it("--project targets the per-tool project skills root", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    const dir = resolveInstallDir({ tool: "cursor", project: true });
    expect(dir.endsWith(join(".cursor", "skills"))).toBe(true);
  });

  it("opencode global honors OPENCODE_CONFIG_DIR", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    process.env.OPENCODE_CONFIG_DIR = "/custom/oc";
    expect(resolveInstallDir({ tool: "opencode", project: false })).toBe(join("/custom/oc", "skills"));
  });
});

describe("runInitCommand", () => {
  /** Subdirectories of the bundled skills dir that contain a SKILL.md. */
  async function expectedSkillNames(bundledDir: string): Promise<string[]> {
    const entries = await readdir(bundledDir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        await access(join(bundledDir, entry.name, "SKILL.md"));
        names.push(entry.name);
      } catch {
        // not a skill directory
      }
    }
    return names;
  }

  it("installs every bundled skill into --dir (hermetic)", async () => {
    const { runInitCommand, bundledSkillsDir } = await import("../skills.js");
    const dest = await mkdtemp(join(tmpdir(), "gitea-skill-"));
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const bundledDir = bundledSkillsDir();
    const expected = await expectedSkillNames(bundledDir);
    expect(expected.length).toBeGreaterThanOrEqual(9);
    expect(expected).toContain("gitea-comment-issue");

    await runInitCommand(["--tool", "claude", "--dir", dest]);

    for (const name of expected) {
      const installed = await readFile(join(dest, name, "SKILL.md"), "utf-8");
      const bundled = await readFile(join(bundledDir, name, "SKILL.md"), "utf-8");
      expect(installed).toBe(bundled);
    }

    const out = writeSpy.mock.calls.flat().join(" ");
    expect(out).toContain(`${expected.length} gitea-mcp skill`);
    expect(out).toContain("Claude Code");
    writeSpy.mockRestore();
    await rm(dest, { recursive: true, force: true });
  });

  it("rejects an unsupported tool", async () => {
    const { runInitCommand } = await import("../skills.js");
    await expect(runInitCommand(["--tool", "nope", "--dir", "/tmp"])).rejects.toThrow(
      "Unsupported tool: nope",
    );
  });

  it("prints usage to stdout and resolves (exit 0) on --help / -h", async () => {
    const { runInitCommand, USAGE } = await import("../skills.js");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(runInitCommand(["--help"])).resolves.toBeUndefined();
    await expect(runInitCommand(["-h"])).resolves.toBeUndefined();

    const out = writeSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(out).toContain(USAGE);
    // usage printed exactly twice (once per call)
    expect(out.split(USAGE).length).toBe(3);

    writeSpy.mockRestore();
  });
});

describe("installSkills (defensive branches)", () => {
  it("recurses into nested subdirectories of a skill", async () => {
    const { installSkills } = await import("../skills.js");
    const src = await mkdtemp(join(tmpdir(), "gitea-src-"));
    const dest = await mkdtemp(join(tmpdir(), "gitea-dest-"));
    await mkdir(join(src, "skill-a", "sub"), { recursive: true });
    await writeFile(join(src, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");
    await writeFile(join(src, "skill-a", "sub", "nested.md"), "deep");

    const installed = await installSkills(src, dest);
    expect(installed).toEqual(["skill-a"]);
    await expect(readFile(join(dest, "skill-a", "sub", "nested.md"), "utf-8")).resolves.toBe("deep");
    await rm(src, { recursive: true, force: true });
    await rm(dest, { recursive: true, force: true });
  });

  it("throws when the source skills dir is missing", async () => {
    const { installSkills } = await import("../skills.js");
    const dest = await mkdtemp(join(tmpdir(), "gitea-dest-"));
    const missing = join(tmpdir(), "gitea-does-not-exist-" + Date.now());
    await expect(installSkills(missing, dest)).rejects.toThrow(missing);
    await rm(dest, { recursive: true, force: true });
  });

  it("skips subdirectories that do not contain a SKILL.md", async () => {
    const { installSkills } = await import("../skills.js");
    const src = await mkdtemp(join(tmpdir(), "gitea-src-"));
    const dest = await mkdtemp(join(tmpdir(), "gitea-dest-"));
    await mkdir(join(src, "real-skill"));
    await writeFile(join(src, "real-skill", "SKILL.md"), "---\nname: real-skill\n---\n");
    await mkdir(join(src, "not-a-skill"));
    await writeFile(join(src, "not-a-skill", "other.md"), "ignore me");
    await writeFile(join(src, "loose-file.md"), "top-level non-directory entry");

    const installed = await installSkills(src, dest);
    expect(installed).toEqual(["real-skill"]);
    await expect(access(join(dest, "not-a-skill"))).rejects.toThrow();
    await expect(access(join(dest, "loose-file.md"))).rejects.toThrow();
    await rm(src, { recursive: true, force: true });
    await rm(dest, { recursive: true, force: true });
  });

  it("throws when no skill is found under the source dir", async () => {
    const { installSkills } = await import("../skills.js");
    const src = await mkdtemp(join(tmpdir(), "gitea-src-"));
    const dest = await mkdtemp(join(tmpdir(), "gitea-dest-"));
    await mkdir(join(src, "empty-dir"));
    await writeFile(join(src, "empty-dir", "no-skill-here.md"), "nothing");

    await expect(installSkills(src, dest)).rejects.toThrow("No skills found to install");
    await rm(src, { recursive: true, force: true });
    await rm(dest, { recursive: true, force: true });
  });
});
