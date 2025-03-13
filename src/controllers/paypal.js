const paypalService = require("../services/paypal");
const userService = require("../services/user");
const whatsapp = require("../services/whatsapp");

class PayPalController {
  async handleWebhook(req, res) {
    try {
      const isValid = await paypalService.verifyWebhookSignature(
        req.headers,
        req.body
      );

      if (!isValid) {
        console.error("Invalid PayPal webhook signature");
        return res.sendStatus(400);
      }

      await userService.handlePayPalWebhook(req.body);

      // Send notification to user if phone number is available
      const user = await userService.findBySubscriptionId(req.body.resource.id);
      if (user) {
        const status = req.body.event_type;
        let message;

        switch (status) {
          case "BILLING.SUBSCRIPTION.ACTIVATED":
            message =
              "✨ Your Premium subscription is now active! You have unlimited voice message summaries.";
            break;
          case "BILLING.SUBSCRIPTION.CANCELLED":
            message =
              "Your Premium subscription has been cancelled. You still have access to free summaries.";
            break;
          case "BILLING.SUBSCRIPTION.SUSPENDED":
            message =
              "⚠️ Your Premium subscription has been suspended. Please check your PayPal account.";
            break;
          case "BILLING.SUBSCRIPTION.EXPIRED":
            message =
              "Your Premium subscription has expired. Use /subscribe to reactivate Premium.";
            break;
        }

        if (message) {
          await whatsapp.sendMessage(user.phoneNumber, message);
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("Error handling PayPal webhook:", error);
      res.sendStatus(500);
    }
  }

  async handleSuccess(req, res) {
    try {
      const { phone, subscription_id } = req.query;
      const user = await userService.getOrCreateUser(phone);

      if (user.subscription?.paypalSubscriptionId === subscription_id) {
        await user.setSubscription(subscription_id, "ACTIVE");
        res.send(
          "Subscription successful! You can close this window and return to WhatsApp."
        );
        await whatsapp.sendMessage(
          phone,
          "Your Premium Access is now active! You can cancel it any time by using the /unsubscribe command!",
          process.env.PHONE_NUMBER_ID
        );
      } else {
        res.status(400).send("Invalid subscription information");
      }
    } catch (error) {
      console.error("Error handling subscription success:", error);
      res.status(500).send("Error processing subscription");
    }
  }

  async handleCancel(req, res) {
    try {
      const { phone } = req.query;
      const user = await userService.getOrCreateUser(phone);

      res.send("Payment process cancelled.");
      await whatsapp.sendMessage(
        phone,
        "You either cancelled the payment or it failed. Please try again.",
        process.env.PHONE_NUMBER_ID
      );
    } catch (error) {
      console.error("Error handling subscription cancellation:", error);
      res.status(500).send("Error processing cancellation");
    }
  }
}

module.exports = new PayPalController();
