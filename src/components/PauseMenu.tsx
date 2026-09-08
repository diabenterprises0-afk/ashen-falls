import React from 'react';
import { Play, Settings, RotateCcw, LogOut, Shield, Smartphone } from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

interface PauseMenuProps {
  onResume: () => void;
  onOpenSettings: () => void;
  onOpenAndroidDeployment?: () => void;
  onRestartChapter: () => void;
  onQuitToMainMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onOpenSettings,
  onOpenAndroidDeployment,
  onRestartChapter,
  onQuitToMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm p-6 sm:p-8 bg-ashen-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(34,211,238,0.25)] text-center text-ashen-100 font-sans space-y-6">
        {/* Header with Crest / Shield */}
        <div className="space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-medieval tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-cyan-200 to-cyan-400 uppercase">
            GAME PAUSED
          </h2>
          <p className="text-xs text-ashen-400">
            Take a breath, warrior. The realm awaits your return.
          </p>
        </div>

        {/* Menu Buttons */}
        <div className="space-y-3">
          {/* RESUME */}
          <button
            onClick={() => {
              triggerHaptic(20);
              onResume();
            }}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-ashen-950 font-bold font-medieval tracking-widest text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <Play className="w-5 h-5 fill-current text-ashen-950" />
            RESUME
          </button>

          {/* SETTINGS */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onOpenSettings();
            }}
            className="w-full py-3.5 px-5 rounded-xl glass-button border border-ashen-700/70 hover:border-cyan-400/50 text-ashen-200 font-bold font-medieval tracking-widest text-xs sm:text-sm shadow flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            SETTINGS
          </button>

          {/* RESTART CHAPTER */}
          <button
            onClick={() => {
              triggerHaptic(25);
              onRestartChapter();
            }}
            className="w-full py-3.5 px-5 rounded-xl glass-button border border-amber-600/40 hover:border-amber-500/60 text-amber-200 font-bold font-medieval tracking-widest text-xs sm:text-sm shadow flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            RESTART CHAPTER
          </button>

          {/* ANDROID DEPLOYMENT */}
          {onOpenAndroidDeployment && (
            <button
              onClick={() => {
                triggerHaptic(15);
                onOpenAndroidDeployment();
              }}
              className="w-full py-2.5 px-5 rounded-xl glass-button border border-emerald-500/50 hover:border-emerald-400/80 text-emerald-300 font-bold font-medieval tracking-widest text-xs shadow flex items-center justify-center gap-2 transition-all active:scale-95 bg-emerald-950/20"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              ANDROID DEPLOYMENT INFO
            </button>
          )}

          {/* QUIT TO MAIN MENU */}
          <button
            onClick={() => {
              triggerHaptic(20);
              onQuitToMainMenu();
            }}
            className="w-full py-3 px-5 rounded-xl glass-button border border-red-900/40 hover:border-red-500/50 text-red-300 font-bold font-medieval tracking-widest text-xs shadow flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            QUIT TO MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
