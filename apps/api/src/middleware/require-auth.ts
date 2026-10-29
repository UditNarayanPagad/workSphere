import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { env } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";

const signingKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);

export const requireAuth: RequestHandler = async (request, response, next) => {
  const authorization = request.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    next(new HttpError(401, "Authentication required."));
    return;
  }

  try {
    const { payload } = await jwtVerify(token, signingKey, { algorithms: ["HS256"] });

    if (typeof payload.sub !== "string") {
      throw new Error("Access token has no subject.");
    }

    response.locals.authUserId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, "Authentication required."));
  }
};
