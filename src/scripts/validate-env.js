const requiredEnvVars = [
  "PAYPAL_API_URL",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_PRODUCT_ID",
  "PAYPAL_PLAN_ID",
  "WHATSAPP_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
  "APP_URL",
  "MONGODB_URI",
];

function validateEnv() {
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    process.exit(1);
  }

  console.log("✅ All required environment variables are set");
}

validateEnv();
