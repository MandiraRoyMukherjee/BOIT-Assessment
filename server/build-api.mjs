// Bundles the Express app into one self-contained ESM file for Vercel: api/index.mjs
// The output is committed on purpose: Vercel discovers serverless functions from the repository
// files before the build step runs, so a file generated during the build might not be picked up.
// Re-run `npm run build:api` after any server change you want deployed.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const outfile = fileURLToPath(new URL("../api/index.mjs", import.meta.url));

await build({
  entryPoints: [fileURLToPath(new URL("./src/vercel.ts", import.meta.url))],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
  // Some bundled CommonJS dependencies (express, pg) call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
