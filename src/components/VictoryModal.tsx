import React from 'react';
import { Award, RotateCcw, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

interface VictoryModalProps {
  score: number;
  onPlayAgain: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ score, onPlayAgain }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg p-8 bg-ashen-950/95 border border-cyanGlow-500/60 rounded-2xl shadow-[0_0_60px_rgba(34,211,238,0.3)] text-center text-ashen-100 font-sans space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-cyanGlow-500/20 border-2 border-cyanGlow-400 flex items-center justify-center text-cyanGlow-300 shadow-[0_0_25px_rgba(34,211,238,0.5)] animate-pulse">
          <Award className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold font-medieval text-cyanGlow-300 tracking-widest uppercase">
            VICTORY ACHIEVED
          </h2>
          <p className="text-sm font-medieval text-yellow-300">
            Inquisitor Malakor has fallen. The kingdom of Aethelgard is freed from the Abyss.
          </p>
          <p className="text-xs text-ashen-400 mt-2">
            Your mastery of calibrated combat, dodging, and runic blades has forged a new legend.
          </p>
        </div>

        <div className="p-4 bg-ashen-900/80 rounded-xl border border-ashen-800 text-sm font-mono text-cyanGlow-300 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          FINAL TRIUMPH SCORE: <span className="font-bold text-white">{score} PTS</span>
        </div>

        <button
          onClick={() => {
            triggerHaptic(40);
            onPlayAgain();
          }}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500 text-ashen-950 font-bold font-medieval tracking-widest text-sm shadow-[0_0_25px_rgba(34,211,238,0.5)] flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-110"
        >
          <RotateCcw className="w-5 h-5" />
          START NEW CAMPAIGN
        </button>
      </div>
    </div>
  );
};
