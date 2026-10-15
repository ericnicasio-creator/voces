import { DialogueLine, GenerationMode } from '../types';

/**
 * Converts a base64 encoded audio string to a Blob URL for playback.
 */
export function base64ToAudioUrl(base64Data: string, mimeType: string = 'audio/wav'): string {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Trigger a download of the audio file in browser
 */
export function downloadAudioFile(
  base64Data: string,
  filename: string = 'audio_generado.mp3',
  mimeType: string = 'audio/wav'
) {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Format seconds into mm:ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generates ready-to-run Python script matching the user's snippet and current settings
 */
export function generatePythonCode(options: {
  text: string;
  voice: string;
  style: string;
  model: string;
  mode: GenerationMode;
  dialogue?: DialogueLine[];
  promptCustomPrefix?: string;
}): string {
  const { text, voice, style, model, mode, dialogue, promptCustomPrefix } = options;

  if (mode === 'dialogue') {
    const speaker1 = dialogue?.[0]?.speaker || 'Alex';
    const speaker2 = dialogue?.[1]?.speaker || 'Sam';
    const voice1 = dialogue?.[0]?.voice || 'Puck';
    const voice2 = dialogue?.[1]?.voice || 'Kore';

    const partsCode = (dialogue || [])
      .map(
        (d) => `        types.Part.from_text(
            text="${d.speaker}: ${d.text.replace(/"/g, '\\"')}",
            speech_metadata=types.SpeechMetadata(
                speaker="${d.speaker}",
                style="${(d.style || 'Natural').replace(/"/g, '\\"')}"
            )
        )`
      )
      .join(',\n');

    return `import os
from google import genai
from google.genai import types

# 1. Configura tu cliente de Google GenAI
# Asegúrate de haber definido tu variable de entorno:
# export GEMINI_API_KEY="tu_api_key_aqui"
client = genai.Client()

# 2. Configura el diálogo multi-hablante
response = client.models.generate_content(
    model="gemini-3.8-flash-tts",
    contents=[
${partsCode}
    ],
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="${speaker1}",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="${voice1}")
                        )
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="${speaker2}",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="${voice2}")
                        )
                    )
                ]
            )
        )
    )
)

# 3. Guarda el audio generado
output_filename = "dialogo_podcast.wav"
with open(output_filename, "wb") as f:
    f.write(response.candidates[0].content.parts[0].inline_data.data)

print(f"¡Diálogo guardado exitosamente como '{output_filename}'!")
`;
  }

  if (mode === 'prompt') {
    const prefix = promptCustomPrefix || 'Lee el siguiente texto exactamente como está escrito, con una voz clara y natural';
    return `import os
from google import genai
from google.genai import types

# 1. Configura tu cliente con tu API Key
# Asegúrate de haber ejecutado en tu terminal:
# export GEMINI_API_KEY="tu_api_key_aqui"
client = genai.Client()

# 2. Define el texto que quieres convertir a audio
texto_entrada = """${text.replace(/"""/g, '\\"\\"\\"')}"""

# 3. Realiza la solicitud al modelo solicitando salida de audio
response = client.models.generate_content(
    model="${model || 'gemini-3.8-flash-lite-tts'}",
    contents=f"${prefix}: {texto_entrada}",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="${voice || 'Kore'}"
                )
            )
        )
    ),
)

# 4. Guarda el archivo de audio generado
output_filename = "audio_generado.wav"
with open(output_filename, "wb") as f:
    f.write(response.candidates[0].content.parts[0].inline_data.data)

print(f"¡Audio guardado exitosamente como '{output_filename}'!")
`;
  }

  // Standard TTS mode with SpeechMetadata & PrebuiltVoiceConfig
  return `import os
from google import genai
from google.genai import types

# 1. Inicializa el cliente de Google GenAI
# Configura tu clave en terminal: export GEMINI_API_KEY="tu_api_key"
client = genai.Client()

# 2. Define el texto y el estilo de locución
texto = """${text.replace(/"""/g, '\\"\\"\\"')}"""
estilo = "${style || 'Clear and natural'}"

# 3. Genera el audio usando ${model}
response = client.models.generate_content(
    model="${model}",
    contents=[
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text=texto,
                    speech_metadata=types.SpeechMetadata(
                        style=estilo
                    )
                )
            ]
        )
    ],
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="${voice}"
                )
            )
        )
    )
)

# 4. Guarda el archivo de audio (.wav por defecto en llamada unaria)
output_filename = "audio_gemini.wav"
audio_bytes = response.candidates[0].content.parts[0].inline_data.data
with open(output_filename, "wb") as f:
    f.write(audio_bytes)

print(f"¡Audio generado con éxito en '{output_filename}' con la voz '${voice}'!")
`;
}

/**
 * Generates ready-to-run Node.js / TypeScript code
 */
export function generateNodeCode(options: {
  text: string;
  voice: string;
  style: string;
  model: string;
  mode: GenerationMode;
}): string {
  const { text, voice, style, model } = options;

  return `import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";

// 1. Inicializa con tu variable de entorno
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function main() {
  const response = await ai.models.generateContent({
    model: "${model}",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: ${JSON.stringify(text)},
            speechMetadata: {
              style: "${style || 'Clear and natural'}",
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "${voice}" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    const buffer = Buffer.from(base64Audio, "base64");
    await fs.writeFile("audio_gemini.wav", buffer);
    console.log("¡Audio guardado exitosamente como audio_gemini.wav!");
  }
}

main().catch(console.error);
`;
}
