const mongoose = require("mongoose");
const config = require("../config");

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    try {
      if (!this.isConnected) {
        await mongoose.connect(config.mongodb.uri, config.mongodb.options);
        this.isConnected = true;
        console.log("Connected to MongoDB");
      }
    } catch (error) {
      console.error("MongoDB connection error:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log("Disconnected from MongoDB");
    } catch (error) {
      console.error("MongoDB disconnection error:", error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
