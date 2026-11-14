import { createApp } from "./app.js";
import { config } from "./config.js";
import { createProvider } from "./llm/index.js";
import { PgAnalysisRepository } from "./repository/pgRepository.js";

// pdf.js (used for PDF parsing) needs globals such as structuredClone, which Node 16 lacks.
const [major = 0] = process.versions.node.split(".").map(Number);
if (major < 18) {
  throw new Error(`Node.js 18 or newer is required (found ${process.versions.node}). Run: nvm use 20`);
}

const app = createApp({ repo: new PgAnalysisRepository(), provider: createProvider() });

app.listen(config.PORT, () => {
  console.log(`Server listening on http://localhost:${config.PORT}`);
});
