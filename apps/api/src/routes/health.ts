import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "api" });
});

healthRouter.get("/ready", (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ready" : "not_ready",
    service: "api",
    dependencies: { database: databaseConnected ? "connected" : "disconnected" }
  });
});
