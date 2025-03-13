require("dotenv").config();

const config = {
  port: process.env.PORT || 3000,
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    phoneNumberId: process.env.PHONE_NUMBER_ID,
    apiVersion: "v22.0",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
    productId: process.env.PAYPAL_PRODUCT_ID,
    planId: process.env.PAYPAL_PLAN_ID,
    apiUrl: process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com",
  },
  appUrl: process.env.APP_URL || "http://localhost:3000",
};

// Validate required environment variables
const requiredVars = [
  "WHATSAPP_TOKEN",
  "VERIFY_TOKEN",
  "PHONE_NUMBER_ID",
  "OPENAI_API_KEY",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_PRODUCT_ID",
  "PAYPAL_PLAN_ID",
  "APP_URL",
];

const missingVars = requiredVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
}

module.exports = config;
