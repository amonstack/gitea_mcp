import { readdir, mkdir, copyFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const BUNDLED_SKILLS_REL = ["assets", "skills"] as const;
const SKILL_FILENAME = "SKILL.md";
const DEFAULT_TOOL = "opencode";

const USAGE = `Usage: gitea-mcp init [--tool <name>] [--project] [--dir <path>]
  --tool <name>  target AI tool (default: ${DEFAULT_TOOL})
  --project      install into ./.<tool>/skills/ instead of the tool's global skills dir
  --dir <path>   install into this exact directory (overrides --tool and --project)
Supported tools:
  amazon-q, antigravity, auggie, claude, cline, codex, codebuddy, continue,
  costrict, crush, cursor, factory, gemini, github-copilot, iflow, kilocode,
  opencode, qoder, qwen, roocode, windsurf`;

export interface InitOptions {
  tool: string;
  project: boolean;
  dir?: string;
}

/** A supported target tool and where its skills live. */
export interface ToolTarget {
  /** Human-readable label. */
  label: string;
  /** Absolute global skills directory for this tool (lazy — evaluated at resolve time). */
  globalSkillsDir: () => string;
  /** Project-relative skills directory for this tool (relative to cwd). */
  projectSkillsDir: string;
}

/** opencode honors OPENCODE_CONFIG_DIR; everything else is home-relative. */
function opencodeBase(): string {
  return process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode");
}

/**
 * Registry of supported tools and their conventional skills directories.
 *
 * Global paths follow each tool's documented config home plus a `skills/`
 * folder. For tools without a publicly documented skills folder, a
 * `~/.config/<tool>/skills/` convention is used; override the destination
 * with `--dir <path>` for an exact location.
 */
/** Lazy home-relative path (homedir is read at call time). */
const home = (...parts: string[]): string => join(homedir(), ...parts);

export const TOOL_REGISTRY: Record<string, ToolTarget> = {
  "amazon-q": { label: "Amazon Q", globalSkillsDir: () => home(".aws", "amazonq", "skills"), projectSkillsDir: join(".amazonq", "skills") },
  antigravity: { label: "Antigravity", globalSkillsDir: () => home(".config", "antigravity", "skills"), projectSkillsDir: join(".antigravity", "skills") },
  auggie: { label: "Auggie", globalSkillsDir: () => home(".config", "auggie", "skills"), projectSkillsDir: join(".auggie", "skills") },
  claude: { label: "Claude Code", globalSkillsDir: () => home(".claude", "skills"), projectSkillsDir: join(".claude", "skills") },
  cline: { label: "Cline", globalSkillsDir: () => home(".cline", "skills"), projectSkillsDir: join(".cline", "skills") },
  codex: { label: "Codex CLI", globalSkillsDir: () => home(".codex", "skills"), projectSkillsDir: join(".codex", "skills") },
  codebuddy: { label: "CodeBuddy", globalSkillsDir: () => home(".config", "codebuddy", "skills"), projectSkillsDir: join(".codebuddy", "skills") },
  continue: { label: "Continue", globalSkillsDir: () => home(".continue", "skills"), projectSkillsDir: join(".continue", "skills") },
  costrict: { label: "Costrict", globalSkillsDir: () => home(".config", "costrict", "skills"), projectSkillsDir: join(".costrict", "skills") },
  crush: { label: "Crush", globalSkillsDir: () => home(".config", "crush", "skills"), projectSkillsDir: join(".crush", "skills") },
  cursor: { label: "Cursor", globalSkillsDir: () => home(".cursor", "skills"), projectSkillsDir: join(".cursor", "skills") },
  factory: { label: "Factory", globalSkillsDir: () => home(".factory", "skills"), projectSkillsDir: join(".factory", "skills") },
  gemini: { label: "Gemini CLI", globalSkillsDir: () => home(".gemini", "skills"), projectSkillsDir: join(".gemini", "skills") },
  "github-copilot": { label: "GitHub Copilot", globalSkillsDir: () => home(".config", "github-copilot", "skills"), projectSkillsDir: join(".github", "copilot", "skills") },
  iflow: { label: "iFlow", globalSkillsDir: () => home(".config", "iflow", "skills"), projectSkillsDir: join(".iflow", "skills") },
  kilocode: { label: "Kilo Code", globalSkillsDir: () => home(".kilo", "skills"), projectSkillsDir: join(".kilo", "skills") },
  opencode: { label: "opencode", globalSkillsDir: () => join(opencodeBase(), "skills"), projectSkillsDir: join(".opencode", "skills") },
  qoder: { label: "Qoder", globalSkillsDir: () => home(".config", "qoder", "skills"), projectSkillsDir: join(".qoder", "skills") },
  qwen: { label: "Qwen Code", globalSkillsDir: () => home(".qwen", "skills"), projectSkillsDir: join(".qwen", "skills") },
  roocode: { label: "Roo Code", globalSkillsDir: () => home(".roo", "skills"), projectSkillsDir: join(".roo", "skills") },
  windsurf: { label: "Windsurf", globalSkillsDir: () => home(".codeium", "windsurf", "skills"), projectSkillsDir: join(".windsurf", "skills") },
};

/** Sorted list of supported tool names (for help and error messages). */
export function supportedTools(): string[] {
  return Object.keys(TOOL_REGISTRY).sort();
}

/** Look up a tool, throwing a helpful error listing every supported tool. */
export function resolveTool(name: string): ToolTarget {
  const target = TOOL_REGISTRY[name];
  if (!target) {
    throw new Error(`Unsupported tool: ${name}\nSupported tools: ${supportedTools().join(", ")}`);
  }
  return target;
}

/** Absolute path to the directory of bundled skills shipped inside dist/. */
export function bundledSkillsDir(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return join(moduleDir, ...BUNDLED_SKILLS_REL);
}

/**
 * Skills root to install into. Each bundled skill (a subdirectory containing a
 * SKILL.md) is copied to `<root>/<skill-name>/`. Precedence: explicit --dir >
 * --project (./.<tool>/skills) > the tool's global skills dir.
 */
export function resolveInstallDir(opts: InitOptions): string {
  if (opts.dir) return opts.dir;
  const target = resolveTool(opts.tool);
  if (opts.project) return join(process.cwd(), target.projectSkillsDir);
  return target.globalSkillsDir();
}

/** Parse `gitea-mcp init [flags]`. Throws on unknown flags or missing values. */
export function parseInitArgs(argv: string[]): InitOptions {
  const opts: InitOptions = { tool: DEFAULT_TOOL, project: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") {
      opts.project = true;
    } else if (a === "--tool") {
      const val = argv[++i];
      if (!val) throw new Error("--tool requires a name argument");
      opts.tool = val;
    } else if (a.startsWith("--tool=")) {
      opts.tool = a.slice("--tool=".length);
    } else if (a === "--dir") {
      const val = argv[++i];
      if (!val) throw new Error("--dir requires a path argument");
      opts.dir = val;
    } else if (a.startsWith("--dir=")) {
      opts.dir = a.slice("--dir=".length);
    } else if (a === "--help" || a === "-h") {
      throw new Error(USAGE);
    } else {
      throw new Error(`Unknown argument: ${a}\n${USAGE}`);
    }
  }
  return opts;
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
 * Copy every skill (each subdirectory of `srcDir` containing a SKILL.md) into
 * `<destRoot>/<skill-name>/`, recursing into nested folders. Returns the names
 * of the skills installed. Throws if `srcDir` cannot be read or holds no skill.
 * Extracted from `runInitCommand` so the copy loop (and its error branches) can
 * be exercised against a crafted temp tree without mocking the filesystem.
 */
export async function installSkills(srcDir: string, destRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    throw new Error(
      `Bundled skills not found at ${srcDir}. The package may be corrupted or was installed without its assets.`,
    );
  }

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
  return installed;
}

/**
 * Implements `gitea-mcp init`: copies every bundled skill (each subdirectory of
 * dist/assets/skills containing a SKILL.md) into the target tool's skills
 * directory so the tool loads them on next start. Does NOT need
 * GITEA_BASE_URL / GITEA_TOKEN.
 */
export async function runInitCommand(argv: string[]): Promise<void> {
  const opts = parseInitArgs(argv);
  const target = resolveTool(opts.tool);
  const destRoot = resolveInstallDir(opts);

  const installed = await installSkills(bundledSkillsDir(), destRoot);

  process.stdout.write(
    `Installed ${installed.length} gitea-mcp skill(s) for ${target.label} -> ${destRoot}\n`,
  );
  for (const name of installed) process.stdout.write(`  - ${name}\n`);
  process.stdout.write(`Restart ${target.label} for the skills to take effect.\n`);
}
