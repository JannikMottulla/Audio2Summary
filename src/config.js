require("dotenv").config();

const config = {
  port: process.env.PORT || 3000,
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    phoneNumberId: process.env.PHONE_NUMBER_ID,
    apiVersion: process.env.API_VERSION || "v17.0",
  },
  mongodb: {
    uri:
      process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-summary",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};

// Validate required environment variables
const requiredEnvVars = [
  "WHATSAPP_TOKEN",
  "VERIFY_TOKEN",
  "PHONE_NUMBER_ID",
  "API_VERSION",
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

module.exports = config;
