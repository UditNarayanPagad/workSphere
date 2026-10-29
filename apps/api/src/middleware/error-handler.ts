import type { ErrorRequestHandler } from "express";
import { logger } from "../config/logger.js";
import { HttpError } from "../errors/http-error.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: { message: error.message }
    });
    return;
  }

  logger.error({ err: error }, "Unhandled request error");
  response.status(500).json({
    error: { message: "An unexpected error occurred." }
  });
};
