import { GoogleGenAI, Modality } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MISSING_KEY") {
      throw new Error("GEMINI_API_KEY is missing. Please add it to your Vercel Environment Variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function analyzeVideo(videoBase64: string, mimeType: string) {
  try {
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
  } catch (error: any) {
    console.error("Gemini analyzeVideo error:", error);
    if (error.message?.includes("API key not valid")) {
      throw new Error("Invalid Gemini API Key. Please check your Vercel settings.");
    }
    throw error;
  }
}

export async function verifyVideo(videoBase64: string, mimeType: string) {
  try {
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
              text: "URGENT: Perform a high-speed copyright safety audit on this transformed video for YouTube and Facebook Content ID systems. Check if the micro-jitter, audio phase shifts, and pixel perturbations are sufficient to bypass fingerprinting. Provide a definitive 'Safe' or 'Risk' status with a confidence score. Focus on whether it appears as 100% original content to automated systems.",
            },
          ],
        },
      ],
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini verifyVideo error:", error);
    throw error;
  }
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
