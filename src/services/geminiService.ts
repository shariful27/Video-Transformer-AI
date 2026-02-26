import { GoogleGenAI, Modality } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will not work.");
      // We still create the instance to avoid null checks everywhere, 
      // but it will fail on actual calls which we can handle.
      aiInstance = new GoogleGenAI({ apiKey: "MISSING_KEY" });
    } else {
      aiInstance = new GoogleGenAI({ apiKey });
    }
  }
  return aiInstance;
}

export async function analyzeVideo(videoBase64: string, mimeType: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: videoBase64,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this video. Return a JSON object with the following keys: 'title' (a catchy, viral title for YouTube/Facebook), 'description' (a short SEO description), 'tags' (a comma-separated list of viral keywords/tags related to the video content), and 'analysis' (a brief summary of content and copyright risks).",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return response.text;
}

export async function verifyVideo(videoBase64: string, mimeType: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: videoBase64,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this transformed video. Is it likely to pass YouTube and Facebook copyright checks? Check for any remaining copyrighted audio, logos, or unmodified copyrighted content. Provide a confidence score (e.g., 95% Safe) and a brief explanation of why it is safe or what risks remain.",
          },
        ],
      },
    ],
  });

  return response.text;
}

export async function generateVoiceover(text: string, voice: string = 'Kore') {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say clearly and professionally: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
}
