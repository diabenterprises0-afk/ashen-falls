import React from 'react';
import { RotateCcw, Skull } from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

interface GameOverModalProps {
  score: number;
  onRespawn: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ score, onRespawn }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md p-8 bg-ashen-950/95 border border-red-900/60 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center text-ashen-100 font-sans space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-950/60 border border-red-500/60 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
          <Skull className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold font-medieval text-red-500 tracking-widest uppercase">
            YOU DIED
          </h2>
          <p className="text-xs text-ashen-400">
            The ashen abyss claims another knight. Return to the brazier and rise once more.
          </p>
        </div>

        <div className="p-3 bg-ashen-900/80 rounded-xl border border-ashen-800 text-xs font-mono text-cyanGlow-300">
          FINAL SCORE: {score}
        </div>

        <button
          onClick={() => {
            triggerHaptic(40);
            onRespawn();
          }}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-amber-600 text-white font-bold font-medieval tracking-widest text-sm shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-110"
        >
          <RotateCcw className="w-5 h-5" />
          RISE FROM THE ASHES
        </button>
      </div>
    </div>
  );
};
