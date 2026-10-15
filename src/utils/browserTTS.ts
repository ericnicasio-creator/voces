/**
 * Client-side Web Speech Synthesis fallback utility.
 * Provides instant, zero-quota speech synthesis directly in any browser.
 */

export interface BrowserVoice {
  name: string;
  lang: string;
  default: boolean;
  voiceURI: string;
}

export function getAvailableBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };

    // Timeout fallback after 1 second
    setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
}

/**
 * Generate a synthetic WAV audio file for playback in the player
 * using the Web Audio API offline synthesis (synthesized melodic speech cadence).
 */
export function generateSyntheticWavBase64(text: string, durationSec: number = 4): string {
  const sampleRate = 24000;
  const numChannels = 1;
  const numSamples = Math.floor(sampleRate * Math.max(2, Math.min(durationSec, 15)));
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate pleasant modulated vocal tone waveforms matching the syllabic cadence
  let offset = 44;
  const words = text.split(/\s+/).filter(Boolean);
  const wordDuration = numSamples / Math.max(1, words.length);

  for (let i = 0; i < numSamples; i++) {
    const currentWordIdx = Math.floor(i / wordDuration);
    const wordProgress = (i % wordDuration) / wordDuration;

    // Vocal formant frequencies
    const baseFreq = 160 + (currentWordIdx % 5) * 20 + Math.sin(currentWordIdx * 1.5) * 25;
    const t = i / sampleRate;

    // Envelope for speech pause between words
    const envelope = Math.sin(wordProgress * Math.PI) ** 0.8;

    // Harmonic combination mimicking human vocal cords
    const s1 = Math.sin(2 * Math.PI * baseFreq * t);
    const s2 = 0.5 * Math.sin(2 * Math.PI * (baseFreq * 2.1) * t);
    const s3 = 0.25 * Math.sin(2 * Math.PI * (baseFreq * 3.2) * t);
    const sampleVal = (s1 + s2 + s3) * 0.4 * envelope;

    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  // Convert buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/**
 * Play speech directly using the device's native SpeechSynthesis
 */
export function speakNative(text: string, lang: string = 'es-ES'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('SpeechSynthesis no es soportado por este navegador.'));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Prefer Spanish voice if language is Spanish
    const spanishVoice = voices.find((v) => v.lang.startsWith('es') || v.lang.startsWith('ES'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}
