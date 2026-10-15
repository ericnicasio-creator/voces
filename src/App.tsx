/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  Code2,
  Play,
  RotateCcw,
  Sliders,
  History,
  AlertCircle,
  FileText,
  Radio,
  Users,
  Zap,
  Wand2,
  Terminal,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  Scale,
  Handshake,
  CheckCircle2,
  PhoneCall,
} from 'lucide-react';
import { AudioPlayer } from './components/AudioPlayer';
import { VoiceSelector } from './components/VoiceSelector';
import { DialogueEditor } from './components/DialogueEditor';
import { CodeExportModal } from './components/CodeExportModal';
import { AudioHistory } from './components/AudioHistory';
import { DEFAULT_VOICES, STYLE_PRESETS, SCRIPT_PRESETS } from './data/presets';
import {
  DialogueLine,
  GeneratedAudioItem,
  GenerationMode,
  VoiceOption,
} from './types';

export default function App() {
  // Mode selection
  const [mode, setMode] = useState<GenerationMode>('single');

  // Single / prompt text
  const [text, setText] = useState<string>(
    'Estimado cliente, le recordamos cordialmente que su fecha límite de pago es este próximo viernes. Mantener su crédito al corriente le permite conservar su línea disponible y proteger su historial crediticio. Puede realizar su pago en línea desde nuestra aplicación o mediante transferencia SPEI. Agradecemos su puntualidad y confianza.'
  );
  const [voice, setVoice] = useState<string>('Kore');
  const [style, setStyle] = useState<string>(
    'Cálido, respetuoso y cordial, recordando amablemente la próxima fecha límite de pago antes del vencimiento'
  );
  const [customStyle, setCustomStyle] = useState<string>('');
  const [styleCategory, setStyleCategory] = useState<'cobranza' | 'general'>('cobranza');
  const [promptPrefix, setPromptPrefix] = useState<string>(
    'Lee el siguiente texto exactamente como está escrito, con una voz clara y natural'
  );

  // Model selection: gemini-3.8-flash-tts (default flagship), gemini-3.8-flash-lite-tts, or browser
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash-tts');

  // Dialogue state
  const [dialogue, setDialogue] = useState<DialogueLine[]>(
    SCRIPT_PRESETS.find((p) => p.mode === 'dialogue')?.dialogue || [
      {
        id: '1',
        speaker: 'Alex',
        voice: 'Puck',
        text: '¡Bienvenidos a nuestro podcast generado con Google GenAI! <breath> Hoy exploramos la síntesis de voz.',
        style: 'Enthusiastic podcast host',
      },
      {
        id: '2',
        speaker: 'Sam',
        voice: 'Kore',
        text: '¡Así es Alex! |yeah| La calidad y naturalidad del audio son asombrosas.',
        style: 'Curious, articulate co-host',
      },
    ]
  );

  // Audio generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    isQuota: boolean;
    retryDelay?: number;
    raw?: string;
  } | null>(null);

  // Current active audio
  const [currentAudio, setCurrentAudio] = useState<{
    base64: string;
    mimeType: string;
    title: string;
    subtitle: string;
    id: string;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<GeneratedAudioItem[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_tts_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI Modals & Sidebars
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showRawError, setShowRawError] = useState<boolean>(false);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gemini_tts_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not persist history to localStorage:', e);
    }
  }, [history]);

  // Generate with native browser speech synthesis (unlimited, zero-cost fallback)
  const handleGenerateBrowserVoice = async () => {
    if (!text.trim()) {
      setErrorDetails({
        message: 'Por favor ingresa un texto para convertir a audio.',
        isQuota: false,
      });
      return;
    }

    setIsGenerating(true);
    setErrorDetails(null);

    try {
      const { generateSyntheticWavBase64, speakNative } = await import('./utils/browserTTS');
      
      // Start browser native speech
      speakNative(text.trim(), 'es-ES').catch((e) => console.warn('SpeechSynthesis ended or cancelled:', e));

      // Create audio waveform for the player
      const wordsCount = text.trim().split(/\s+/).length;
      const estimatedDuration = Math.max(2, Math.round(wordsCount / 2.5));
      const wavBase64 = generateSyntheticWavBase64(text.trim(), estimatedDuration);

      const newId = `audio_browser_${Date.now()}`;
      setCurrentAudio({
        base64: wavBase64,
        mimeType: 'audio/wav',
        title: 'Audio Generado (Sintetizador del Navegador)',
        subtitle: 'Voz del Dispositivo • Ilimitado y Sin Restricción de Cuota',
        id: newId,
      });

      const historyItem: GeneratedAudioItem = {
        id: newId,
        timestamp: Date.now(),
        text: text.trim(),
        voice: 'Voz del Navegador',
        style: 'Nativo',
        model: 'Web Speech API',
        mode: 'single',
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
      };

      setHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error('Error generating browser voice:', err);
      setErrorDetails({
        message: err.message || 'Error al usar la voz del navegador',
        isQuota: false,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle TTS Generation with Gemini
  const handleGenerate = async (overrideModel?: string) => {
    const targetModel = overrideModel || selectedModel;

    if (targetModel === 'browser') {
      await handleGenerateBrowserVoice();
      return;
    }

    if (mode === 'single' || mode === 'prompt') {
      if (!text.trim()) {
        setErrorDetails({
          message: 'Por favor ingresa un texto para convertir a audio.',
          isQuota: false,
        });
        return;
      }
    }

    setErrorDetails(null);
    setIsGenerating(true);

    try {
      const effectiveStyle = customStyle.trim() || style;
      const effectiveModel =
        mode === 'dialogue'
          ? 'gemini-3.8-flash-tts'
          : targetModel;

      const payload = {
        text: text.trim(),
        voice,
        style: effectiveStyle,
        model: effectiveModel,
        mode,
        dialogue,
        promptCustomPrefix: promptPrefix.trim(),
      };

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const isQuota = data.isQuotaExceeded || res.status === 429 || String(data.error || '').includes('429');
        setErrorDetails({
          message: data.error || 'Error al generar el audio',
          isQuota,
          retryDelay: data.retryDelaySeconds,
          raw: data.rawMessage || JSON.stringify(data),
        });
        return;
      }

      const newId = `audio_${Date.now()}`;
      const title =
        mode === 'dialogue'
          ? `Diálogo: ${dialogue[0]?.speaker} & ${dialogue[1]?.speaker}`
          : `Audio generado (${voice})`;
      const subtitle =
        mode === 'dialogue'
          ? `${dialogue.length} intervenciones • gemini-3.8-flash-tts`
          : `${effectiveStyle} • ${data.modelUsed || effectiveModel}`;

      setCurrentAudio({
        base64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        title,
        subtitle,
        id: newId,
      });

      // Add to history
      const historyItem: GeneratedAudioItem = {
        id: newId,
        timestamp: Date.now(),
        text: mode === 'single' || mode === 'prompt' ? text : 'Guión de podcast',
        voice: mode === 'dialogue' ? 'Multi-Speaker' : voice,
        style: effectiveStyle,
        model: data.modelUsed || effectiveModel,
        mode,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        dialogue: mode === 'dialogue' ? dialogue : undefined,
      };

      setHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error(err);
      const isQuota = String(err.message || '').includes('429') || String(err.message || '').includes('quota');
      setErrorDetails({
        message: err.message || 'No se pudo generar el audio.',
        isQuota,
        raw: String(err),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Enhance script with AI
  const handleEnhanceScript = async () => {
    if (!text.trim()) return;
    setIsEnhancing(true);
    setErrorDetails(null);

    try {
      const res = await fetch('/api/tts/enhance-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          goal: customStyle || style || 'natural and fluent speech',
          language: 'es',
        }),
      });
      const data = await res.json();
      if (data.enhancedText) {
        setText(data.enhancedText);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Apply script preset
  const applyPreset = (preset: (typeof SCRIPT_PRESETS)[0]) => {
    setMode(preset.mode);
    if (preset.mode === 'dialogue' && preset.dialogue) {
      setDialogue(preset.dialogue);
    } else {
      setText(preset.text);
      setVoice(preset.voice);
      setStyle(preset.style);
      setCustomStyle('');
    }
  };

  // Select history item
  const handleSelectHistory = (item: GeneratedAudioItem) => {
    setCurrentAudio({
      base64: item.audioBase64,
      mimeType: item.mimeType,
      title:
        item.mode === 'dialogue'
          ? 'Diálogo Replay'
          : `Audio generado (${item.voice})`,
      subtitle: `${item.style} • ${item.model}`,
      id: item.id,
    });

    if (item.mode === 'dialogue' && item.dialogue) {
      setMode('dialogue');
      setDialogue(item.dialogue);
    } else {
      setMode(item.mode);
      setText(item.text);
      setVoice(item.voice);
      setStyle(item.style);
    }
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [text, voice, style, customStyle, mode, dialogue, promptPrefix]);

  const activeModel =
    mode === 'dialogue'
      ? 'gemini-3.8-flash-tts'
      : selectedModel;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-slate-100 tracking-tight">
                  Google GenAI Audio Studio
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-medium">
                  TTS SDK 2.4+
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Generador de voz, locución y audio realista con Google Gemini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Python Code button */}
            <button
              onClick={() => setShowCodeModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Ver y exportar código Python / Node.js"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Código Python</span>
              <span className="sm:hidden">Código</span>
            </button>

            {/* History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                showHistory
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900 border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
              title="Historial de grabaciones"
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">Historial</span>
              {history.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center font-mono">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Audio Studio Controls */}
        <div className={`space-y-6 ${showHistory ? 'lg:col-span-8' : 'lg:col-span-8'}`}>
          {/* Mode Selector Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  mode === 'single'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Estudio de Voz (TTS)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('prompt')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  mode === 'prompt'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Script Directo (Python)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('dialogue')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  mode === 'dialogue'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Podcast / Diálogo (2 Voces)</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400 px-3 hidden sm:block">
              {activeModel}
            </div>
          </div>

          {/* Model Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-300">Motor de Voz:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.8-flash-tts')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedModel === 'gemini-3.8-flash-tts'
                    ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-semibold shadow-sm'
                    : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Gemini 3.8 Flash TTS (Recomendado)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.8-flash-lite-tts')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedModel === 'gemini-3.8-flash-lite-tts'
                    ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300 font-semibold shadow-sm'
                    : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Gemini Flash Lite TTS</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('browser')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedModel === 'browser'
                    ? 'bg-purple-500/20 border border-purple-500 text-purple-300 font-semibold shadow-sm'
                    : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Sintetizador de voz del navegador (100% gratis e ilimitado)"
              >
                <Volume2 className="w-3 h-3 text-purple-400" />
                <span>Voz del Navegador (Sin Límite)</span>
              </button>
            </div>
          </div>

          {/* Quick Presets Pills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Plantillas Rápidas:
              </span>
              <span>Haz clic para cargar un ejemplo</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {SCRIPT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300 hover:text-white text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt / Text Editor Section */}
          {mode !== 'dialogue' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative">
              {/* Optional Custom Prompt Prefix when in Python direct mode */}
              {mode === 'prompt' && (
                <div className="mb-4 pb-4 border-b border-slate-800">
                  <label className="text-xs font-semibold text-cyan-400 mb-1.5 flex items-center justify-between">
                    <span>Instrucción / Prompt del Sistema</span>
                    <span className="text-[10px] text-slate-400">
                      Coincide con tu snippet en Python
                    </span>
                  </label>
                  <input
                    type="text"
                    value={promptPrefix}
                    onChange={(e) => setPromptPrefix(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-500"
                    placeholder="Lee el siguiente texto exactamente como está escrito..."
                  />
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Texto a Convertir en Audio</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEnhanceScript}
                    disabled={isEnhancing || !text.trim()}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Optimizar el guión con IA para locución natural"
                  >
                    <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                    <span>{isEnhancing ? 'Optimizando...' : 'Mejorar con IA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs"
                    title="Limpiar texto"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe o pega aquí el texto que deseas transformar en una locución realista..."
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-y leading-relaxed"
              />

              {/* Word & Character count */}
              <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span>{text.trim().length} caracteres</span>
                  <span>•</span>
                  <span>
                    {text.trim().length ? text.trim().split(/\s+/).length : 0} palabras
                  </span>
                  <span>•</span>
                  <span>
                    ~
                    {Math.max(
                      1,
                      Math.round(
                        (text.trim().length ? text.trim().split(/\s+/).length : 0) / 2.5
                      )
                    )}{' '}
                    seg de audio estimado
                  </span>
                </div>
                <span className="hidden sm:inline font-mono text-[11px] text-slate-500">
                  Ctrl + Enter para generar
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <DialogueEditor
                lines={dialogue}
                onChange={setDialogue}
                availableVoices={DEFAULT_VOICES.map((v) => v.name)}
              />
            </div>
          )}

          {/* Voice Selector Grid */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <VoiceSelector
              selectedVoice={voice}
              onSelectVoice={setVoice}
              voices={DEFAULT_VOICES}
            />
          </div>

          {/* Tone & Speech Style Section (for single mode) */}
          {mode !== 'dialogue' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Estilo y Tono de Locución (Speech Metadata)</span>
                </label>

                {/* Category Switcher */}
                <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setStyleCategory('cobranza')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      styleCategory === 'cobranza'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Especialidad Cobranza (7)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStyleCategory('general')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      styleCategory === 'general'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Generales (4)</span>
                  </button>
                </div>
              </div>

              {/* Render Cobranza Specialized Cards */}
              {styleCategory === 'cobranza' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {STYLE_PRESETS.filter((p) => p.category === 'cobranza').map((p) => {
                    const isSelected = style === p.style && !customStyle;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setStyle(p.style);
                          setCustomStyle('');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-800/90 border-emerald-500 text-slate-100 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-xs text-slate-100">{p.label}</span>
                            {p.badge && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  isSelected
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700/60'
                                }`}
                              >
                                {p.badge}
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-[11px] text-slate-400 leading-snug">{p.description}</p>
                          )}
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 truncate max-w-[240px]">
                            {p.style}
                          </span>
                          {isSelected && (
                            <span className="text-emerald-400 font-medium shrink-0 ml-1">
                              ✓ Activo
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* General Style Chips */
                <div className="flex flex-wrap items-center gap-2">
                  {STYLE_PRESETS.filter((p) => p.category === 'general').map((p) => {
                    const isSelected = style === p.style && !customStyle;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setStyle(p.style);
                          setCustomStyle('');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom style free-form input */}
              <div className="pt-1">
                <input
                  type="text"
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                  placeholder="O personaliza el tono de cobranza (ej: 'Gestor bancario comprensivo pero firme con tono corporativo')..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Error Message banner with intelligent Quota Handling */}
          {errorDetails && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-rose-500/40 text-slate-200 text-xs shadow-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-rose-300 text-sm">
                      {errorDetails.isQuota
                        ? 'Límite de Cuota Gratuita Alcanzado (Error 429)'
                        : 'Error en la Generación de Audio'}
                    </h4>
                    {errorDetails.retryDelay ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-mono">
                        Se restablece en ~{Math.ceil(errorDetails.retryDelay / 60)} min
                      </span>
                    ) : null}
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    {errorDetails.isQuota
                      ? 'El plan gratuito de Google AI Studio para este modelo permite un límite diario de 10 solicitudes. ¡Puedes seguir generando audio de inmediato cambiando al modelo insignia o usando la voz del navegador!'
                      : errorDetails.message}
                  </p>
                </div>
              </div>

              {/* Instant recovery actions */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
                {selectedModel !== 'gemini-3.8-flash-tts' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModel('gemini-3.8-flash-tts');
                      handleGenerate('gemini-3.8-flash-tts');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cambiar a Gemini 3.8 Flash TTS y Reintentar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleGenerateBrowserVoice}
                  className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Reproducir con Voz del Navegador (Sin Límite)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRawError(!showRawError)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors ml-auto flex items-center gap-1 cursor-pointer"
                >
                  <span>Detalles técnicos</span>
                  {showRawError ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showRawError && errorDetails.raw && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-36">
                  {errorDetails.raw}
                </div>
              )}
            </div>
          )}

          {/* Generate Action Button */}
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-slate-950 font-bold text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Generando audio con Gemini {activeModel}...</span>
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5" />
                <span>Generar Audio Ahora</span>
              </>
            )}
          </button>

          {/* Live Audio Player Result */}
          {currentAudio && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <AudioPlayer
                audioBase64={currentAudio.base64}
                mimeType={currentAudio.mimeType}
                title={currentAudio.title}
                subtitle={currentAudio.subtitle}
              />
            </div>
          )}
        </div>

        {/* Right Column: Code Snippet Sync & History */}
        <div className={`space-y-6 ${showHistory ? 'lg:col-span-4' : 'lg:col-span-4'}`}>
          {/* Active Python Snippet Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">
                    Tu Script en Python (Sincronizado)
                  </h3>
                  <p className="text-[10px] text-slate-400">Google GenAI SDK Oficial</p>
                </div>
              </div>

              <button
                onClick={() => setShowCodeModal(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Expandir</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Este código se actualiza automáticamente con tu texto y la voz seleccionada (
              <span className="text-emerald-400 font-medium">{voice}</span>):
            </p>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 overflow-hidden">
              <pre className="text-[11px] font-mono text-emerald-400/90 overflow-x-auto whitespace-pre leading-relaxed max-h-56 scrollbar-thin">
                <code>
{`from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="${activeModel}",
    contents="${text.slice(0, 40).replace(/"/g, '\\"')}${text.length > 40 ? '...' : ''}",
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

# Guarda el audio resultante
with open("audio_generado.wav", "wb") as f:
    f.write(response.candidates[0].content.parts[0].inline_data.data)`}
                </code>
              </pre>
            </div>

            <button
              onClick={() => setShowCodeModal(true)}
              className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ver código completo (Python, Node.js, cURL)</span>
            </button>
          </div>

          {/* Quick Info & Tips */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Consejos de Locución con Gemini</span>
            </h4>
            <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Puntuación expresiva:</strong> Usa puntos suspensivos (...) y signos de
                  interrogación para añadir pausas de respiración naturales.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Formato de Audio:</strong> Las respuestas de Gemini 3.8 devuelven archivos WAV
                  completos a 24kHz y 16-bit mono.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Expresiones humanas:</strong> En modo diálogo puedes añadir etiquetas como{' '}
                  <code className="text-cyan-300 font-mono text-[10px]">&lt;breath&gt;</code>,{' '}
                  <code className="text-cyan-300 font-mono text-[10px]">&lt;laugh&gt;</code> o{' '}
                  <code className="text-cyan-300 font-mono text-[10px]">|yeah|</code>.
                </span>
              </li>
            </ul>
          </div>

          {/* Audio History Drawer / Section */}
          <AudioHistory
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClearAll={handleClearHistory}
            activeId={currentAudio?.id}
          />
        </div>
      </main>

      {/* Code Export Fullscreen Modal */}
      <CodeExportModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        text={text}
        voice={voice}
        style={customStyle.trim() || style}
        model={activeModel}
        mode={mode}
        dialogue={dialogue}
        promptCustomPrefix={promptPrefix}
      />
    </div>
  );
}
