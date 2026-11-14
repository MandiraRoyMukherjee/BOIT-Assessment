import { createApp } from "./app.js";
import { config } from "./config.js";
import { createProvider } from "./llm/index.js";
import { PgAnalysisRepository } from "./repository/pgRepository.js";

const app = createApp({ repo: new PgAnalysisRepository(), provider: createProvider() });

app.listen(config.PORT, () => {
  console.log(`Server listening on http://localhost:${config.PORT}`);
});
