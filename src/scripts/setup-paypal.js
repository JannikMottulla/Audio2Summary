const axios = require("axios");
require("dotenv").config();

async function getAccessToken() {
  try {
    console.log("Using PayPal credentials:");
    console.log("Client ID:", process.env.PAYPAL_CLIENT_ID);
    console.log(
      "API URL:",
      process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com"
    );

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const response = await axios({
      method: "POST",
      url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      data: "grant_type=client_credentials",
    });

    console.log("Successfully got access token");
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting access token:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    throw error;
  }
}

async function createProduct(accessToken) {
  try {
    console.log("\nCreating PayPal product...");
    const response = await axios({
      method: "POST",
      url: "https://api-m.sandbox.paypal.com/v1/catalogs/products",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        name: "WhatsApp Audio Summary Premium",
        description: "Unlimited voice message summaries with premium features",
        type: "SERVICE",
        category: "SOFTWARE",
      },
    });

    console.log("Product created successfully");
    console.log("Product data:", response.data);
    return response.data.id;
  } catch (error) {
    console.error("Error creating product:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    throw error;
  }
}

async function createPlan(accessToken, productId) {
  try {
    console.log("\nCreating subscription plan...");
    console.log("Using product ID:", productId);

    const response = await axios({
      method: "POST",
      url: "https://api-m.sandbox.paypal.com/v1/billing/plans",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        product_id: productId,
        name: "Monthly Premium Subscription",
        description: "WhatsApp Audio Summary Premium - Monthly Subscription",
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: "3.99",
                currency_code: "EUR",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "EUR",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      },
    });

    console.log("Plan created successfully");
    console.log("Plan data:", response.data);
    return response.data.id;
  } catch (error) {
    console.error("Error creating plan:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    throw error;
  }
}

async function setup() {
  try {
    console.log("Starting PayPal setup...");
    const accessToken = await getAccessToken();

    const productId = await createProduct(accessToken);
    console.log("\nProduct created with ID:", productId);

    const planId = await createPlan(accessToken, productId);
    console.log("\nPlan created with ID:", planId);

    console.log("\nAdd these IDs to your .env file:");
    console.log(`PAYPAL_PRODUCT_ID=${productId}`);
    console.log(`PAYPAL_PLAN_ID=${planId}`);
  } catch (error) {
    console.error("\nSetup failed:");
    console.error(error);
    process.exit(1);
  }
}

setup();
