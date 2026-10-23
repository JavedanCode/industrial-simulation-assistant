import type { RequestHandler } from "express";
import { getConfig } from "../../config.js";

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const { corsOrigin } = getConfig();

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);

  if (corsOrigin !== "*") {
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
};
