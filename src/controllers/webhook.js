const whatsapp = require("../services/whatsapp");
const userService = require("../services/user");
const transcriptionService = require("../services/transcription");

class WebhookController {
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
      console.log("Received webhook body:", JSON.stringify(body, null, 2));

      if (!this.isValidMessageRequest(body)) {
        return res.sendStatus(404);
      }

      const messageData = this.extractMessageData(body);
      console.log(
        "Extracted message data:",
        JSON.stringify(messageData, null, 2)
      );

      // Handle status updates
      if (messageData.type === "status") {
        console.log(
          `Message ${messageData.messageId} status: ${messageData.status}`
        );
        return res.sendStatus(200);
      }

      // Track the user
      const user = await userService.getOrCreateUser(messageData.from);

      // Handle different message types
      if (messageData.text && messageData.text.startsWith("/status")) {
        const status = await userService.getUserStatus(messageData.from);
        const lastActivity = status.lastInteraction
          ? new Date(status.lastInteraction).toLocaleDateString()
          : "No activity yet";

        const statusMessage = [
          "📊 Your Status",
          "",
          `✨ Plan: ${status.planType}`,
          `🎁 Free Summaries: ${
            status.isSubscribed ? "Unlimited" : status.freeSummariesRemaining
          }`,
          `📝 Detail Level: ${status.summaryDetailLevel}`,
          `📈 Total Summaries Used: ${status.totalSummariesUsed}`,
          `📅 Last Activity: ${lastActivity}`,
          "",
          "Commands:",
          "• /status - View your status",
          "• /detail [brief|normal|detailed] - Set summary detail level",
          "• /subscribe - Toggle between free and premium plan",
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
          const result = await userService.initiateSubscription(
            messageData.from
          );
          await whatsapp.sendMessage(
            messageData.from,
            result.message,
            messageData.phoneNumberId
          );
        } catch (error) {
          await whatsapp.sendMessage(
            messageData.from,
            "Sorry, there was an error creating your subscription link. Please try again later.",
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
            const result = await userService.setSummaryDetailLevel(
              messageData.from,
              level
            );
            await whatsapp.sendMessage(
              messageData.from,
              result.message,
              messageData.phoneNumberId
            );
          } catch (error) {
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
        const availability = await userService.checkSummaryAvailability(
          messageData.from
        );

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

        const preferences = await userService.getUserPreferences(
          messageData.from
        );
        const summary = await transcriptionService.transcribeWhatsAppAudio(
          mediaId,
          preferences.summaryDetailLevel
        );

        await userService.useSummary(messageData.from);
        await whatsapp.sendMessage(
          messageData.from,
          summary,
          messageData.phoneNumberId
        );
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
    return (
      body &&
      body.object === "whatsapp_business_account" &&
      body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value &&
      body.entry[0].changes[0].value.messages
    );
  }

  extractMessageData(body) {
    const change = body.entry[0].changes[0];
    const message = change.value.messages[0];
    const status = change.value.statuses?.[0];

    if (status) {
      return {
        type: "status",
        messageId: status.id,
        status: status.status,
      };
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

module.exports = WebhookController;
