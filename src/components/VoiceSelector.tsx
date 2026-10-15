import React from 'react';
import { VoiceOption } from '../types';
import { Sparkles, Check, User } from 'lucide-react';

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  voices: VoiceOption[];
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onSelectVoice,
  voices,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400" />
          <span>Voz del Modelo (Prebuilt Voice)</span>
        </label>
        <span className="text-xs text-slate-400">5 voces optimizadas de Gemini</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {voices.map((voice) => {
          const isSelected = selectedVoice === voice.id;

          return (
            <button
              key={voice.id}
              type="button"
              onClick={() => onSelectVoice(voice.id)}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {voice.name[0]}
                    </div>
                    <span className="font-semibold text-slate-100 text-sm">{voice.name}</span>
                  </div>

                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-medium text-emerald-400/90 mb-1">
                  {voice.gender} • {voice.tone}
                </div>

                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  {voice.description}
                </p>
              </div>

              {isSelected && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <Sparkles className="w-3 h-3" />
                  <span>Voz seleccionada</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
