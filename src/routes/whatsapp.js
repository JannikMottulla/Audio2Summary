const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsapp");

// WhatsApp webhook routes
router.get("", whatsappController.verifyWebhook);
router.post("", whatsappController.handleMessage);

module.exports = router;
