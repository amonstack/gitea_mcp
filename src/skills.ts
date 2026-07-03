import { readdir, mkdir, copyFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const BUNDLED_SKILLS_REL = ["assets", "skills"] as const;
const SKILL_FILENAME = "SKILL.md";

const USAGE = `Usage: gitea-mcp skills install [--project] [--dir <path>]
  --project    install into ./.opencode/skills/ (this project) instead of global
  --dir <path> install into this exact directory (treated as the skills root)`;

export interface InstallOptions {
  project: boolean;
  dir?: string;
}

/** Absolute path to the directory of bundled skills shipped inside dist/. */
export function bundledSkillsDir(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return join(moduleDir, ...BUNDLED_SKILLS_REL);
}

/**
 * Skills root to install into. Each bundled skill (a subdirectory containing a
 * SKILL.md) is copied to `<root>/<skill-name>/`. Precedence: explicit --dir >
 * --project (./.opencode/skills) > global opencode skills dir.
 */
export function resolveInstallDir(opts: InstallOptions): string {
  if (opts.dir) return opts.dir;
  if (opts.project) return join(process.cwd(), ".opencode", "skills");
  const base = process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode");
  return join(base, "skills");
}

/** Parse `gitea-mcp skills <command> [flags]`. Throws on unknown flags or missing --dir value. */
export function parseInstallArgs(argv: string[]): { command: string | undefined; opts: InstallOptions } {
  const opts: InstallOptions = { project: false };
  let command: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") {
      opts.project = true;
    } else if (a === "--dir") {
      const val = argv[++i];
      if (!val) throw new Error("--dir requires a path argument");
      opts.dir = val;
    } else if (a.startsWith("--dir=")) {
      opts.dir = a.slice("--dir=".length);
    } else if (command === undefined && !a.startsWith("-")) {
      command = a;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return { command, opts };
}

/** Recursively copy a directory tree (no experimental fs.cp dependency). */
async function copyTree(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await copyFile(from, to);
    }
  }
}

/**
 * Implements `gitea-mcp skills install`: copies every bundled opencode skill
 * (each subdirectory of dist/assets/skills containing a SKILL.md) into the
 * opencode skills directory so opencode loads them on next start. Does NOT need
 * GITEA_BASE_URL / GITEA_TOKEN.
 */
export async function runSkillsCommand(argv: string[]): Promise<void> {
  const { command, opts } = parseInstallArgs(argv);
  if (command !== "install") {
    const reason = command ? `Unknown skills subcommand: ${command}` : "Missing skills subcommand";
    throw new Error(`${reason}\n${USAGE}`);
  }

  const srcDir = bundledSkillsDir();
  let entries;
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    throw new Error(
      `Bundled skills not found at ${srcDir}. The package may be corrupted or was installed without its assets.`,
    );
  }

  const destRoot = resolveInstallDir(opts);
  const installed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const srcSkill = join(srcDir, entry.name);
    try {
      await access(join(srcSkill, SKILL_FILENAME));
    } catch {
      continue; // not a skill directory — skip
    }
    await copyTree(srcSkill, join(destRoot, entry.name));
    installed.push(entry.name);
  }

  if (installed.length === 0) {
    throw new Error(`No skills found to install under ${srcDir}.`);
  }

  process.stdout.write(`Installed ${installed.length} gitea-mcp skill(s) -> ${destRoot}\n`);
  for (const name of installed) process.stdout.write(`  - ${name}\n`);
  process.stdout.write("Restart opencode for the skills to take effect.\n");
}
