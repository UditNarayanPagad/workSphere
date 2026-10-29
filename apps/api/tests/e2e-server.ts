import { MongoMemoryServer } from "mongodb-memory-server";
import { resolve } from "node:path";

async function startE2eServer(): Promise<void> {
  process.env.NODE_ENV = "test";
  process.env.ACCESS_TOKEN_SECRET = "e2e-only-secret-key-with-at-least-32-characters";
  process.env.WEB_ORIGINS = "http://127.0.0.1:5317";
  process.env.VITE_API_URL = "http://127.0.0.1:4312";

  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  const mongoose = await import("mongoose");
  const { logger } = await import("../src/config/logger.js");
  logger.level = "silent";
  const { app } = await import("../src/app.js");
  const { createServer } = await import("vite");
  await mongoose.default.connect(mongoServer.getUri());

  const apiServer = app.listen(4312, "127.0.0.1");
  await new Promise<void>((resolveListening) => apiServer.once("listening", resolveListening));
  const viteServer = await createServer({
    configFile: resolve(process.cwd(), "apps/web/vite.config.ts"),
    root: resolve(process.cwd(), "apps/web"),
    server: { host: "127.0.0.1", port: 5317, strictPort: true }
  });
  await viteServer.listen();

  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    try {
      await viteServer.close();
      await new Promise<void>((resolveClose, reject) => {
        apiServer.close((error) => error ? reject(error) : resolveClose());
      });
      await mongoose.default.disconnect();
      await mongoServer.stop();
    } catch (error) {
      console.error("Could not shut down the E2E servers cleanly.", error);
      process.exitCode = 1;
    } finally {
      process.exit(process.exitCode ?? 0);
    }
  };
  process.on("message", (message) => {
    if (message === "shutdown") void shutdown();
  });
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  process.send?.("ready");
}

void startE2eServer().catch((error: unknown) => {
  console.error("Could not start the E2E API server.", error);
  process.exitCode = 1;
});
