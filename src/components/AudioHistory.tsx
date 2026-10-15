import React from 'react';
import { GeneratedAudioItem } from '../types';
import { Play, Download, Trash2, Clock, User, Sparkles } from 'lucide-react';
import { downloadAudioFile } from '../utils/audio';

interface AudioHistoryProps {
  history: GeneratedAudioItem[];
  onSelect: (item: GeneratedAudioItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  activeId?: string;
}

export const AudioHistory: React.FC<AudioHistoryProps> = ({
  history,
  onSelect,
  onDelete,
  onClearAll,
  activeId,
}) => {
  if (history.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
        <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-medium text-slate-300">Sin grabaciones previas</h4>
        <p className="text-xs text-slate-500 mt-1">
          Las pistas de audio que generes aparecerán aquí para que puedas volver a escucharlas o descargarlas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">Historial de Audios</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400">
            {history.length}
          </span>
        </div>

        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Limpiar</span>
        </button>
      </div>

      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {history.map((item) => {
          const isActive = activeId === item.id;
          const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isActive
                  ? 'bg-slate-800 border-emerald-500/80 shadow-sm ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div
                onClick={() => onSelect(item)}
                className="flex-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                    <User className="w-2.5 h-2.5" /> {item.voice}
                  </span>
                  <span className="text-[10px] text-slate-500">{dateStr}</span>
                  {item.mode === 'dialogue' && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px]">
                      Diálogo
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-200 truncate font-normal">
                  {item.text || (item.dialogue ? `${item.dialogue.length} líneas de diálogo` : 'Audio')}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelect(item)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 transition-colors"
                  title="Cargar y reproducir"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>

                <button
                  onClick={() =>
                    downloadAudioFile(
                      item.audioBase64,
                      `audio_${item.voice}_${item.id.slice(-4)}.wav`,
                      item.mimeType
                    )
                  }
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Descargar audio"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onDelete(item.id)}
                  className="p-2 rounded-lg bg-slate-800/60 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
