const axios = require("axios");
const OpenAI = require("openai");
const config = require("../config");
const { toFile } = require("openai/uploads");

class TranscriptionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async getMediaUrl(mediaId) {
    try {
      console.log("Fetching media URL for ID:", mediaId);
      const response = await axios.get(
        `https://graph.facebook.com/${config.whatsapp.apiVersion}/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${config.whatsapp.token}`,
          },
        }
      );
      console.log("Media URL response:", response.data);
      return response.data.url;
    } catch (error) {
      console.error("Error getting media URL:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw new Error(`Failed to get media URL: ${error.message}`);
    }
  }

  async downloadAudio(mediaId) {
    try {
      // First get the actual media URL
      const url = await this.getMediaUrl(mediaId);
      console.log("Got media URL, attempting to download audio");

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
        },
      });
      console.log(
        "Audio download successful, content length:",
        response.data.length
      );
      return Buffer.from(response.data);
    } catch (error) {
      console.error("Error downloading audio:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw new Error(`Failed to download audio file: ${error.message}`);
    }
  }

  async transcribeAudio(audioBuffer) {
    try {
      // Convert buffer to file using OpenAI's utility
      const file = await toFile(audioBuffer, "audio.ogg");

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        response_format: "text",
      });

      return transcription;
    } catch (error) {
      console.error("Error transcribing audio:", {
        message: error.message,
        type: error.type,
        code: error.code,
        stack: error.stack,
      });
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  async summarizeText(text) {
    try {
      // First, detect the language
      const languageResponse = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a language detection expert. Respond with only the ISO language code (e.g., 'en', 'es', 'de', etc.).",
          },
          {
            role: "user",
            content: `What language is this text in?\n\n${text}`,
          },
        ],
        temperature: 0,
        max_tokens: 2,
      });

      const detectedLanguage =
        languageResponse.choices[0].message.content.trim();

      // Generate system message based on detected language and detail level
      let systemMessage =
        "You are an assistant that summarizes voice messages. Stay concise and to the point.";

      if (detectedLanguage !== "en") {
        systemMessage += ` Provide the summary in ${detectedLanguage} language.`;
      }

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemMessage,
          },
          {
            role: "user",
            content: `Please summarize this voice message:\n\n${text}`,
          },
        ],
        temperature: 0.9,
        max_tokens: 200,
      });

      const summary = response.choices[0].message.content;
      return {
        summary,
        language: detectedLanguage,
      };
    } catch (error) {
      console.error("Error generating summary:", error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async transcribeWhatsAppAudio(mediaId, mode = "default") {
    try {
      // Download the audio file
      const audioBuffer = await this.downloadAudio(mediaId);

      // Transcribe the audio
      const transcription = await this.transcribeAudio(audioBuffer);

      if (mode === "summary") {
        // Get the summary
        const summaryResult = await this.summarizeText(
          transcription,
          detailLevel
        );
        return `📝 *Voice Message Summary*\n\n${summaryResult.summary}`;
      } else {
        return `📝 *Voice Message Transcription*\n\n${transcription}`;
      }
    } catch (error) {
      console.error("Error in transcribeWhatsAppAudio:", error);
      throw error;
    }
  }
}

module.exports = new TranscriptionService();
