#!/usr/bin/env node
// Recursively copies src/assets/** into dist/assets/** so markdown guidance
// (instructions, resources, skills) ships inside the published dist/ package.
// Runs as part of `npm run build` (see package.json "build:assets"). Removing
// dist/assets first ensures assets deleted from src/ do not linger in dist/.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "assets");
const dest = join(root, "dist", "assets");

if (!existsSync(src)) {
  // No guidance assets to ship; nothing to do. Keeps the build hermetic.
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-assets] ${src.replace(root + "/", "")} -> ${dest.replace(root + "/", "")}`);
