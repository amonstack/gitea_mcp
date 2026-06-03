#!/usr/bin/env node
import { runServer } from "./server.js";

const baseUrl = process.env.GITEA_BASE_URL;
const token = process.env.GITEA_TOKEN;

if (!baseUrl || !token) {
  console.error("GITEA_BASE_URL and GITEA_TOKEN environment variables are required");
  process.exit(1);
}

runServer(baseUrl, token).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
