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

      // Track the user
      const user = await userService.getOrCreateUser(messageData.from);

      // Handle different message types
      if (messageData.text && messageData.text.startsWith("/detail")) {
        // Handle detail level command
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
      } else if (messageData.type === "audio" || messageData.type === "voice") {
        console.log("Received voice/audio message, full message details:", {
          type: messageData.type,
          audio: messageData.audio,
          from: messageData.from,
          phoneNumberId: messageData.phoneNumberId,
        });

        // Check summary availability
        const availability = await userService.checkSummaryAvailability(
          messageData.from
        );

        if (availability.hasFreeSummaries) {
          try {
            const mediaId = messageData.audio.id;
            if (!mediaId) {
              throw new Error("No media ID found in the message");
            }

            console.log("Processing audio with media ID:", mediaId);

            // Send initial processing message
            await whatsapp.sendMessage(
              messageData.from,
              "Processing your voice message...",
              messageData.phoneNumberId
            );

            // Get user preferences
            const preferences = await userService.getUserPreferences(
              messageData.from
            );

            // Transcribe and summarize the audio with user's preferred detail level
            const result = await transcriptionService.transcribeWhatsAppAudio(
              mediaId,
              preferences.summaryDetailLevel
            );

            // Use one summary and get updated counts
            const summaryCount = await userService.useSummary(messageData.from);

            // Send only the summary and remaining balance
            await whatsapp.sendMessage(
              messageData.from,
              `${result.summary}\n\n💫 ${summaryCount.remaining} summaries remaining`,
              messageData.phoneNumberId
            );
          } catch (error) {
            console.error("Error processing voice message:", {
              error: error.message,
              stack: error.stack,
              messageData: messageData,
            });
            await whatsapp.sendMessage(
              messageData.from,
              "Sorry, I couldn't process your voice message. Please try again.",
              messageData.phoneNumberId
            );
          }
        } else {
          await whatsapp.sendMessage(
            messageData.from,
            "You have no free summaries remaining. Please purchase more to continue using the voice message summary feature.",
            messageData.phoneNumberId
          );
        }
      } else if (messageData.text) {
        await whatsapp.sendMessage(
          messageData.from,
          `Echo: ${messageData.text}`,
          messageData.phoneNumberId
        );
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("Error handling message:", error);
      res.sendStatus(500);
    }
  }

  isValidMessageRequest(body) {
    return (
      body.object &&
      body.entry &&
      body.entry[0]?.changes &&
      body.entry[0]?.changes[0]?.value?.messages
    );
  }

  extractMessageData(body) {
    const change = body.entry[0].changes[0];
    const message = change.value.messages[0];
    const audio = message.audio || message.voice;

    console.log("Raw message from WhatsApp:", message);
    console.log("Extracted audio data:", audio);

    return {
      phoneNumberId: change.value.metadata.phone_number_id,
      from: message.from,
      type: message.type,
      text: message.text?.body,
      audio: audio,
    };
  }
}

module.exports = new WebhookController();
