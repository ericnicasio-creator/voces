import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI client with required telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Supported prebuilt voices metadata
app.get('/api/voices', (_req, res) => {
  const voices = [
    {
      id: 'Kore',
      name: 'Kore',
      gender: 'Female / Neutral',
      tone: 'Warm, natural, versatile',
      description: 'Balanced, pleasant, and clear tone ideal for narrations, tutorials, and general assistant voice.',
      color: 'emerald',
    },
    {
      id: 'Puck',
      name: 'Puck',
      gender: 'Male',
      tone: 'Energetic, playful, dynamic',
      description: 'Lively and engaging voice suited for storytelling, casual dialogue, podcasts, and upbeat announcements.',
      color: 'amber',
    },
    {
      id: 'Charon',
      name: 'Charon',
      gender: 'Male',
      tone: 'Deep, calm, resonant',
      description: 'Authoritative, calm, and grounded delivery. Excellent for documentaries, audiobooks, and formal alerts.',
      color: 'indigo',
    },
    {
      id: 'Fenrir',
      name: 'Fenrir',
      gender: 'Male',
      tone: 'Bold, crisp, confident',
      description: 'Strong, articulate speaker with high clarity. Great for news broadcasts, tech demos, and presentations.',
      color: 'rose',
    },
    {
      id: 'Zephyr',
      name: 'Zephyr',
      gender: 'Female',
      tone: 'Soft, gentle, conversational',
      description: 'Relaxed and friendly tone, ideal for meditation, wellness, customer support, and gentle reminders.',
      color: 'violet',
    },
  ];
  res.json({ voices });
});

// Helper to parse Gemini error details
function parseGeminiError(err: any) {
  const raw = String(err?.message || err || '');
  let isQuota = false;
  let retryDelay = 0;
  let humanMessage = raw;

  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('Quota exceeded') || raw.includes('free_tier_requests')) {
    isQuota = true;
    humanMessage = 'Has alcanzado el límite de cuota gratuita diaria (10 peticiones/día) de Google AI Studio para este modelo.';
    const delayMatch = raw.match(/retryDelay["']?:\s*["']?(\d+)s/i);
    if (delayMatch) {
      retryDelay = parseInt(delayMatch[1], 10);
    } else {
      const textMatch = raw.match(/retry in\s*([0-9\.]+)m/i);
      if (textMatch) {
        retryDelay = Math.round(parseFloat(textMatch[1]) * 60);
      }
    }
  }

  return {
    isQuota,
    humanMessage,
    retryDelay,
    raw,
  };
}

// Primary TTS generation endpoint
app.post('/api/tts/generate', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no está configurada en el servidor. Por favor revisa las variables de entorno.',
      });
    }

    const {
      text,
      voice = 'Kore',
      style = 'Clear and natural',
      model = 'gemini-3.8-flash-tts',
      mode = 'single', // 'single' | 'dialogue' | 'prompt'
      dialogue = [],
      promptCustomPrefix = '',
    } = req.body;

    if (mode === 'single' || mode === 'prompt') {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'El texto no puede estar vacío.' });
      }
    } else if (mode === 'dialogue') {
      if (!Array.isArray(dialogue) || dialogue.length === 0) {
        return res.status(400).json({ error: 'Se requieren líneas de diálogo para el modo podcast.' });
      }
    }

    // List of candidate models to try with automatic fallback if quota is exhausted
    const candidateModels: string[] = [];
    if (model) {
      candidateModels.push(model);
    }
    // Fallback options
    if (mode === 'dialogue') {
      if (!candidateModels.includes('gemini-3.8-flash-tts')) candidateModels.push('gemini-3.8-flash-tts');
    } else {
      if (!candidateModels.includes('gemini-3.8-flash-tts')) candidateModels.push('gemini-3.8-flash-tts');
      if (!candidateModels.includes('gemini-3.8-flash-lite-tts')) candidateModels.push('gemini-3.8-flash-lite-tts');
    }

    let response: any = null;
    let effectiveModel = candidateModels[0];
    let lastError: any = null;

    for (const currentModel of candidateModels) {
      try {
        effectiveModel = currentModel;

        if (mode === 'dialogue') {
          const speakerNames: string[] = Array.from(new Set(dialogue.map((d: any) => String(d.speaker || 'Speaker 1'))));
          const speaker1: string = String(speakerNames[0] || 'Alex');
          const speaker2: string = String(speakerNames[1] || 'Sam');

          const voice1: string = String(dialogue.find((d: any) => d.speaker === speaker1)?.voice || 'Puck');
          const voice2: string = String(dialogue.find((d: any) => d.speaker === speaker2)?.voice || 'Kore');

          const parts = dialogue.map((line: any) => ({
            text: `${line.speaker}: ${line.text}`,
            speechMetadata: {
              speaker: line.speaker,
              style: line.style || 'Natural, engaging',
            },
          }));

          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts,
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    {
                      speaker: speaker1,
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice1 },
                      },
                    },
                    {
                      speaker: speaker2,
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice2 },
                      },
                    },
                  ],
                },
              },
            },
          });
        } else if (mode === 'prompt') {
          const fullPrompt = promptCustomPrefix
            ? `${promptCustomPrefix}: ${text.trim()}`
            : `Lee el siguiente texto exactamente como está escrito, con una voz clara y natural: ${text.trim()}`;

          response = await ai.models.generateContent({
            model: effectiveModel,
            contents: fullPrompt,
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
                },
              },
            },
          });
        } else {
          // Standard single speaker mode
          const speechParts: any[] = [
            {
              text: text.trim(),
            },
          ];

          if (style && style.trim().length > 0) {
            speechParts[0].speechMetadata = {
              style: style.trim(),
            };
          }

          response = await ai.models.generateContent({
            model: effectiveModel,
            contents: [
              {
                role: 'user',
                parts: speechParts,
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
                },
              },
            },
          });
        }

        // If succeeded, break out of candidate loop
        if (response) {
          break;
        }
      } catch (candidateErr: any) {
        lastError = candidateErr;
        const parsed = parseGeminiError(candidateErr);
        console.warn(`Model ${currentModel} failed:`, parsed.humanMessage);

        // If it's a quota issue and there are other candidates, try next candidate
        if (parsed.isQuota && candidateModels.indexOf(currentModel) < candidateModels.length - 1) {
          console.info(`Attempting fallback to next model...`);
          continue;
        }

        // If no more candidates, throw error to outer catch
        throw candidateErr;
      }
    }

    // Extract inline audio data
    const part = response?.candidates?.[0]?.content?.parts?.[0];
    const inlineData = part?.inlineData;

    if (!inlineData?.data) {
      let foundData: string | undefined;
      let foundMime = 'audio/wav';

      const parts = response?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          foundData = p.inlineData.data;
          foundMime = p.inlineData.mimeType || 'audio/wav';
          break;
        }
      }

      if (!foundData) {
        return res.status(502).json({
          error: 'No se recibieron datos de audio del modelo Gemini.',
          details: response?.text || 'Respuesta vacía',
        });
      }

      return res.json({
        audioBase64: foundData,
        mimeType: foundMime,
        modelUsed: effectiveModel,
      });
    }

    res.json({
      audioBase64: inlineData.data,
      mimeType: inlineData.mimeType || 'audio/wav',
      modelUsed: effectiveModel,
    });
  } catch (err: any) {
    console.error('Error in /api/tts/generate:', err);
    const parsed = parseGeminiError(err);

    res.status(parsed.isQuota ? 429 : 500).json({
      error: parsed.humanMessage,
      isQuotaExceeded: parsed.isQuota,
      retryDelaySeconds: parsed.retryDelay,
      rawMessage: parsed.raw,
      suggestedFallback: 'browser',
    });
  }
});

// AI Voice Script Improver / Preset generator
app.post('/api/tts/enhance-script', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing.' });
    }

    const { text, goal = 'natural', language = 'es' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required.' });
    }

    let prompt = `Improve and optimize the following script for Text-to-Speech audio generation.
Goal: "${goal}". Target language: ${language}.
Make it sound fluent, well-paced, phonetically natural, and punctuated for realistic breathing and cadence.
Output ONLY the enhanced text with no quotes, meta explanations, or prefixes.

Original text:
${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const enhanced = response.text?.trim() || text;
    res.json({ enhancedText: enhanced });
  } catch (err: any) {
    console.error('Error enhancing script:', err);
    res.status(500).json({ error: err.message || 'Failed to enhance script' });
  }
});

// Vite server setup for development & Express static for production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
