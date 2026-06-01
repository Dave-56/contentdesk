import "./src/lib/load-env";

import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_tutunjhpgkqionomaztj",
  runtime: "node-22",
  maxDuration: 300,
  dirs: ["./src/trigger"],
});
