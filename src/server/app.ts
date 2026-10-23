import express from "express";

//====ROUTERS====
import healthRoutes from "./routes/healthRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";

//====MIDDLEWARE====
import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");

app.use(corsMiddleware);
app.use(requestLogger);
app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRoutes);
app.use("/api", reportRoutes);
app.use("/api", chatRoutes);
app.use("/api", conversationRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use(errorHandler);

export default app;
