import React from 'react';
import { DialogueLine } from '../types';
import { Plus, Trash2, Users, Sparkles, MessageSquare } from 'lucide-react';

interface DialogueEditorProps {
  lines: DialogueLine[];
  onChange: (lines: DialogueLine[]) => void;
  availableVoices: string[];
}

export const DialogueEditor: React.FC<DialogueEditorProps> = ({
  lines,
  onChange,
  availableVoices,
}) => {
  const addLine = () => {
    const lastSpeaker = lines[lines.length - 1]?.speaker;
    const nextSpeaker = lastSpeaker === 'Alex' ? 'Sam' : 'Alex';
    const nextVoice = nextSpeaker === 'Alex' ? 'Puck' : 'Kore';

    const newLine: DialogueLine = {
      id: String(Date.now()),
      speaker: nextSpeaker,
      voice: nextVoice,
      text: '',
      style: nextSpeaker === 'Alex' ? 'Enthusiastic podcast host' : 'Curious, articulate co-host',
    };

    onChange([...lines, newLine]);
  };

  const updateLine = (index: number, updates: Partial<DialogueLine>) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    onChange(lines.filter((_, i) => i !== index));
  };

  const insertTag = (index: number, tag: string) => {
    const current = lines[index].text;
    updateLine(index, { text: current ? `${current} ${tag} ` : `${tag} ` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Guión Multi-Hablante (Dual-Speaker Podcast / Dialogue)
          </h3>
        </div>
        <span className="text-xs text-slate-400">Modelo: gemini-3.8-flash-tts</span>
      </div>

      <div className="space-y-3">
        {lines.map((line, idx) => {
          const isSpeaker1 = line.speaker === 'Alex' || idx % 2 === 0;

          return (
            <div
              key={line.id || idx}
              className={`p-4 rounded-xl border transition-all ${
                isSpeaker1
                  ? 'bg-slate-900/80 border-cyan-800/40'
                  : 'bg-slate-900/80 border-purple-800/40'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isSpeaker1 ? 'bg-cyan-500 text-slate-950' : 'bg-purple-500 text-white'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Speaker name */}
                  <input
                    type="text"
                    value={line.speaker}
                    onChange={(e) => updateLine(idx, { speaker: e.target.value })}
                    className="w-24 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Nombre"
                  />

                  {/* Voice Selector */}
                  <select
                    value={line.voice}
                    onChange={(e) => updateLine(idx, { voice: e.target.value })}
                    className="bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    {availableVoices.map((v) => (
                      <option key={v} value={v}>
                        Voz: {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speech Style input */}
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <input
                    type="text"
                    value={line.style || ''}
                    onChange={(e) => updateLine(idx, { style: e.target.value })}
                    placeholder="Estilo (ej: Entusiasta, cómico...)"
                    className="w-full bg-slate-800/60 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Remove button */}
                {lines.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Eliminar línea"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Text Area */}
              <div className="relative">
                <textarea
                  rows={2}
                  value={line.text}
                  onChange={(e) => updateLine(idx, { text: e.target.value })}
                  placeholder={`Diálogo de ${line.speaker}...`}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />

                {/* Vocal Bursts & Backchanneling quick inserts */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Insertar matices:
                  </span>
                  {['<laugh>', '<breath>', '<gasp>', '|yeah|', '|mhm|'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTag(idx, tag)}
                      className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 border border-slate-700/60 transition-colors cursor-pointer"
                      title={`Insertar ${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="w-full py-2.5 border border-dashed border-slate-700 hover:border-slate-500 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800/40 transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Agregar siguiente intervención</span>
      </button>
    </div>
  );
};
