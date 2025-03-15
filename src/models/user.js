const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  lastInteraction: {
    type: Date,
    default: Date.now,
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
  mode: {
    type: String,
    enum: ["default", "summary"],
    default: "default",
  },
  isSubscribed: {
    type: Boolean,
    default: false,
  },
  subscription: {
    paypalSubscriptionId: String,
    approvalUrl: String,
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "CANCELLED", "SUSPENDED", "EXPIRED", null],
      default: null,
    },
    startDate: Date,
    nextBillingDate: Date,
  },
});

// Helper methods
userSchema.methods = {
  hasFreeSummaries() {
    return this.isSubscribed || this.freeSummariesRemaining > 0;
  },

  async useSummary() {
    if (!this.isSubscribed) {
      if (this.freeSummariesRemaining <= 0) {
        throw new Error("No free summaries remaining");
      }
      this.freeSummariesRemaining--;
    }
    this.totalSummariesUsed++;
    this.lastInteraction = new Date();
    return this.save();
  },

  updateLastInteraction() {
    this.lastInteraction = new Date();
  },

  getPendingSubscription() {
    if (this.subscription.status === "PENDING") {
      return {
        subscriptionId: this.subscription.paypalSubscriptionId,
        link: this.subscription.approvalUrl,
      };
    }
  },

  setSubscription(subscriptionId, approvalUrl, status = "ACTIVE") {
    this.subscription = {
      paypalSubscriptionId: subscriptionId,
      approvalUrl: approvalUrl,
      status: status,
      startDate: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };
    this.isSubscribed = status === "ACTIVE";
    return this.save();
  },

  cancelSubscription() {
    if (this.subscription) {
      this.subscription.status = "CANCELLED";
      this.isSubscribed = false;
    }
    return this.save();
  },
  setFreeSummariesForUser(count) {
    this.freeSummariesRemaining = count;
    return this.save();
  },
};

module.exports = mongoose.model("User", userSchema);
