import { createApp } from "./app.js";
import { createProvider } from "./llm/index.js";
import { PgAnalysisRepository } from "./repository/pgRepository.js";

/**
 * Serverless entry point (Vercel). The Express app is itself a (req, res) handler, so it is
 * exported as-is. `npm run build:api` bundles this file into api/index.mjs.
 */
export default createApp({ repo: new PgAnalysisRepository(), provider: createProvider() });
