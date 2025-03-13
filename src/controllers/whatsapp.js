const whatsapp = require("../services/whatsapp");
const paypalService = require("../services/paypal");

const userService = require("../services/user");
const transcriptionService = require("../services/transcription");

class WhatsAppController {
  async verifyWebhook(req, res) {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      console.log("Received webhook verification request:", {
        mode,
        token,
        challenge,
      });

      const response = whatsapp.verifyWebhook(mode, token, challenge);
      res.status(200).send(response);
    } catch (error) {
      console.error("Webhook verification failed:", error.message);
      res.sendStatus(403);
    }
  }

  async handleMessage(req, res) {
    try {
      const { body } = req;
      if (!this.isValidMessageRequest(body)) {
        return res.sendStatus(200);
      }

      const messageData = this.extractMessageData(body);

      console.log("Received Message: ", messageData.text);
      console.log("Message From: ", messageData.from);

      // Handle status updates
      if (messageData.type === "status") {
        return res.sendStatus(200);
      }

      // Track the user
      const user = await userService.getOrCreateUser(messageData.from);

      // Handle different message types
      if (messageData.text && messageData.text.startsWith("/status")) {
        const status = await userService.getUserStatus(user);

        const statusMessage = [
          "📊 Your Status",
          "",
          `✨ Plan: ${status.planType}`,
          `🎁 Free Summaries: ${
            status.isSubscribed ? "Unlimited" : status.freeSummariesRemaining
          }`,
          `📝 Detail Level: ${status.summaryDetailLevel}`,
          `📈 Total Summaries Used: ${status.totalSummariesUsed}`,
          "",
          "Commands:",
          "• /status - View your status",
          "• /detail [brief|normal|detailed] - Set summary detail level",
          "• /subscribe - Subscribe to Premium",
          "• /unsubscribe - Unsubscribe from Premium",
        ].join("\n");

        await whatsapp.sendMessage(
          messageData.from,
          statusMessage,
          messageData.phoneNumberId
        );
        return res.sendStatus(200);
      }

      if (messageData.text && messageData.text.startsWith("/subscribe")) {
        try {
          if (user.isSubscribed) {
            await whatsapp.sendMessage(
              messageData.from,
              "You are already subscribed to Premium.",
              messageData.phoneNumberId
            );
            return res.sendStatus(200);
          }
          const result = await userService.initiateSubscription(user);
          await whatsapp.sendMessage(
            messageData.from,
            result.message,
            messageData.phoneNumberId
          );
        } catch (error) {
          console.error("Error initiating subscription:", error);
          await whatsapp.sendMessage(
            messageData.from,
            "Sorry, there was an error creating your subscription link. Please try again later.",
            messageData.phoneNumberId
          );
        }
        return res.sendStatus(200);
      }

      if (messageData.text && messageData.text.startsWith("/unsubscribe")) {
        try {
          if (!user.isSubscribed) {
            await whatsapp.sendMessage(
              messageData.from,
              "You are not currently subscribed to Premium.",
              messageData.phoneNumberId
            );
            return res.sendStatus(200);
          }
          await paypalService.cancelSubscription(user);
          await userService.cancelSubscription(user);
          await whatsapp.sendMessage(
            messageData.from,
            "Subscription cancelled. You now have the free plan with limited summaries.",
            messageData.phoneNumberId
          );
        } catch (error) {
          console.error("Error canceling subscription:", error);
          await whatsapp.sendMessage(
            messageData.from,
            "Sorry, there was an error canceling your subscription. Please try again later.",
            messageData.phoneNumberId
          );
        }
        return res.sendStatus(200);
      }

      if (messageData.text && messageData.text.startsWith("/detail")) {
        const args = messageData.text.split(" ");
        if (args.length !== 2) {
          await whatsapp.sendMessage(
            messageData.from,
            "Please specify a detail level: /detail [brief|normal|detailed]\n\n" +
              "• brief - Very concise, 1-2 sentences\n" +
              "• normal - Balanced summary with key points\n" +
              "• detailed - Comprehensive with supporting details",
            messageData.phoneNumberId
          );
        } else {
          try {
            const level = args[1].toLowerCase();
            const result = await userService.setSummaryDetailLevel(user, level);
            await whatsapp.sendMessage(
              messageData.from,
              result.message,
              messageData.phoneNumberId
            );
          } catch (error) {
            console.error("Error setting detail level:", error);
            await whatsapp.sendMessage(
              messageData.from,
              "Invalid detail level. Please use: brief, normal, or detailed",
              messageData.phoneNumberId
            );
          }
        }
        return res.sendStatus(200);
      }

      if (messageData.type === "audio" || messageData.type === "voice") {
        const availability = await userService.checkSummaryAvailability(user);

        if (!availability.hasFreeSummaries) {
          await whatsapp.sendMessage(
            messageData.from,
            "You have no free summaries remaining. Use /subscribe to get unlimited summaries!",
            messageData.phoneNumberId
          );
          return res.sendStatus(200);
        }

        const mediaId = messageData.audio?.id;
        if (!mediaId) {
          await whatsapp.sendMessage(
            messageData.from,
            "Sorry, I couldn't process this audio message.",
            messageData.phoneNumberId
          );
          return res.sendStatus(200);
        }

        await whatsapp.sendMessage(
          messageData.from,
          "Processing your voice message...",
          messageData.phoneNumberId
        );

        try {
          const preferences = await userService.getUserPreferences(user);
          const summary = await transcriptionService.transcribeWhatsAppAudio(
            mediaId,
            preferences.summaryDetailLevel
          );

          await userService.useSummary(user);
          await whatsapp.sendMessage(
            messageData.from,
            summary,
            messageData.phoneNumberId
          );
        } catch (error) {
          console.error("Error processing audio message:", error);
          await whatsapp.sendMessage(
            messageData.from,
            "Sorry, I encountered an error while processing your voice message. Please try again.",
            messageData.phoneNumberId
          );
        }
      } else {
        await whatsapp.sendMessage(
          messageData.from,
          "Please send a voice message for me to summarize, or use one of these commands:\n" +
            "• /status - View your status\n" +
            "• /detail [brief|normal|detailed] - Set summary detail level\n" +
            "• /subscribe - Toggle between free and premium plan",
          messageData.phoneNumberId
        );
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error("Error handling message:", error);
      res.sendStatus(500);
    }
  }

  isValidMessageRequest(body) {
    // Check if it's a WhatsApp message webhook
    if (body?.object !== "whatsapp_business_account") {
      return false;
    }

    // Get the messages array using optional chaining
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;

    // Check if messages exists and is a non-empty array
    return Array.isArray(messages) && messages.length > 0;
  }

  extractMessageData(body) {
    const change = body.entry[0].changes[0];
    const message = change.value.messages?.[0];

    if (!message) {
      throw new Error("No message found in webhook payload");
    }

    return {
      type: message.type,
      from: message.from,
      phoneNumberId: change.value.metadata.phone_number_id,
      messageId: message.id,
      text: message.text?.body,
      audio: message.audio || message.voice,
    };
  }
}

module.exports = new WhatsAppController();
