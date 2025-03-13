require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user");

async function migrateSchema() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is required");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB successfully");

    // Update all users to ensure they have the new schema fields
    const result = await User.updateMany(
      { "subscription.approvalUrl": { $exists: false } },
      { $set: { "subscription.approvalUrl": null } }
    );

    console.log("\nMigration completed successfully!");
    console.log(`Updated ${result.modifiedCount} documents`);

    // Close connection
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

// Handle script interruption
process.on("SIGINT", async () => {
  console.log("\nMigration cancelled by user.");
  await mongoose.connection.close();
  process.exit(0);
});

migrateSchema();
