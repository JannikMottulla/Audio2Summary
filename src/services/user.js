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

  //required
  async getUserStatus(user) {
    return {
      freeSummariesRemaining: user.freeSummariesRemaining,
      totalSummariesUsed: user.totalSummariesUsed,
      mode: user.mode,
      lastInteraction: user.lastInteraction,
      isSubscribed: user.isSubscribed,
      planType: user.isSubscribed ? "🌟 Premium" : "Free Plan",
      subscription: user.subscription,
    };
  }

  //required
  async checkSummaryAvailability(user) {
    return {
      hasFreeSummaries: user.hasFreeSummaries(),
    };
  }

  //required
  async useSummary(user) {
    if (!user.hasFreeSummaries()) {
      throw new Error("No free summaries remaining");
    }
    return await user.useSummary();
  }

  //required
  async setMode(user, mode) {
    if (!["default", "summmary"].includes(mode)) {
      throw new Error("Invalid detail level");
    }
    user.mode = mode;
    await user.save();

    return {
      message: `Mode set to: ${mode}`,
    };
  }

  //required
  async getUserMode(user) {
    return {
      mode: user.mode,
    };
  }

  async getAllUsers() {
    return User.find({});
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

  //required
  async initiateSubscription(user) {
    try {
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

      await user.setSubscription(subscriptionId, approvalUrl, "PENDING");

      return {
        message:
          "🌟 Click the link below to subscribe to Premium:\n\n" + approvalUrl,
      };
    } catch (error) {
      throw new Error(
        "Failed to create subscription link. Please try again later."
      );
    }
  }

  //required
  async cancelSubscription(user) {
    await user.cancelSubscription();
    return {
      message:
        "Subscription cancelled. You now have the free plan with limited summaries.",
    };
  }

  //required
  async findBySubscriptionId(subscriptionId) {
    return User.findOne({
      "subscription.paypalSubscriptionId": subscriptionId,
    });
  }

  //required
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
