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
          `📝 Current Mode: ${status.mode}`,
          `📈 Total Summaries Used: ${status.totalSummariesUsed}`,
          "",
          "Commands:",
          "• /status - View your status",
          "• /mode [default | summary] - Set mode to receive either a word by word transcription or a summary of the voice message",
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

      if (messageData.text && messageData.text.startsWith("/mode")) {
        const args = messageData.text.split(" ");
        if (args.length !== 2) {
          await whatsapp.sendMessage(
            messageData.from,
            "Please specify if you want to transcribe your message or summarize it: /mode [default | summary]\n\n" +
              "• default - word by word transcription \n" +
              "• summary - wummerized with key details \n",
            messageData.phoneNumberId
          );
        } else {
          try {
            const mode = args[1].toLowerCase();
            const result = await userService.setMode(user, mode);
            await whatsapp.sendMessage(
              messageData.from,
              result.message,
              messageData.phoneNumberId
            );
          } catch (error) {
            await whatsapp.sendMessage(
              messageData.from,
              "Invalid mode. Please use: default or summary",
              messageData.phoneNumberId
            );
          }
        }
        return res.sendStatus(200);
      }

      if (
        messageData.text &&
        messageData.text.startsWith(process.env.ADMIN_PASSWORD)
      ) {
        const args = messageData.text.split(" ");
        if (args.length !== 2) {
          await whatsapp.sendMessage(
            messageData.from,
            "Please specify the number of free summaries to set for all users.",
            messageData.phoneNumberId
          );
          return res.sendStatus(200);
        }
        const count = parseInt(args[1]);
        if (isNaN(count)) {
          await whatsapp.sendMessage(
            messageData.from,
            "Invalid number. Please specify a valid number of free summaries.",
            messageData.phoneNumberId
          );
          return res.sendStatus(200);
        }

        const allUsers = await userService.getAllUsers();
        for (const user of allUsers) {
          console.log(
            `Setting ${count} free summaries for user: ${user.phoneNumber}`
          );
          user.freeSummariesRemaining = count;
          await user.save();
        }

        await whatsapp.sendMessage(
          messageData.from,
          `Successfully set ${count} free summaries for all users.`,
          messageData.phoneNumberId
        );
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
          const preferences = await userService.getUserMode(user);
          const summary = await transcriptionService.transcribeWhatsAppAudio(
            mediaId,
            preferences.mode
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
            "• /status - View your status \n" +
            "• /mode [default | summary] - Set mode to receive either a word by word transcription or a summary of the voice message" +
            "• /subscribe - Receive a subscription link \n" +
            "• /unsubscribe - Cancel your subscription any time",

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
