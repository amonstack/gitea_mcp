#!/usr/bin/env node
import { runServer } from "./server.js";
import { discoverConfig } from "./git-config.js";

const argv = process.argv.slice(2);

if (argv[0] === "init") {
  // `gitea-mcp init [--tool <name>]` installs the bundled skills into a target
  // AI tool's skills directory. It needs no Gitea credentials, so it is
  // dispatched before the config-discovery logic below.
  const { runInitCommand } = await import("./skills.js");
  runInitCommand(argv.slice(1)).catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
} else {
  // Resolve baseUrl/owner/repo/credentials from env first, then the local git
  // context (`.git/config` remotes + credential store). Discovery collects ALL
  // credential candidates (config token, env token, credential-store entries)
  // rather than picking one, so the client can fall back across them when one
  // scheme is rejected (e.g. an account password that is not a PAT). When
  // neither env nor any git remote provides a baseUrl, the server is
  // intentionally skipped: a single global install should stay dormant outside
  // of git projects.
  const discovered = await discoverConfig().catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });

  if (!discovered) {
    console.error(
      `gitea-mcp: no git remote found in ${process.cwd()} and GITEA_BASE_URL is not set; skipping server start.`,
    );
    process.exit(0);
  }

  runServer(
    discovered.baseUrl,
    discovered.candidates,
    discovered.defaultOwner,
    discovered.defaultRepo,
  ).catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
