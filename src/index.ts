import { existsSync } from "node:fs";
import app from "./server/app.js";
import { getConfig } from "./config.js";
import { closeDatabase } from "./server/storage/database.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const { port } = getConfig();

const server = app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down...`);

  server.close((error) => {
    closeDatabase();

    if (error) {
      console.error("Error while shutting down:", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
