import app from "./server/app";

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT}`);
});
