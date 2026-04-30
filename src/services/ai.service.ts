import { GoogleGenerativeAI } from '@google/generative-ai';
import { translate } from 'google-translate-api-x';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const translateText = async (
  text: string,
  targetLanguages: string[],
  sourceLanguage: string = 'auto'
): Promise<{ [key: string]: string }> => {
  // Fallback to free key-less translation if no API key is provided
  if (!process.env.GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY found. Using free fallback translation...');
    const results: { [key: string]: string } = {};
    
    await Promise.all(targetLanguages.map(async (lang) => {
      try {
        const res = await translate(text, { to: lang, from: sourceLanguage });
        results[lang] = res.text;
      } catch (err) {
        console.error(`Fallback translation failed for ${lang}:`, err);
        results[lang] = `[Translation Error]`;
      }
    }));
    
    return results;
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
    const rawText = response.text().trim();
    
    // Extract JSON even if the AI included conversational text or markdown blocks
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI returned an invalid response format');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error('AI Translation Error:', error);
    throw new Error('Failed to generate AI translation: ' + error.message);
  }
};

// --- Test Block ---
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ai.service.ts')) {
  console.log('Testing Gemini AI Integration...');
  translateText('Hello world, welcome to our amazing translation platform!', ['fr', 'es', 'de'])
    .then(res => {
      console.log('✅ AI Translation Working!');
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error('❌ AI Translation Failed!');
      console.error(err.message);
      console.log('\nTip: Make sure GEMINI_API_KEY is set in backend/.env');
    });
}
