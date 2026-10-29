import { spawn } from "node:child_process";
import { once } from "node:events";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const server = spawn(process.execPath, ["--import", "tsx", "apps/api/tests/e2e-server.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  server.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[E2E server] ${chunk}`));
  server.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[E2E server] ${chunk}`));

  try {
    await new Promise<void>((resolveReady, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out starting E2E servers.")), 120_000);
      server.on("message", (message) => {
        if (message === "ready") {
          clearTimeout(timeout);
          resolveReady();
        }
      });
      server.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.once("exit", (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`E2E servers exited before readiness (code ${code}, signal ${signal}).`));
      });
    });
  } catch (error) {
    server.kill();
    throw error;
  }

  return async () => {
    const exit = new Promise<[number | null, NodeJS.Signals | null]>((resolveExit) => {
      server.once("exit", (code, signal) => resolveExit([code, signal]));
    });
    server.send("shutdown");
    const timeout = setTimeout(() => server.kill(), 15_000);
    const [code, signal] = await exit;
    clearTimeout(timeout);
    if (code !== 0 || signal !== null) {
      throw new Error(`E2E servers exited unexpectedly (code ${code}, signal ${signal}).`);
    }
  };
}
