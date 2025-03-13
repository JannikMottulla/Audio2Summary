require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");
const User = require("../models/user");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function clearDatabase() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-summary"
    );
    console.log("Connected to MongoDB successfully");

    rl.question(
      "Are you sure you want to clear all database entries? This cannot be undone! (yes/no): ",
      async (answer) => {
        if (answer.toLowerCase() === "yes") {
          console.log("Clearing database...");

          // Get counts before deletion
          const userCount = await User.countDocuments();

          // Clear all collections
          await User.deleteMany({});

          console.log("\nDatabase cleared successfully!");
          console.log(`Deleted entries:`);
          console.log(`- Users: ${userCount}`);

          console.log("\nAll data has been removed from the database.");
        } else {
          console.log("Operation cancelled.");
        }

        // Close connections
        await mongoose.connection.close();
        rl.close();
        process.exit(0);
      }
    );
  } catch (error) {
    console.error("Error clearing database:", error);
    process.exit(1);
  }
}

// Handle script interruption
process.on("SIGINT", async () => {
  console.log("\nOperation cancelled by user.");
  await mongoose.connection.close();
  process.exit(0);
});

clearDatabase();
