const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsapp");
const paypalController = require("../controllers/paypal");

// WhatsApp webhook routes
router.get(
  "/whatsapp",
  whatsappController.verifyWebhook.bind(whatsappController)
);
router.post(
  "/whatsapp",
  whatsappController.handleMessage.bind(whatsappController)
);

// PayPal webhook route
router.post("/paypal", paypalController.handleWebhook.bind(paypalController));

// PayPal success and cancel routes
router.get(
  "/paypal/success",
  paypalController.handleSuccess.bind(paypalController)
);

router.get(
  "/paypal/cancel",
  paypalController.handleCancel.bind(paypalController)
);

module.exports = router;
