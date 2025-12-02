
import { GoogleGenAI, Type, Chat, FunctionDeclaration } from "@google/genai";
import { getApiKey } from "./storage";
import { VeoConfig } from "../types";

const FALLBACK_KEY = 'AIzaSyDkIHRaNZEHxS7awmaAcWWKTw9k0XlL-GA';

// Helper to get the actual key string for components that need to instantiate their own client (like AudioSuite)
export const getEffectiveApiKey = () => {
  // 1. Check for user-provided key in localStorage (highest priority for user override)
  const customKey = getApiKey();
  if (customKey) return customKey;

  // 2. Check for process.env.API_KEY (standard env injection)
  if (process.env.API_KEY) return process.env.API_KEY;

  // 3. Fallback
  return FALLBACK_KEY;
};

// Securely access the API key
const getAiClient = async (requireUserKey = false) => {
  const apiKey = getEffectiveApiKey();
  return new GoogleGenAI({ apiKey });
};

export const chatStream = async (
  modelName: string,
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  config?: {
    thinking?: boolean;
    search?: boolean;
    maps?: boolean;
    latLng?: { latitude: number; longitude: number };
  },
  image?: { data: string; mimeType: string }
) => {
  const ai = await getAiClient();
  
  const tools: any[] = [];
  const toolConfig: any = {};
  
  if (config?.search) {
    tools.push({ googleSearch: {} });
  }
  
  if (config?.maps) {
    tools.push({ googleMaps: {} });
    if (config?.latLng) {
      toolConfig.retrievalConfig = {
        latLng: config.latLng
      };
    }
  }

  const generationConfig: any = {
    tools: tools.length > 0 ? tools : undefined,
    toolConfig: tools.length > 0 && config?.maps ? toolConfig : undefined,
  };

  // Setup thinking
  if (config?.thinking && modelName.includes('gemini-3-pro')) {
    generationConfig.thinkingConfig = { thinkingBudget: 32768 };
  }

  const chat = ai.chats.create({
    model: modelName,
    history: history,
    config: generationConfig,
  });

  // Construct message content
  let msgContent: any = message;
  
  if (image) {
    // If we have an image, we build the parts array.
    const parts: any[] = [
      { 
        inlineData: {
          data: image.data,
          mimeType: image.mimeType
        }
      }
    ];
    
    if (message && message.trim()) {
        parts.push({ text: message });
    } else {
        // Safe fallback for image-only messages
        if (parts.length === 1) {
             msgContent = parts;
        } else {
             msgContent = parts;
        }
    }
    // If msgContent was assigned parts, use it.
    if (parts.length > 0) msgContent = parts;
  } 
  // If NO image and NO text (should be filtered by UI, but double check)
  else if (!message || !message.trim()) {
      msgContent = " ";
  }

  return chat.sendMessageStream({ message: msgContent });
};


export const transcribeAudio = async (audioBase64: string, mimeType: string) => {
    const ai = await getAiClient();
    return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: audioBase64,
                        mimeType: mimeType
                    }
                },
                { text: "Transcribe this audio." }
            ]
        }
    });
}

export const transcribeAudioStream = async (audioBase64: string, mimeType: string) => {
    const ai = await getAiClient();
    return ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: audioBase64,
                        mimeType: mimeType
                    }
                },
                { text: "Transcribe this audio." }
            ]
        }
    });
}

export const translateAudio = async (audioBase64: string, mimeType: string, targetLanguage: string) => {
    const ai = await getAiClient();
    return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: audioBase64,
                        mimeType: mimeType
                    }
                },
                { text: `Translate the spoken content of this audio into ${targetLanguage}. Return only the translated text.` }
            ]
        }
    });
}

export const generateSpeech = async (text: string, voiceName: string = 'Kore') => {
    const ai = await getAiClient();
    return ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
        },
      },
    });
}

export const generateImage = async (prompt: string, config: { aspectRatio: string; imageSize: string }) => {
    const ai = await getAiClient();
    // Use gemini-3-pro-image-preview for high quality images or if specific sizes are requested
    return ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: {
                aspectRatio: config.aspectRatio as any,
                imageSize: config.imageSize as any
            }
        }
    });
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string) => {
    const ai = await getAiClient();
    return ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: mimeType
                    }
                },
                { text: prompt }
            ]
        }
    });
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string) => {
    const ai = await getAiClient();
    return ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: mimeType
                    }
                },
                { text: prompt }
            ]
        }
    });
};

export const generateVideo = async (prompt: string, config: VeoConfig, image?: { data: string, mimeType: string }) => {
    const ai = await getAiClient();
    
    // Create config object
    const videoConfig: any = {
        numberOfVideos: 1,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio
    };

    let operation: any;

    if (image) {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: image.data,
                mimeType: image.mimeType
            },
            config: videoConfig
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: videoConfig
        });
    }

    // Poll until done
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    return operation;
};

export const analyzeVideo = async (prompt: string, videoBase64: string, mimeType: string) => {
    const ai = await getAiClient();
    return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: videoBase64,
                        mimeType: mimeType
                    }
                },
                { text: prompt }
            ]
        }
    });
};

/**
 * Helper to format Gemini API errors into user-friendly messages
 */
export const formatGeminiError = (error: any): string => {
  const msg = (error.message || error.toString()).toLowerCase();
  
  if (msg.includes('google maps tool is not enabled')) return "Google Maps Grounding is not enabled for this model.";
  if (msg.includes('400')) return "Invalid request (400). Please check your prompt or parameters.";
  if (msg.includes('401')) return "Invalid API Key (401). Please update your key in the Login/Settings page.";
  if (msg.includes('403')) return "Access Denied (403). Your API key may lack permissions, be expired, or the model is not available in your region.";
  if (msg.includes('404')) return "Model not found (404). This feature may not be available in your region or with your current API key.";
  if (msg.includes('429')) return "Rate limit exceeded (429). You are sending requests too fast. Please wait a moment.";
  if (msg.includes('500') || msg.includes('503')) return "Google Service Error (5xx). The AI service is temporarily unavailable. Please try again later.";
  if (msg.includes('safety')) return "Response blocked by safety filters. Please try modifying your prompt.";
  if (msg.includes('fetch failed') || msg.includes('networkerror')) return "Network connection failed. Please check your internet.";
  
  return error.message || "An unexpected error occurred.";
};
