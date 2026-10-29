import type { RequestHandler } from "express";
import { env } from "../config/env.js";

export const requireSameOrigin: RequestHandler = (request, response, next) => {
  const origin = request.get("origin");

  if (!origin || !env.webOrigins.includes(origin)) {
    response.status(403).json({ error: { message: "Request origin is not allowed." } });
    return;
  }

  next();
};
