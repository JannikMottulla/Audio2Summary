const User = require("../models/user");

class UserService {
  async getOrCreateUser(phoneNumber) {
    try {
      let user = await User.findOne({ phoneNumber });

      if (!user) {
        // Create new user if doesn't exist
        user = await User.create({
          phoneNumber,
          firstSeen: new Date(),
          lastInteraction: new Date(),
        });
        console.log("New user created:", phoneNumber);
      } else {
        // Update existing user's last interaction
        await user.updateLastInteraction();
        console.log("Existing user updated:", phoneNumber);
      }

      return user;
    } catch (error) {
      console.error("Error in getOrCreateUser:", error);
      throw error;
    }
  }

  async checkSummaryAvailability(phoneNumber) {
    try {
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        throw new Error("User not found");
      }
      return {
        hasFreeSummaries: user.hasFreeSummaries(),
        freeSummariesRemaining: user.freeSummariesRemaining,
        totalSummariesUsed: user.totalSummariesUsed,
      };
    } catch (error) {
      console.error("Error checking summary availability:", error);
      throw error;
    }
  }

  async useSummary(phoneNumber) {
    try {
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        throw new Error("User not found");
      }
      await user.useFreeSummary();
      return {
        remaining: user.freeSummariesRemaining,
        totalUsed: user.totalSummariesUsed,
      };
    } catch (error) {
      console.error("Error using summary:", error);
      throw error;
    }
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

  async setSummaryDetailLevel(phoneNumber, level) {
    try {
      if (!["brief", "normal", "detailed"].includes(level)) {
        throw new Error(
          "Invalid detail level. Must be brief, normal, or detailed."
        );
      }

      const user = await User.findOne({ phoneNumber });
      if (!user) {
        throw new Error("User not found");
      }

      user.summaryDetailLevel = level;
      await user.save();

      return {
        detailLevel: level,
        message: `Summary detail level set to: ${level}`,
      };
    } catch (error) {
      console.error("Error setting summary detail level:", error);
      throw error;
    }
  }

  async getUserPreferences(phoneNumber) {
    try {
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        throw new Error("User not found");
      }

      return {
        summaryDetailLevel: user.summaryDetailLevel,
      };
    } catch (error) {
      console.error("Error getting user preferences:", error);
      throw error;
    }
  }
}

module.exports = new UserService();
