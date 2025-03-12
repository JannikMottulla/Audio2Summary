# WhatsApp Message Responder

A Node.js application that can receive and respond to WhatsApp messages using the WhatsApp Cloud API.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Meta Developer Account
- A WhatsApp Business Account
- A verified phone number in your WhatsApp Business Account

## Setup

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure your environment variables:

   - Copy `.env.example` to `.env`
   - Update the following variables in `.env`:
     - `WHATSAPP_TOKEN`: Your WhatsApp Cloud API token
     - `WHATSAPP_VERIFY_TOKEN`: A custom verification token of your choice
     - `WHATSAPP_PHONE_NUMBER_ID`: Your WhatsApp Phone Number ID
     - `PORT`: The port number for your server (default: 3000)

4. Set up your webhook:
   - Deploy this application to a server with HTTPS support
   - Configure your webhook URL in the Meta Developer Console
   - Use the verification token you set in your `.env` file

## Running the Application

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Features

- Webhook verification endpoint (`GET /webhook`)
- Message receiving webhook (`POST /webhook`)
- Auto-reply to incoming messages
- Health check endpoint (`GET /`)

## API Endpoints

- `GET /webhook`: WhatsApp webhook verification
- `POST /webhook`: Receive WhatsApp messages
- `GET /`: Health check endpoint

## Testing

To test the webhook locally:

1. Use a tool like ngrok to create a public HTTPS URL
2. Set up the webhook URL in the Meta Developer Console
3. Send a message to your WhatsApp Business number

## License

MIT
