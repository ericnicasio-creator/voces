export type GenerationMode = 'single' | 'prompt' | 'dialogue';

export interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  tone: string;
  description: string;
  color: string;
}

export interface DialogueLine {
  id: string;
  speaker: string;
  voice: string;
  text: string;
  style?: string;
}

export interface GeneratedAudioItem {
  id: string;
  timestamp: number;
  text: string;
  voice: string;
  style: string;
  model: string;
  mode: GenerationMode;
  audioBase64: string;
  mimeType: string;
  audioUrl?: string;
  duration?: number;
  dialogue?: DialogueLine[];
}

export interface StylePreset {
  id: string;
  label: string;
  style: string;
  iconName: string;
  category?: 'cobranza' | 'general';
  description?: string;
  badge?: string;
}

export interface ScriptPreset {
  id: string;
  title: string;
  category: string;
  text: string;
  style: string;
  voice: string;
  mode: GenerationMode;
  dialogue?: DialogueLine[];
}
