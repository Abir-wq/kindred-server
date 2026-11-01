import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.disable("x-powered-by");

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "Kindred API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Kindred API",
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found",
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  const status =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : 500;

  res.status(status).json({
    message:
      status === 400
        ? "Invalid request. Check the JSON you submitted."
        : status === 413
          ? "Request is too large."
          : "Unable to process the request.",
  });
});

const server = app.listen(PORT, () => {
  console.log(`Kindred API running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Could not start Kindred API: ${error.message}`);
  process.exit(1);
});