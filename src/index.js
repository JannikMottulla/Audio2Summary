const express = require("express");
const bodyParser = require("body-parser");
const config = require("./config");
const database = require("./services/database");
const webhookController = require("./controllers/webhook");

const app = express();

// Middleware
app.use(bodyParser.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});

// WhatsApp webhook routes
app.get("/webhook", webhookController.verifyWebhook.bind(webhookController));
app.post("/webhook", webhookController.handleMessage.bind(webhookController));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Initialize database and start server
async function startServer() {
  try {
    await database.connect();
    app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
