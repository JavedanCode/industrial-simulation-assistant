import express from "express";
import healthRoutes from "./routes/healthRoutes";

const app = express();

app.use(express.json());

app.use("/", healthRoutes);

export default app;
