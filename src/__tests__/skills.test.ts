import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readdir, access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("parseInstallArgs", () => {
  it("parses the install subcommand", async () => {
    const { parseInstallArgs } = await import("../skills.js");
    expect(parseInstallArgs(["install"])).toEqual({ command: "install", opts: { project: false } });
  });

  it("parses --project", async () => {
    const { parseInstallArgs } = await import("../skills.js");
    expect(parseInstallArgs(["install", "--project"]).opts.project).toBe(true);
  });

  it("parses --dir value and --dir= form", async () => {
    const { parseInstallArgs } = await import("../skills.js");
    expect(parseInstallArgs(["install", "--dir", "/a/b"]).opts.dir).toBe("/a/b");
    expect(parseInstallArgs(["install", "--dir=/c/d"]).opts.dir).toBe("/c/d");
  });

  it("throws when --dir has no value", async () => {
    const { parseInstallArgs } = await import("../skills.js");
    expect(() => parseInstallArgs(["install", "--dir"])).toThrow("--dir requires a path argument");
  });

  it("throws on unknown flags", async () => {
    const { parseInstallArgs } = await import("../skills.js");
    expect(() => parseInstallArgs(["install", "--bogus"])).toThrow("Unknown argument");
  });

  it("reports missing/unknown subcommand", async () => {
    const { parseInstallArgs } = await import("../skills.js");
    expect(parseInstallArgs([]).command).toBeUndefined();
    expect(parseInstallArgs(["frobnicate"]).command).toBe("frobnicate");
  });
});

describe("bundledSkillsDir / resolveInstallDir", () => {
  const SAVED = process.env.OPENCODE_CONFIG_DIR;

  beforeEach(() => {
    delete process.env.OPENCODE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.OPENCODE_CONFIG_DIR = SAVED;
  });

  it("bundledSkillsDir points at assets/skills inside the package", async () => {
    const { bundledSkillsDir } = await import("../skills.js");
    expect(bundledSkillsDir().endsWith(join("assets", "skills"))).toBe(true);
  });

  it("--dir wins over everything", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    expect(resolveInstallDir({ project: true, dir: "/explicit" })).toBe("/explicit");
  });

  it("--project targets the project .opencode/skills root", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    const dir = resolveInstallDir({ project: true });
    expect(dir.endsWith(join(".opencode", "skills"))).toBe(true);
  });

  it("global honors OPENCODE_CONFIG_DIR", async () => {
    const { resolveInstallDir } = await import("../skills.js");
    process.env.OPENCODE_CONFIG_DIR = "/custom/oc";
    expect(resolveInstallDir({ project: false })).toBe(join("/custom/oc", "skills"));
  });
});

describe("runSkillsCommand", () => {
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
    const { runSkillsCommand, bundledSkillsDir } = await import("../skills.js");
    const dest = await mkdtemp(join(tmpdir(), "gitea-skill-"));
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const bundledDir = bundledSkillsDir();
    const expected = await expectedSkillNames(bundledDir);
    expect(expected.length).toBeGreaterThan(0);

    await runSkillsCommand(["install", "--dir", dest]);

    for (const name of expected) {
      const installed = await readFile(join(dest, name, "SKILL.md"), "utf-8");
      const bundled = await readFile(join(bundledDir, name, "SKILL.md"), "utf-8");
      expect(installed).toBe(bundled);
    }

    const out = writeSpy.mock.calls.flat().join(" ");
    expect(out).toContain(`${expected.length} gitea-mcp skill`);
    expect(out).toContain("Restart opencode");
    writeSpy.mockRestore();
    await rm(dest, { recursive: true, force: true });
  });

  it("rejects when no subcommand is given", async () => {
    const { runSkillsCommand } = await import("../skills.js");
    await expect(runSkillsCommand([])).rejects.toThrow("Missing skills subcommand");
  });

  it("rejects on an unknown subcommand", async () => {
    const { runSkillsCommand } = await import("../skills.js");
    await expect(runSkillsCommand(["wat"])).rejects.toThrow("Unknown skills subcommand");
  });
});
