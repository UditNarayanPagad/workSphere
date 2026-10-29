import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = new Map();
let stopping = false;
let exitCode = 0;

function stopChildren(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

function start(name, args, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: process.env,
    stdio: "inherit"
  });
  children.set(name, child);

  child.on("error", (error) => {
    console.error(`[${name}] Could not start: ${error.message}`);
    exitCode = 1;
    stopChildren();
  });

  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`[${name}] exited (${signal ?? `code ${code}`}); stopping the other services.`);
      if (code !== 0) exitCode = code ?? 1;
      stopChildren();
    }

    if ([...children.values()].every(({ exitCode: childExit, signalCode }) =>
      childExit !== null || signalCode !== null
    )) {
      process.exitCode = exitCode;
    }
  });
}

process.once("SIGINT", () => stopChildren("SIGINT"));
process.once("SIGTERM", () => stopChildren("SIGTERM"));

start("api", [resolve(root, "node_modules/tsx/dist/cli.mjs"), "watch", "apps/api/src/index.ts"]);
start(
  "web",
  [resolve(root, "node_modules/vite/bin/vite.js"), "--host", "0.0.0.0"],
  resolve(root, "apps/web")
);
