import { app } from "./app.js";
import { env } from "./config/env.js";
import { startJobRunner } from "./jobs/runner.js";

app.listen(env.PORT, () => {
  console.log(`[api] listening on :${env.PORT} (${env.NODE_ENV}, ${env.ARC_NETWORK})`);
  startJobRunner();
});
