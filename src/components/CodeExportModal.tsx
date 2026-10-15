import React, { useState } from 'react';
import { Copy, Check, Download, Code2, Terminal, FileCode2, X } from 'lucide-react';
import { generatePythonCode, generateNodeCode } from '../utils/audio';
import { DialogueLine, GenerationMode } from '../types';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  voice: string;
  style: string;
  model: string;
  mode: GenerationMode;
  dialogue?: DialogueLine[];
  promptCustomPrefix?: string;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  isOpen,
  onClose,
  text,
  voice,
  style,
  model,
  mode,
  dialogue,
  promptCustomPrefix,
}) => {
  const [activeTab, setActiveTab] = useState<'python' | 'node' | 'curl'>('python');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonCode = generatePythonCode({
    text,
    voice,
    style,
    model,
    mode,
    dialogue,
    promptCustomPrefix,
  });

  const nodeCode = generateNodeCode({
    text,
    voice,
    style,
    model,
    mode,
  });

  const curlCode = `curl -X POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$GEMINI_API_KEY \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{ "text": ${JSON.stringify(text)} }]
    }],
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": { "voiceName": "${voice}" }
        }
      }
    }
  }' > response.json`;

  const currentCode =
    activeTab === 'python' ? pythonCode : activeTab === 'node' ? nodeCode : curlCode;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    const ext = activeTab === 'python' ? 'py' : activeTab === 'node' ? 'ts' : 'sh';
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini_tts_${activeTab}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Código de Integración</h3>
              <p className="text-xs text-slate-400">
                Usa este código en tu entorno local con el nuevo Google GenAI SDK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 bg-slate-950/40 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'python'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              <span>Python (google-genai)</span>
            </button>
            <button
              onClick={() => setActiveTab('node')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'node'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              <span>Node.js / TS (@google/genai)</span>
            </button>
            <button
              onClick={() => setActiveTab('curl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'curl'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>cURL</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar archivo de código"
            >
              <Download className="w-4 h-4" />
              <span>Descargar</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-950">
          <pre className="text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre font-normal">
            <code>{currentCode}</code>
          </pre>
        </div>

        {/* Instructions Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>
            {activeTab === 'python'
              ? 'Instala en terminal: pip install google-genai'
              : activeTab === 'node'
              ? 'Instala en terminal: npm install @google/genai'
              : 'Requiere la variable GEMINI_API_KEY en tu terminal'}
          </span>
          <span className="text-slate-500">Modelo: {model}</span>
        </div>
      </div>
    </div>
  );
};
