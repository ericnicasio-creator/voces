import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Check,
  Radio,
} from 'lucide-react';
import { downloadAudioFile, formatTime } from '../utils/audio';

interface AudioPlayerProps {
  audioBase64: string;
  mimeType: string;
  title?: string;
  subtitle?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  mimeType = 'audio/wav',
  title = 'Audio Generado',
  subtitle,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [copied, setCopied] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string>('');

  // Prepare audio source Blob whenever base64 changes
  useEffect(() => {
    if (!audioBase64) return;
    try {
      const binaryString = atob(audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setAudioSrc(url);
      setIsPlaying(false);
      setCurrentTime(0);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error('Error parsing audio base64:', e);
    }
  }, [audioBase64, mimeType]);

  // Setup Web Audio API Analyzer for live waveform canvas
  const setupAudioContext = () => {
    if (audioContextRef.current || !audioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
    } catch (e) {
      console.warn('Web Audio API not fully available or already bound:', e);
    }
  };

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (analyserRef.current && isPlaying) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (height * 0.85);

        // Gradient styling: cyan to violet to emerald
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(0.6, '#6366f1');
        gradient.addColorStop(1, '#10b981');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, Math.max(2, barWidth - 2), barHeight, 3);
        ctx.fill();

        x += barWidth;
      }
    } else {
      // Resting subtle wave placeholder
      const bars = 48;
      const barWidth = width / bars;
      for (let i = 0; i < bars; i++) {
        const restingHeight = Math.sin((i / bars) * Math.PI) * 16 + 6;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.beginPath();
        ctx.roundRect(i * barWidth + 2, height / 2 - restingHeight / 2, barWidth - 4, restingHeight, 2);
        ctx.fill();
      }
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    setupAudioContext();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Play interrupted:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = () => {
    const ext = mimeType.includes('mp3') ? 'mp3' : 'wav';
    downloadAudioFile(audioBase64, `gemini_audio_${Date.now()}.${ext}`, mimeType);
  };

  const handleCopyBase64 = async () => {
    try {
      const dataUri = `data:${mimeType};base64,${audioBase64}`;
      await navigator.clipboard.writeText(dataUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Background glow accent */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="auto"
      />

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyBase64}
            title="Copiar Data URI de audio"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? '¡Copiado!' : 'Data URI'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all hover:scale-102 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar {mimeType.includes('mp3') ? '.MP3' : '.WAV'}</span>
          </button>
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="mb-4 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={640}
          height={80}
          className="w-full h-20 rounded"
        />
      </div>

      {/* Time & Progress Scrub Bar */}
      <div className="space-y-1.5 mb-5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
        />
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons & Sliders */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-3">
          {/* Restart */}
          <button
            onClick={handleReset}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Reiniciar audio"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Primary Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/25 transition-transform active:scale-95 cursor-pointer font-bold"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 text-xs">
            {[0.8, 1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  playbackRate === rate
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
};
