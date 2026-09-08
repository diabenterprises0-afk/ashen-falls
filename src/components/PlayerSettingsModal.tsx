import React from 'react';
import { Volume2, VolumeX, Eye, Smartphone, Check, Sparkles } from 'lucide-react';
import { GraphicSettings, JoystickConfig } from '../types/game';
import { triggerHaptic } from '../utils/storage';

interface PlayerSettingsModalProps {
  graphics: GraphicSettings;
  joystick: JoystickConfig;
  isMuted: boolean;
  onToggleMute: () => void;
  onUpdateGraphics: (settings: GraphicSettings) => void;
  onUpdateJoystick: (settings: JoystickConfig) => void;
  onClose: () => void;
}

export const PlayerSettingsModal: React.FC<PlayerSettingsModalProps> = ({
  graphics,
  joystick,
  isMuted,
  onToggleMute,
  onUpdateGraphics,
  onUpdateJoystick,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md p-6 bg-ashen-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(34,211,238,0.25)] text-ashen-100 font-sans space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ashen-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold font-medieval tracking-widest text-cyan-200 uppercase">
              Game Settings
            </h3>
          </div>
          <button
            onClick={() => {
              triggerHaptic(10);
              onClose();
            }}
            className="p-1.5 rounded-lg text-ashen-400 hover:text-white hover:bg-ashen-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Audio Section */}
        <div className="space-y-2">
          <label className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            Audio & Sound
          </label>
          <div className="p-3.5 bg-ashen-900/60 rounded-2xl border border-ashen-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ashen-200">Ambient Music & Sound Effects</p>
              <p className="text-[11px] text-ashen-400">Retro dark-fantasy PCM synthesized audio</p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(15);
                onToggleMute();
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                isMuted
                  ? 'bg-red-950/60 border-red-500/50 text-red-300'
                  : 'bg-cyan-950/60 border-cyan-400/50 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
              }`}
            >
              {isMuted ? 'Muted' : 'Enabled'}
            </button>
          </div>
        </div>

        {/* Graphics Section */}
        <div className="space-y-2">
          <label className="text-xs font-bold font-mono tracking-wider text-amber-300 uppercase flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            Graphics Quality
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as const).map(quality => {
              const isSelected =
                quality === 'high'
                  ? graphics.shadows === 'high' && graphics.resolutionScale >= 1.0
                  : quality === 'medium'
                  ? graphics.shadows !== 'off' && graphics.resolutionScale < 1.0
                  : graphics.shadows === 'off';

              return (
                <button
                  key={quality}
                  onClick={() => {
                    triggerHaptic(15);
                    if (quality === 'high') {
                      onUpdateGraphics({ ...graphics, shadows: 'high', resolutionScale: 1.0 });
                    } else if (quality === 'medium') {
                      onUpdateGraphics({ ...graphics, shadows: 'low', resolutionScale: 0.85 });
                    } else {
                      onUpdateGraphics({ ...graphics, shadows: 'off', resolutionScale: 0.75 });
                    }
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-amber-950/60 border-amber-500/70 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)] font-bold'
                      : 'bg-ashen-900/40 border-ashen-800 text-ashen-400 hover:border-ashen-700'
                  }`}
                >
                  <p className="text-xs capitalize">{quality}</p>
                  <p className="text-[9px] text-ashen-400 mt-0.5 font-mono">
                    {quality === 'high' ? '60 FPS Ultra' : quality === 'medium' ? 'Balanced' : 'Performance'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls Section */}
        <div className="space-y-2">
          <label className="text-xs font-bold font-mono tracking-wider text-emerald-300 uppercase flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            Touch Controls & Feedback
          </label>

          {/* Joystick Handedness */}
          <div className="p-3 bg-ashen-900/60 rounded-2xl border border-ashen-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ashen-200">Joystick Position</p>
              <p className="text-[11px] text-ashen-400">Position of movement controls</p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  triggerHaptic(15);
                  onUpdateJoystick({ ...joystick, leftHanded: false });
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  !joystick.leftHanded
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow'
                    : 'bg-ashen-900/40 border-ashen-800 text-ashen-400'
                }`}
              >
                Left Side
              </button>
              <button
                onClick={() => {
                  triggerHaptic(15);
                  onUpdateJoystick({ ...joystick, leftHanded: true });
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  joystick.leftHanded
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow'
                    : 'bg-ashen-900/40 border-ashen-800 text-ashen-400'
                }`}
              >
                Right Side
              </button>
            </div>
          </div>

          {/* Vibration Haptics */}
          <div className="p-3 bg-ashen-900/60 rounded-2xl border border-ashen-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ashen-200">Haptic Vibration</p>
              <p className="text-[11px] text-ashen-400">Tactile impact and attack pulses</p>
            </div>
            <button
              onClick={() => {
                const next = !joystick.haptics;
                if (next) triggerHaptic(25);
                onUpdateJoystick({ ...joystick, haptics: next });
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                joystick.haptics
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow'
                  : 'bg-ashen-900/40 border-ashen-800 text-ashen-500'
              }`}
            >
              {joystick.haptics ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-ashen-950 font-bold font-medieval tracking-widest text-xs uppercase flex items-center justify-center gap-2 shadow transition-all active:scale-95"
        >
          <Check className="w-4 h-4" />
          SAVE & CLOSE
        </button>
      </div>
    </div>
  );
};
