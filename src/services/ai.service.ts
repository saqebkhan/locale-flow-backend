import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const translateText = async (
  text: string,
  targetLanguages: string[],
  sourceLanguage: string = 'English'
): Promise<{ [key: string]: string }> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
    You are a professional translator for a SaaS localization platform.
    Translate the following text from ${sourceLanguage} into these languages: ${targetLanguages.join(', ')}.
    
    Text to translate: "${text}"
    
    Return the result ONLY as a valid JSON object where keys are the language codes and values are the translations.
    Do not include any markdown formatting or extra text.
    Example: {"fr": "Bonjour", "es": "Hola"}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonText);
  } catch (error: any) {
    console.error('AI Translation Error:', error);
    throw new Error('Failed to generate AI translation: ' + error.message);
  }
};
