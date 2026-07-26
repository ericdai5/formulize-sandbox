/**
 * Builds the E2B custom template that the playground uses.
 *
 *   npm run e2b:build
 *
 * Requires E2B_API_KEY in the environment.
 *
 * The template bakes in:
 *   - Node 20
 *   - the playground project skeleton (e2b/project)
 *   - all 19 runtime deps (react, delta-dsl, mathjax, plotly, d3, mobx, ...)
 *   - `npm run dev` already running on port 5173 at snapshot time
 *
 * After it finishes, set E2B_TEMPLATE in your .env to the printed alias.
 */
import { Template, waitForURL, defaultBuildLogger } from "e2b";

// E2B's `copy()` only accepts relative paths, and resolves them against
// this script's own directory (not the cwd). The project skeleton lives
// in e2b/project/ next to this file.
const PROJECT_DIR = "./project";
const ALIAS =
  process.env.E2B_TEMPLATE_ALIAS ??
  process.env.E2B_TEMPLATE ??
  "formulize-playground";

const template = Template()
  .fromImage("node:20-slim")
  .setWorkdir("/home/user/app")
  .copy(PROJECT_DIR, ".")
  .runCmd("npm install")
  .runCmd("npm ls delta-dsl --depth=0")
  .setStartCmd(
    "npm run dev",
    waitForURL("http://localhost:5173"),
  );

try {
  await Template.build(template, ALIAS, {
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log(`\nTemplate built. Set in your .env:\n  E2B_TEMPLATE=${ALIAS}\n`);
} catch (err) {
  console.error("Template build failed:");
  console.error(err);
  if (err && typeof err === "object") {
    for (const k of Object.getOwnPropertyNames(err)) {
      // @ts-expect-error inspecting unknown error shape
      console.error(`  ${k}:`, err[k]);
    }
  }
  process.exit(1);
}
