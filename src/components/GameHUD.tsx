import React from 'react';
import { PlayerStats, ChapterQuest, EnemyEntity, FloatingText } from '../types/game';
import {
  Volume2,
  VolumeX,
  ShieldAlert,
  Zap,
  Pause,
  Skull,
} from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

interface GameHUDProps {
  stats: PlayerStats;
  quest: ChapterQuest;
  boss: EnemyEntity | null;
  floatingTexts: FloatingText[];
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  quest,
  boss,
  floatingTexts,
  isMuted,
  onToggleMute,
  onOpenPause,
}) => {
  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (stats.stamina / stats.maxStamina) * 100));
  const runesPercent = Math.max(0, Math.min(100, (stats.runes / 100) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Player Vitals Panel */}
        <div className="glass-panel rounded-2xl p-3 shadow-2xl border border-ashen-700/60 w-56 sm:w-64 space-y-2 pointer-events-auto">
          {/* Hero Name & Score */}
          <div className="flex items-center justify-between">
            <span className="font-medieval text-xs font-bold tracking-widest text-ashen-200 uppercase">
              ASH • WARRIOR
            </span>
            <span className="text-[11px] font-mono text-cyan-300 font-bold">
              SCORE: {stats.score}
            </span>
          </div>

          {/* Health Bar (Red) */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-ashen-300">
              <span className="font-bold text-red-400">HEALTH</span>
              <span>
                {Math.round(stats.hp)} / {stats.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 sm:h-3 bg-ashen-950 rounded-full overflow-hidden border border-ashen-700/80 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-red-700 via-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar (Amber) */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-ashen-300">
              <span className="font-bold text-amber-400">STAMINA</span>
              <span>{Math.round(stats.stamina)}%</span>
            </div>
            <div className="w-full h-1.5 sm:h-2 bg-ashen-950 rounded-full overflow-hidden border border-ashen-700/80 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-100 bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>

          {/* Rune Mana Bar (Cyan) */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-ashen-300">
              <span className="font-bold text-cyan-400">RUNES</span>
              <span>{Math.round(stats.runes)} / 100</span>
            </div>
            <div className="w-full h-1.5 bg-ashen-950 rounded-full overflow-hidden border border-ashen-700/80 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-cyan-600 to-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
                style={{ width: `${runesPercent}%` }}
              />
            </div>
          </div>

          {/* Status Badges */}
          {stats.isInvulnerable && (
            <div className="text-[9px] text-cyan-200 font-bold flex items-center gap-1 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/50 animate-pulse">
              <Zap className="w-3 h-3 text-cyan-400" /> INVULNERABLE (I-FRAMES)
            </div>
          )}
          {stats.isParrying && (
            <div className="text-[9px] text-blue-200 font-bold flex items-center gap-1 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-500/50 animate-pulse">
              <ShieldAlert className="w-3 h-3 text-blue-400" /> PARRY STANCE
            </div>
          )}
        </div>

        {/* Top-Center: Quest / Chapter Objective */}
        <div className="hidden sm:flex flex-col items-center text-center glass-panel px-4 py-2 rounded-2xl border border-ashen-700/60 shadow-xl max-w-sm">
          <span className="font-medieval text-xs font-bold text-cyan-300 tracking-wider uppercase">
            Chapter {quest.chapter}: {quest.title}
          </span>
          <p className="text-[11px] text-ashen-300 mt-0.5 font-medium">
            {quest.objective} ({quest.currentKills}/{quest.requiredKills})
          </p>
        </div>

        {/* Top-Right: Game Control Buttons (Pause & Audio) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio Mute/Unmute */}
          <button
            onClick={() => {
              triggerHaptic(10);
              onToggleMute();
            }}
            className="w-10 h-10 rounded-xl glass-button flex items-center justify-center text-ashen-300 hover:text-cyan-300 border border-ashen-700/60 active:scale-95 transition-all shadow"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-300" />}
          </button>

          {/* Pause Button */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onOpenPause();
            }}
            className="w-10 h-10 rounded-xl glass-button flex items-center justify-center text-ashen-200 hover:text-white border border-cyan-500/50 bg-cyan-950/40 active:scale-95 transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)]"
            title="Pause Game"
          >
            <Pause className="w-5 h-5 text-cyan-300" />
          </button>
        </div>
      </div>

      {/* Center Top: Boss Health Bar (when boss active) */}
      {boss && boss.state !== 'DEAD' && (
        <div className="self-center w-full max-w-md glass-panel p-3 rounded-2xl border border-red-500/60 shadow-2xl space-y-1 my-2 pointer-events-none animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-medieval text-xs font-bold text-red-400 tracking-widest flex items-center gap-1.5 uppercase">
              <Skull className="w-4 h-4 text-red-500" />
              {boss.name}
            </span>
            <span className="text-[10px] font-mono text-red-300">
              {Math.max(0, Math.round(boss.hp))} / {boss.maxHp} HP
            </span>
          </div>
          <div className="w-full h-3 bg-ashen-950 rounded-full overflow-hidden border border-red-800 p-0.5">
            <div
              className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-red-800 via-red-600 to-amber-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]"
              style={{ width: `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Floating Combat Damage/Healing Numbers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingTexts.map(item => (
          <div
            key={item.id}
            className="absolute font-mono font-extrabold transition-all duration-500 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{
              left: `50%`,
              top: `45%`,
              color: item.color,
              fontSize: `${Math.round(18 * item.scale)}px`,
            }}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
};
