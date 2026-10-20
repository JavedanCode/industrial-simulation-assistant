import type { ErrorRequestHandler } from "express";
import multer from "multer";

export const reportUploadErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "The uploaded report exceeds the 10 MB size limit.",
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

  next(error);
};
