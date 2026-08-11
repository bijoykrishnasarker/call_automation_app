import { GoogleGenAI } from "@google/genai";
import { Note } from '@/types';

const getAI = (): GoogleGenAI | null => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateContactSummary = async (notes: Note[], contactName: string): Promise<string> => {
  try {
    const ai = getAI();
    if (!ai) return "AI Service unavailable. Please set NEXT_PUBLIC_GEMINI_API_KEY.";

    const historyText = notes.map(n => `[${n.createdAt}] ${n.type.toUpperCase()}: ${n.text}`).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert AI CRM assistant. 
      Analyze the following interaction history for contact "${contactName}".
      Provide a concise 2-3 sentence summary of the relationship status, key needs, and the recommended next action.
      
      History:
      ${historyText}`,
    });

    return response.text || "Unable to generate summary.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "AI Service unavailable. Please check API Key.";
  }
};

export const suggestEmailDraft = async (contactName: string, context: string): Promise<string> => {
  try {
    const ai = getAI();
    if (!ai) return "AI Service unavailable. Please set NEXT_PUBLIC_GEMINI_API_KEY.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Draft a professional, friendly email to ${contactName}.
      Context/Goal: ${context}.
      Keep it short, under 150 words. Use a warm tone suitable for a local business owner.`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Email Draft Error:", error);
    return "Error generating draft.";
  }
};

export const analyzeSentiment = async (text: string): Promise<'Positive' | 'Neutral' | 'Negative'> => {
  try {
    const ai = getAI();
    if (!ai) return 'Neutral';

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the sentiment of this text: "${text}". Return ONLY one word: Positive, Neutral, or Negative.`,
    });
    const sentiment = response.text?.trim();
    if (sentiment === 'Positive' || sentiment === 'Negative') return sentiment;
    return 'Neutral';
  } catch (e) {
    return 'Neutral';
  }
}
