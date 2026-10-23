import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();

  res.setHeader("X-Request-Id", requestId);

  if (process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startedAt;

    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [${requestId}]`,
    );
  });

  next();
};
