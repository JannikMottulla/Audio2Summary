const express = require("express");
const mongoose = require("mongoose");
const config = require("./config");
const webhookRoutes = require("./routes/webhooks");

const app = express();
app.use(express.json());

// Mount routes
app.use("/webhooks", webhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server error" });
});

// Connect to MongoDB and start server
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-summary"
  )
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
