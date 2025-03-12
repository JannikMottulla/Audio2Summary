const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastInteraction: {
      type: Date,
      default: Date.now,
    },
    messageCount: {
      type: Number,
      default: 1,
    },
    freeSummariesRemaining: {
      type: Number,
      default: 10,
      min: 0,
    },
    totalSummariesUsed: {
      type: Number,
      default: 0,
    },
    summaryDetailLevel: {
      type: String,
      enum: ["brief", "normal", "detailed"],
      default: "normal",
    },
    name: String,
    language: String,
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Update lastInteraction when user sends a message
userSchema.methods.updateLastInteraction = async function () {
  this.lastInteraction = new Date();
  this.messageCount += 1;
  return this.save();
};

// Check if user has free summaries available
userSchema.methods.hasFreeSummaries = function () {
  return this.freeSummariesRemaining > 0;
};

// Use a free summary
userSchema.methods.useFreeSummary = async function () {
  if (!this.hasFreeSummaries()) {
    throw new Error("No free summaries remaining");
  }

  this.freeSummariesRemaining -= 1;
  this.totalSummariesUsed += 1;
  return this.save();
};

// Add bonus free summaries (e.g., for promotions or rewards)
userSchema.methods.addFreeSummaries = async function (count) {
  this.freeSummariesRemaining += count;
  return this.save();
};

const User = mongoose.model("User", userSchema);

module.exports = User;
