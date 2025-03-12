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
      console.log(
        "Preparing to transcribe audio, buffer size:",
        audioBuffer.length
      );

      // Convert buffer to file using OpenAI's utility
      const file = await toFile(audioBuffer, "audio.ogg");

      console.log("Sending request to OpenAI Whisper API");
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        response_format: "text",
      });

      console.log(
        "Transcription successful:",
        transcription.substring(0, 50) + "..."
      );
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

  async summarizeText(text, detailLevel = "normal") {
    try {
      console.log(
        "Generating summary for text:",
        text.substring(0, 50) + "..."
      );

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
      console.log("Detected language:", detectedLanguage);

      // Generate system message based on detected language and detail level
      let systemMessage =
        "You are a helpful assistant that provides voice message summaries. ";

      // Add detail level instructions
      switch (detailLevel) {
        case "brief":
          systemMessage +=
            "Provide very concise summaries focusing only on the most important points. Keep it to 1-2 sentences maximum.";
          break;
        case "detailed":
          systemMessage +=
            "Provide detailed summaries that capture main points and supporting details. Include context and nuance while maintaining clarity.";
          break;
        default: // 'normal'
          systemMessage +=
            "Provide balanced summaries that capture the main points while keeping it concise. Include key details but avoid excessive length.";
      }

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
        temperature: 0.7,
        max_tokens: detailLevel === "detailed" ? 250 : 150,
      });

      const summary = response.choices[0].message.content;
      console.log("Summary generated:", summary);
      return {
        summary,
        language: detectedLanguage,
      };
    } catch (error) {
      console.error("Error generating summary:", error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async transcribeWhatsAppAudio(mediaId, detailLevel = "normal") {
    try {
      console.log("Starting WhatsApp audio transcription process");
      const audioBuffer = await this.downloadAudio(mediaId);
      const transcription = await this.transcribeAudio(audioBuffer);
      const summaryResult = await this.summarizeText(
        transcription,
        detailLevel
      );
      console.log("WhatsApp audio processing completed successfully");
      return {
        transcription,
        summary: summaryResult.summary,
        language: summaryResult.language,
      };
    } catch (error) {
      console.error("Error in transcribeWhatsAppAudio:", error);
      throw error;
    }
  }
}

module.exports = new TranscriptionService();
