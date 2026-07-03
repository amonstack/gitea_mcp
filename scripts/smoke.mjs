#!/usr/bin/env node
// Runtime smoke test of the BUILT dist/ — catches the runtime/type-decoupling and
// module-resolution classes that neither `tsc` emit nor `--noEmit` can detect.
// Requires `make build` first (smoke depends on it via the Makefile).
import { mkdtemp, rm, readFile, access, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
function check(cond, msg) {
  if (cond) console.log(`  ok  - ${msg}`);
  else {
    console.error(`  FAIL- ${msg}`);
    failures.push(msg);
  }
}

try {
  // 1. The skills-install CLI path runs end-to-end on the compiled artifact,
  //    and every bundled skill is copied with valid frontmatter.
  const dest = await mkdtemp(join(tmpdir(), "gitea-smoke-"));
  const { runSkillsCommand } = await import(join(root, "dist", "skills.js"));
  await runSkillsCommand(["install", "--dir", dest]);
  const bundledSkills = (
    await readdir(join(root, "dist", "assets", "skills"), { withFileTypes: true })
  ).filter((e) => e.isDirectory());
  check(bundledSkills.length >= 8, `at least 8 skills bundled (got ${bundledSkills.length})`);
  for (const e of bundledSkills) {
    const installed = await readFile(join(dest, e.name, "SKILL.md"), "utf-8");
    check(
      installed.startsWith("---\n") && installed.includes(`name: ${e.name}`),
      `skill installed with valid frontmatter: ${e.name}`,
    );
  }
  await rm(dest, { recursive: true, force: true });

  // 2. The server constructs at runtime and wires the guidance layer from assets.
  const { createServer } = await import(join(root, "dist", "server.js"));
  const server = await createServer("https://g.example", "t", "o", "r");
  const instructions = server.server._instructions;
  check(typeof instructions === "string" && instructions.includes("Resolve owner/repo FIRST"), "handshake instructions loaded from dist/assets");
  const prompts = Object.keys(server._registeredPrompts);
  check(
    ["triage_issues", "summarize_issue", "audit_labels", "milestone_report"].every((p) => prompts.includes(p)),
    `all 4 prompts registered (got: ${prompts.join(",")})`,
  );
  const resources = Object.keys(server._registeredResources);
  check(resources.length === 3, `3 reference resources registered (got ${resources.length})`);

  // 3. dist/ ships no test code and the non-skill assets are present.
  try {
    await access(join(root, "dist", "__tests__"));
    check(false, "dist/ must NOT contain test code");
  } catch {
    check(true, "dist/ contains no test code");
  }
  for (const f of ["instructions.md", "resources/field-reference.md", "resources/label-guide.md", "resources/tool-cookbook.md"]) {
    try {
      await access(join(root, "dist", "assets", f));
      check(true, `asset present: ${f}`);
    } catch {
      check(false, `asset missing: ${f}`);
    }
  }
} catch (err) {
  console.error("SMOKE CRASHED:", err);
  process.exit(1);
}

if (failures.length) {
  console.error(`\nSmoke FAILED (${failures.length}).`);
  process.exit(1);
}
console.log("\nSmoke PASSED.");
