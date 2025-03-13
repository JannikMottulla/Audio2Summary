const axios = require("axios");
const config = require("../config");

class WhatsAppService {
  constructor() {
    this.baseUrl = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;
    this.token = config.whatsapp.token;
  }

  async sendMessage(to, text, phoneNumberId) {
    try {
      console.log(`Attempting to send message to ${to}:`, text);

      const url = `${this.baseUrl}/${phoneNumberId}/messages?access_token=${this.token}`;
      console.log("Using WhatsApp API URL:", url);

      // Ensure text is a string
      const messageText =
        typeof text === "object" ? JSON.stringify(text) : String(text);

      const response = await axios({
        method: "POST",
        url: url,
        data: {
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: {
            body: messageText,
            preview_url: false,
          },
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
      });

      console.log("Message sent successfully, response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "Failed to send WhatsApp message. Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  verifyWebhook(mode, token, challenge) {
    if (!mode || !token || !challenge) {
      throw new Error("Missing required webhook verification parameters");
    }

    if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
      return challenge;
    }

    throw new Error("Invalid webhook verification token");
  }
}

module.exports = new WhatsAppService();
