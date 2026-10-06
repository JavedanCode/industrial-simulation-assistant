import express from "express";
import healthRoutes from "./routes/healthRoutes";
import reportRoutes from "./routes/reportRoutes";

const app = express();

app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api", reportRoutes);

export default app;
