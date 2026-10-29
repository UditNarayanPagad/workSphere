import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

async function startServer(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);

  const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, "WorkSphere API listening");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Shutting down API");
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error: unknown) => {
  logger.fatal({ err: error }, "API startup failed");
  process.exitCode = 1;
});
