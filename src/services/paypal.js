const axios = require("axios");
const config = require("../config");

class PayPalService {
  constructor() {
    this.baseUrl =
      process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.productId = process.env.PAYPAL_PRODUCT_ID;
    this.planId = process.env.PAYPAL_PLAN_ID;
  }

  async getAccessToken() {
    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString("base64");
      const response = await axios({
        method: "POST",
        url: `${this.baseUrl}/v1/oauth2/token`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        data: "grant_type=client_credentials",
      });
      return response.data.access_token;
    } catch (error) {
      console.error(
        "Error getting PayPal access token:",
        error.response?.data || error
      );
      throw new Error("Failed to get PayPal access token");
    }
  }

  async createSubscriptionLink(phoneNumber) {
    try {
      console.log("Getting PayPal access token...");
      const accessToken = await this.getAccessToken();
      console.log("Successfully got access token");

      console.log("Creating PayPal subscription...");
      const response = await axios({
        method: "POST",
        url: `${this.baseUrl}/v1/billing/subscriptions`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          plan_id: this.planId,
          application_context: {
            return_url: `${process.env.APP_URL}/webhooks/paypal/success?phone=${phoneNumber}`,
            cancel_url: `${process.env.APP_URL}/webhooks/paypal/cancel?phone=${phoneNumber}`,
            user_action: "SUBSCRIBE_NOW",
            brand_name: "WhatsApp Audio Summary",
          },
          subscriber: {
            name: {
              given_name: phoneNumber,
            },
            email_address: `${phoneNumber}@placeholder.com`,
          },
        },
      });
      console.log("Successfully created PayPal subscription");

      return {
        subscriptionId: response.data.id,
        approvalUrl: response.data.links.find((link) => link.rel === "approve")
          .href,
      };
    } catch (error) {
      console.error("Error in PayPal subscription creation:");
      console.error("Status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      console.error("Full error:", error);
      throw error;
    }
  }

  async cancelSubscription(user) {
    try {
      console.log("Getting PayPal access token...");
      const accessToken = await this.getAccessToken();
      console.log("Successfully got access token");

      console.log("Canceling PayPal subscription...");
      await axios({
        method: "POST",
        url: `${this.baseUrl}/v1/billing/subscriptions/${user.subscription.paypalSubscriptionId}/cancel`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          reason: "Customer requested cancellation",
        },
      });
      console.log("Successfully cancelled PayPal subscription");

      return {
        success: true,
        message: "Subscription successfully cancelled",
      };
    } catch (error) {
      console.error("Error in PayPal subscription cancellation:");
      console.error("Status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      console.error("Full error:", error);
      throw error;
    }
  }

  async verifyWebhookSignature(headers, body) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios({
        method: "POST",
        url: `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id: process.env.PAYPAL_WEBHOOK_ID,
          webhook_event: body,
        },
      });

      return response.data.verification_status === "SUCCESS";
    } catch (error) {
      console.error(
        "Error verifying webhook signature:",
        error.response?.data || error
      );
      return false;
    }
  }
}

module.exports = new PayPalService();
