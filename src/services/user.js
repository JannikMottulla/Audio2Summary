const User = require("../models/user");
const paypalService = require("./paypal");

class UserService {
  async getOrCreateUser(phoneNumber) {
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await User.create({ phoneNumber });
    }
    return user;
  }

  async getUserStatus(user) {
    return {
      freeSummariesRemaining: user.freeSummariesRemaining,
      totalSummariesUsed: user.totalSummariesUsed,
      summaryDetailLevel: user.summaryDetailLevel,
      lastInteraction: user.lastInteraction,
      isSubscribed: user.isSubscribed,
      planType: user.isSubscribed ? "🌟 Premium" : "Free Plan",
      subscription: user.subscription,
    };
  }

  async checkSummaryAvailability(user) {
    return {
      hasFreeSummaries: user.hasFreeSummaries(),
    };
  }

  async useSummary(user) {
    if (!user.hasFreeSummaries()) {
      throw new Error("No free summaries remaining");
    }
    return await user.useSummary();
  }

  async setSummaryDetailLevel(user, level) {
    if (!["brief", "normal", "detailed"].includes(level)) {
      throw new Error("Invalid detail level");
    }
    user.summaryDetailLevel = level;
    await user.save();

    return {
      message: `Summary detail level set to: ${level}`,
    };
  }

  async getUserPreferences(user) {
    return {
      summaryDetailLevel: user.summaryDetailLevel,
    };
  }

  async addBonusSummaries(phoneNumber, count) {
    try {
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        throw new Error("User not found");
      }
      await user.addFreeSummaries(count);
      return user.freeSummariesRemaining;
    } catch (error) {
      console.error("Error adding bonus summaries:", error);
      throw error;
    }
  }

  async getAllUsers() {
    return User.find({ active: true });
  }

  async getUserStats() {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ active: true });
    const lastDayUsers = await User.countDocuments({
      lastInteraction: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const usersWithFreeSummaries = await User.countDocuments({
      freeSummariesRemaining: { $gt: 0 },
    });
    const totalSummariesUsed = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$totalSummariesUsed" } } },
    ]);

    return {
      totalUsers,
      activeUsers,
      lastDayUsers,
      usersWithFreeSummaries,
      totalSummariesUsed: totalSummariesUsed[0]?.total || 0,
    };
  }

  async toggleSubscription(phoneNumber) {
    const user = await this.getOrCreateUser(phoneNumber);
    const isNowSubscribed = user.toggleSubscription();
    await user.save();
    return {
      message: isNowSubscribed
        ? "✨ Welcome to Premium! You now have unlimited voice message summaries."
        : "Subscription cancelled. You now have the free plan with limited summaries.",
      isSubscribed: isNowSubscribed,
    };
  }

  async initiateSubscription(user) {
    try {
      console.log(
        `Creating subscription link for phone number: ${user.phoneNumber}`
      );
      let subscriptionId;
      let approvalUrl;

      const subscription = await user.getPendingSubscription();
      if (subscription) {
        subscriptionId = subscription.subscriptionId;
        approvalUrl = subscription.link;
      } else {
        const result = await paypalService.createSubscriptionLink(
          user.phoneNumber
        );
        subscriptionId = result.subscriptionId;
        approvalUrl = result.approvalUrl;
      }

      console.log(
        `Got subscription ID: ${subscriptionId} and approval URL: ${approvalUrl}`
      );

      console.log(`Found/Created user with phone number: ${user.phoneNumber}`);

      await user.setSubscription(subscriptionId, approvalUrl, "PENDING");
      console.log(`Updated user subscription status to PENDING`);

      return {
        message:
          "🌟 Click the link below to subscribe to Premium:\n\n" + approvalUrl,
      };
    } catch (error) {
      console.error("Error initiating subscription:", error.message);
      console.error("Full error:", error);
      throw new Error(
        "Failed to create subscription link. Please try again later."
      );
    }
  }

  async cancelSubscription(user) {
    await user.cancelSubscription();
    return {
      message:
        "Subscription cancelled. You now have the free plan with limited summaries.",
    };
  }

  async findBySubscriptionId(subscriptionId) {
    return User.findOne({
      "subscription.paypalSubscriptionId": subscriptionId,
    });
  }

  async handlePayPalWebhook(event) {
    try {
      const subscriptionId = event.resource.id;
      const user = await User.findOne({
        "subscription.paypalSubscriptionId": subscriptionId,
      });

      if (!user) {
        console.error("No user found for subscription:", subscriptionId);
        return;
      }

      switch (event.event_type) {
        case "BILLING.SUBSCRIPTION.ACTIVATED":
          await user.setSubscription(subscriptionId, "ACTIVE");
          break;
        case "BILLING.SUBSCRIPTION.CANCELLED":
          await user.cancelSubscription();
          break;
        case "BILLING.SUBSCRIPTION.SUSPENDED":
          await user.setSubscription(subscriptionId, "SUSPENDED");
          break;
        case "BILLING.SUBSCRIPTION.EXPIRED":
          await user.setSubscription(subscriptionId, "EXPIRED");
          break;
      }
    } catch (error) {
      console.error("Error handling PayPal webhook:", error);
      throw error;
    }
  }
}

module.exports = new UserService();
