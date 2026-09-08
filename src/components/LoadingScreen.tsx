import React from 'react';
import { Shield, Sparkles, RefreshCw } from 'lucide-react';

interface LoadingScreenProps {
  progress: number;
  statusText: string;
  error?: string | null;
  onRetry?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  statusText,
  error,
  onRetry,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-gradient-to-b from-ashen-950 via-slate-950 to-ashen-950 select-none">
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12)_0%,rgba(15,23,42,0)_70%)] pointer-events-none" />

      {/* Top Header Badge */}
      <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono tracking-widest uppercase shadow-[0_0_15px_rgba(34,211,238,0.2)]">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
        <span>Action RPG • 3D WebGL Engine</span>
      </div>

      {/* Center Artwork & Title */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-5 my-auto max-w-lg">
        {/* Crest Emblem with Pulsing Aura */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 border-cyan-400/60 bg-gradient-to-br from-cyan-950/80 via-ashen-900/90 to-ashen-950 p-4 shadow-[0_0_40px_rgba(34,211,238,0.35)] flex items-center justify-center">
            <img
              src="/ashen-crest.svg"
              alt="Quest For Power Crest"
              className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
              onError={e => {
                // Fallback to icon if SVG fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Shield className="w-14 h-14 text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)] hidden only:block" />
          </div>
        </div>

        {/* Game Title */}
        <div className="space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-black font-medieval tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-cyan-200 to-cyan-400 drop-shadow-[0_4px_16px_rgba(34,211,238,0.4)] uppercase">
            QUEST FOR POWER
          </h1>
          <p className="text-xs sm:text-sm font-serif italic text-ashen-300 tracking-wider">
            Echoes of the Ashen Realm
          </p>
        </div>

        {/* Error or Progress Section */}
        {error ? (
          <div className="w-full max-w-md p-4 rounded-xl border border-red-500/50 bg-red-950/60 text-red-200 space-y-3 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-fade-in">
            <p className="text-xs font-mono font-bold text-red-300">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-medieval font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Asset Loading
              </button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-2.5">
            {/* Progress Bar Container */}
            <div className="w-full h-3.5 bg-ashen-950 rounded-full border border-cyan-500/40 p-0.5 shadow-inner overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-cyan-600 via-cyan-400 to-amber-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>

            {/* Percentage & Status Label */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-ashen-300 truncate max-w-[240px] text-left">
                {statusText}
              </span>
              <span className="font-bold text-cyan-300">{clampedProgress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Commercial Tips */}
      <div className="relative z-10 text-center space-y-1">
        <p className="text-[11px] font-sans text-ashen-400">
          Tip: Tap and drag on the upper half of the screen to orbit the camera view.
        </p>
        <p className="text-[10px] font-mono text-ashen-500">
          Optimized for Mobile Touch & High-Performance WebGL
        </p>
      </div>
    </div>
  );
};
