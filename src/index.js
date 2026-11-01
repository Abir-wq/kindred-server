import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();

const PORT = Number(process.env.PORT || 5000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "kindred";

let client;
let database;
let server;
let shuttingDown = false;

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

app.get("/api/health", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    await database.command({ ping: 1 });

    res.json({
      status: "ok",
      service: "Kindred API",
      database: "connected",
    });
  } catch {
    res.status(503).json({
      status: "error",
      service: "Kindred API",
      database: "unavailable",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : 500;

  console.error("Request failed:", error.name);

  res.status(status).json({
    message:
      status === 400
        ? "Invalid request. Check the JSON you submitted."
        : status === 413
          ? "Request is too large."
          : "Unable to process the request.",
  });
});

async function startServer() {
  try {
    if (!MONGODB_URI) {
      console.error("Missing MONGODB_URI in server/.env");
      process.exitCode = 1;
      return;
    }

    if (
      !MONGODB_URI.startsWith("mongodb+srv://") &&
      !MONGODB_URI.startsWith("mongodb://")
    ) {
      console.error(
        "MONGODB_URI must begin with mongodb+srv:// or mongodb://"
      );
      process.exitCode = 1;
      return;
    }

    if (MONGODB_URI.includes("<") || MONGODB_URI.includes(">")) {
      console.error(
        "Replace the placeholders in MONGODB_URI, including <db_password>."
      );
      process.exitCode = 1;
      return;
    }

    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 15000,
    });

    console.log("Connecting to MongoDB...");

    await client.connect();

    database = client.db(MONGODB_DB);
    await database.command({ ping: 1 });

    app.locals.db = database;

    console.log("MongoDB connected successfully.");

    server = app.listen(PORT, () => {
      console.log(`Kindred API running at http://localhost:${PORT}`);
    });

    server.on("error", async (error) => {
      console.error(
        error.code === "EADDRINUSE"
          ? `Port ${PORT} is already in use. Stop the other server on that port.`
          : `HTTP server failed: ${error.code || error.name}`
      );

      await client.close();
      process.exitCode = 1;
    });
  } catch (error) {
    // Do not print the connection string or database password.
    console.error(
      `MongoDB connection failed: ${error.name}; code: ${error.code || "none"}`
    );

    if (error.code === 18) {
      console.error(
        "Authentication failed. Check the database username and password in server/.env."
      );
    } else if (error.name === "MongoParseError") {
      console.error(
        "Check the connection string format and URL-encode special characters in the password."
      );
    } else {
      console.error(
        "Check that the Atlas cluster is ready, your current IP is allowed, and the connection string is correct."
      );
    }

    if (client) {
      await client.close().catch(() => {});
    }

    process.exitCode = 1;
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("Closing Kindred API...");

  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();

  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    if (client) {
      await client.close();
    }

    clearTimeout(timeout);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();