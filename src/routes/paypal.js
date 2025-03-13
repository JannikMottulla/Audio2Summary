const express = require("express");
const router = express.Router();
const paypalController = require("../controllers/paypal");
const subscriptionController = require("../controllers/subscription");

// Success and cancel routes
router.get("/success", paypalController.handleSuccess);
router.get("/cancel", paypalController.handleCancel);

// Webhook route
router.post("/webhook", subscriptionController.handleWebhook);

module.exports = router;
