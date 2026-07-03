#!/usr/bin/env node
import { runServer } from "./server.js";

const argv = process.argv.slice(2);

if (argv[0] === "init") {
  // `gitea-mcp init [--tool <name>]` installs the bundled skills into a target
  // AI tool's skills directory. It needs no Gitea credentials, so it is
  // dispatched before the env-var guard below.
  const { runInitCommand } = await import("./skills.js");
  runInitCommand(argv.slice(1)).catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
} else {
  const baseUrl = process.env.GITEA_BASE_URL;
  const token = process.env.GITEA_TOKEN;
  const defaultOwner = process.env.GITEA_DEFAULT_OWNER;
  const defaultRepo = process.env.GITEA_DEFAULT_REPO;

  if (!baseUrl || !token) {
    console.error("GITEA_BASE_URL and GITEA_TOKEN environment variables are required");
    process.exit(1);
  }

  runServer(baseUrl, token, defaultOwner, defaultRepo).catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
