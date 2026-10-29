import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        error: {
          message: "Invalid request body.",
          issues: result.error.issues.map(({ path, message }) => ({ path, message }))
        }
      });
      return;
    }

    request.body = result.data;
    next();
  };
}
