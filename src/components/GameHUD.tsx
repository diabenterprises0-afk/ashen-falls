import React from 'react';
import { PlayerStats, ChapterQuest, EnemyEntity, FloatingText } from '../types/game';
import {
  Sliders,
  Smartphone,
  Volume2,
  VolumeX,
  ShieldAlert,
  Flame,
  Zap,
  Award,
} from 'lucide-react';

interface GameHUDProps {
  stats: PlayerStats;
  quest: ChapterQuest;
  boss: EnemyEntity | null;
  floatingTexts: FloatingText[];
  fps: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenCalibration: () => void;
  onOpenAndroidModal: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  quest,
  boss,
  floatingTexts,
  fps,
  isMuted,
  onToggleMute,
  onOpenCalibration,
  onOpenAndroidModal,
}) => {
  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (stats.stamina / stats.maxStamina) * 100));
  const runesPercent = Math.max(0, Math.min(100, (stats.runes / 100) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-4">
      {/* Top Bar: Player Vitals, Quest Objective & Quick Settings */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Vitals Bar */}
        <div className="glass-panel rounded-2xl p-3.5 shadow-2xl border border-ashen-600/40 w-64 space-y-2 pointer-events-auto">
          {/* Header & Level/Score */}
          <div className="flex items-center justify-between">
            <span className="font-medieval text-xs font-bold tracking-widest text-ashen-200">
              ASHEN KNIGHT
            </span>
            <span className="text-[11px] font-mono text-cyanGlow-300 font-bold">
              SCORE: {stats.score}
            </span>
          </div>

          {/* Health Bar (Red) */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-ashen-300">
              <span className="font-bold text-red-400">HP</span>
              <span>
                {Math.round(stats.hp)} / {stats.maxHp}
              </span>
            </div>
            <div className="w-full h-3 bg-ashen-950 rounded-full overflow-hidden border border-ashen-700 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-red-700 via-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar (Amber/Green) */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-ashen-300">
              <span className="font-bold text-amber-400">STM</span>
              <span>{Math.round(stats.stamina)}%</span>
            </div>
            <div className="w-full h-2 bg-ashen-950 rounded-full overflow-hidden border border-ashen-700 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-100 bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>

          {/* Rune Mana Bar (Cyan) */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-ashen-300">
              <span className="font-bold text-cyanGlow-400">RUNE</span>
              <span>{Math.round(stats.runes)} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-ashen-950 rounded-full overflow-hidden border border-ashen-700 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-cyan-600 to-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
                style={{ width: `${runesPercent}%` }}
              />
            </div>
          </div>

          {/* Active Status Badge */}
          {stats.isInvulnerable && (
            <div className="text-[10px] text-cyan-300 font-bold flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40 animate-pulse">
              <Zap className="w-3 h-3 text-cyan-400" /> INVULNERABLE (I-FRAMES)
            </div>
          )}
          {stats.isParrying && (
            <div className="text-[10px] text-blue-300 font-bold flex items-center gap-1 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/40 animate-pulse">
              <ShieldAlert className="w-3 h-3 text-blue-400" /> PARRY COUNTER STANCE
            </div>
          )}
        </div>

        {/* Top-Center: Quest / Chapter Tracker */}
        <div className="hidden sm:flex flex-col items-center text-center glass-panel px-5 py-2 rounded-2xl border border-ashen-700/60 shadow-xl max-w-sm">
          <span className="font-medieval text-xs font-bold text-cyanGlow-300 tracking-wider uppercase">
            Chapter {quest.chapter}: {quest.title}
          </span>
          <p className="text-[11px] text-ashen-300 mt-0.5 font-medium">
            {quest.objective} ({quest.currentKills}/{quest.requiredKills})
          </p>
        </div>

        {/* Top-Right: Quick Actions & Calibration Bar */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* FPS Badge */}
          <div className="hidden sm:block text-[10px] font-mono font-bold text-emerald-400 bg-ashen-900/80 px-2.5 py-1.5 rounded-xl border border-ashen-700 shadow">
            {fps} FPS
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className="w-10 h-10 rounded-xl glass-button flex items-center justify-center text-ashen-200 border-ashen-600/50 hover:text-white"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Calibrate Joystick Button */}
          <button
            onClick={onOpenCalibration}
            className="px-3 h-10 rounded-xl glass-button flex items-center gap-1.5 text-xs font-bold text-cyanGlow-300 border-cyanGlow-500/40 hover:bg-cyanGlow-500/20 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
            title="Calibrate Joystick"
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden md:inline font-medieval">Calibrate</span>
          </button>

          {/* Android Deployment Button */}
          <button
            onClick={onOpenAndroidModal}
            className="px-3 h-10 rounded-xl glass-button flex items-center gap-1.5 text-xs font-bold text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
            title="Android Deployment & Performance"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline font-medieval">Android</span>
          </button>
        </div>
      </div>

      {/* Top Center: Malakor Boss Health Bar */}
      {boss && boss.state !== 'DEAD' && (
        <div className="w-full flex flex-col items-center mt-3 pointer-events-none animate-fade-in">
          <div className="glass-panel px-6 py-2.5 rounded-2xl border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.3)] w-full max-w-lg space-y-1">
            <div className="flex items-center justify-between text-xs font-medieval font-bold">
              <span className="text-red-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-ember-400" />
                {boss.name} {boss.phase === 2 ? '• ABYSSAL INFERNO' : '• LORD OF THE ABYSS'}
              </span>
              <span className="font-mono text-red-300">
                {Math.round(boss.hp)} / {boss.maxHp}
              </span>
            </div>
            <div className="w-full h-3.5 bg-ashen-950 rounded-full overflow-hidden border border-red-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  boss.phase === 2
                    ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-300 shadow-[0_0_12px_rgba(255,87,34,0.8)] animate-pulse'
                    : 'bg-gradient-to-r from-purple-800 via-red-600 to-red-400'
                }`}
                style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Combat Text Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingTexts.map(item => (
          <div
            key={item.id}
            className="absolute font-medieval font-extrabold text-sm tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-float"
            style={{
              left: '50%',
              top: '40%',
              transform: `scale(${item.scale})`,
              color: item.color,
            }}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
};
