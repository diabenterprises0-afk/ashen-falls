import React, { useState } from 'react';
import { Play, Settings, BookOpen, Volume2, VolumeX, Shield, Swords, Sparkles, Smartphone } from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

interface MainMenuProps {
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenAndroidDeployment?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlay,
  onOpenSettings,
  onOpenAndroidDeployment,
  isMuted,
  onToggleMute,
}) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between p-6 sm:p-12 bg-gradient-to-b from-ashen-950 via-slate-950 to-ashen-950 select-none overflow-y-auto">
      {/* Ambient Lighting & Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.1)_0%,rgba(15,23,42,0)_70%)] pointer-events-none" />

      {/* Top Bar with Audio & Version */}
      <div className="relative z-10 w-full flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono tracking-widest uppercase">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Ashen Realm Chronicles</span>
        </div>

        <button
          onClick={() => {
            triggerHaptic(15);
            onToggleMute();
          }}
          className="p-2.5 rounded-full glass-button border border-ashen-700/60 text-ashen-300 hover:text-cyan-300 active:scale-95 transition-all shadow"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-300" />}
        </button>
      </div>

      {/* Hero Center Section */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 my-auto max-w-md w-full">
        {/* Emblem Artwork */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-cyan-500/15 blur-2xl animate-pulse" />
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-950/70 via-ashen-900/90 to-ashen-950 p-4 shadow-[0_0_50px_rgba(34,211,238,0.3)] flex items-center justify-center">
            <img
              src="/ashen-crest.svg"
              alt="Quest For Power Emblem"
              className="w-full h-full object-contain filter drop-shadow-[0_0_14px_rgba(34,211,238,0.8)]"
            />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black font-medieval tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-cyan-200 to-cyan-400 drop-shadow-[0_4px_16px_rgba(34,211,238,0.4)] uppercase">
            QUEST FOR POWER
          </h1>
          <p className="text-xs sm:text-sm font-serif italic text-ashen-300 tracking-wider">
            Awaken the Warrior. Cleanse the Void.
          </p>
        </div>

        {/* Action Navigation Buttons */}
        <div className="w-full space-y-3.5 pt-4">
          {/* PLAY Button */}
          <button
            onClick={() => {
              triggerHaptic(30);
              onPlay();
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-ashen-950 font-black font-medieval tracking-[0.2em] text-base sm:text-lg shadow-[0_0_25px_rgba(34,211,238,0.5)] flex items-center justify-center gap-3 transition-all active:scale-95 border border-cyan-300"
          >
            <Play className="w-6 h-6 fill-current text-ashen-950" />
            PLAY GAME
          </button>

          {/* SETTINGS Button */}
          <button
            onClick={() => {
              triggerHaptic(20);
              onOpenSettings();
            }}
            className="w-full py-3.5 px-6 rounded-xl glass-button border border-ashen-600/70 hover:border-cyan-400/60 text-ashen-200 font-bold font-medieval tracking-widest text-sm shadow flex items-center justify-center gap-2.5 transition-all active:scale-95"
          >
            <Settings className="w-5 h-5 text-cyan-400" />
            SETTINGS
          </button>

          {/* HOW TO PLAY Button */}
          <button
            onClick={() => {
              triggerHaptic(20);
              setShowGuide(true);
            }}
            className="w-full py-3 px-6 rounded-xl glass-button border border-ashen-700/60 hover:border-ashen-500 text-ashen-300 font-medium font-medieval tracking-wider text-xs shadow flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            HOW TO PLAY & COMBAT GUIDE
          </button>

          {/* ANDROID DEPLOYMENT & OPTIMIZATION Button */}
          {onOpenAndroidDeployment && (
            <button
              onClick={() => {
                triggerHaptic(20);
                onOpenAndroidDeployment();
              }}
              className="w-full py-2.5 px-6 rounded-xl glass-button border border-emerald-500/50 hover:border-emerald-400/80 text-emerald-300 font-bold font-medieval tracking-widest text-[11px] shadow flex items-center justify-center gap-2 transition-all active:scale-95 bg-emerald-950/20"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              ANDROID DEPLOYMENT READY
            </button>
          )}
        </div>
      </div>

      {/* Footer Commercial Credits */}
      <div className="relative z-10 text-center space-y-1">
        <p className="text-[11px] font-mono text-ashen-400">
          Dark Fantasy Action RPG • Android & WebGL
        </p>
      </div>

      {/* How To Play Modal Guide */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg p-6 bg-ashen-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.3)] text-ashen-200 font-sans space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-ashen-800 pb-3">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold font-medieval tracking-wider text-cyan-200 uppercase">
                  Combat & Controls Guide
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-ashen-400 hover:text-ashen-100 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-ashen-900/60 rounded-xl border border-ashen-800 space-y-1">
                <span className="font-bold text-cyan-300 font-mono">Movement & Camera:</span>
                <p className="text-ashen-300">
                  Use the 360° virtual joystick on the bottom-left to move. Touch and drag anywhere on the upper screen to orbit the camera smoothly.
                </p>
              </div>

              <div className="p-3 bg-ashen-900/60 rounded-xl border border-ashen-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono">Unarmed Combos:</span>
                <p className="text-ashen-300">
                  Tap Attack sequentially to chain: <strong>Jab → Cross → Roundhouse Kick → Jumping Spinning Kick</strong>.
                </p>
              </div>

              <div className="p-3 bg-ashen-900/60 rounded-xl border border-ashen-800 space-y-1">
                <span className="font-bold text-cyan-300 font-mono">Runic Greatsword:</span>
                <p className="text-ashen-300">
                  Tap the Sword icon to draw your greatsword. Perform slashing combos and lethal forward Sword Dashes!
                </p>
              </div>

              <div className="p-3 bg-ashen-900/60 rounded-xl border border-ashen-800 space-y-1">
                <span className="font-bold text-emerald-300 font-mono">Evasive Roll & Defense:</span>
                <p className="text-ashen-300">
                  Tap Roll to dodge enemy attacks with full invulnerability frames (i-frames). Use Parry to deflect and counter strikes!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-ashen-950 font-medieval font-bold text-xs tracking-widest uppercase transition-all shadow"
            >
              GOT IT, READY TO FIGHT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
