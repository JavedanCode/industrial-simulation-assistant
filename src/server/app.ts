import express from "express";

//====ROUTERS====
import healthRoutes from "./routes/healthRoutes";
import reportRoutes from "./routes/reportRoutes";
import chatRoutes from "./routes/chatRoutes";

const app = express();

app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api", reportRoutes);
app.use("/api", chatRoutes);

export default app;
