import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { AppError } from "../http/appError.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "The uploaded report exceeds the 10 MB size limit.",
        code: error.code,
      });
      return;
    }

    res.status(400).json({
      error: "The file upload is invalid.",
      code: error.code,
    });
    return;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Unsupported report format.")
  ) {
    res.status(400).json({
      error: error.message,
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: "The request body is not valid JSON.",
    });
    return;
  }

  console.error("Unexpected error while handling request:", error);

  res.status(500).json({
    error: "An unexpected error occurred while handling the request.",
  });
};
