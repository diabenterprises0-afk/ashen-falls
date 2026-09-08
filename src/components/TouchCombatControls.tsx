import React from 'react';
import { PlayerStats } from '../types/game';
import {
  Sword,
  Shield,
  Zap,
  Flame,
  RotateCcw,
  Crosshair,
  ArrowUp,
  FlaskConical,
  Footprints,
} from 'lucide-react';

interface TouchCombatControlsProps {
  stats: PlayerStats;
  isLockedOn: boolean;
  onLightAttack: () => void;
  onHeavyCleave: () => void;
  onRuneBurst: () => void;
  onDodgeRoll: () => void;
  onParry: () => void;
  onJump: () => void;
  onHealPotion: () => void;
  onToggleSprint: () => void;
  onToggleLockOn: () => void;
  onQuickTurn: () => void;
  className?: string;
}

export const TouchCombatControls: React.FC<TouchCombatControlsProps> = ({
  stats,
  isLockedOn,
  onLightAttack,
  onHeavyCleave,
  onRuneBurst,
  onDodgeRoll,
  onParry,
  onJump,
  onHealPotion,
  onToggleSprint,
  onToggleLockOn,
  onQuickTurn,
  className = '',
}) => {
  const canRuneBurst = stats.runes >= 30;
  const hasPotions = stats.potions > 0;
  const hasStaminaForRoll = stats.stamina >= 20;
  const hasStaminaForHeavy = stats.stamina >= 28;

  return (
    <div className={`relative pointer-events-auto touch-none select-none ${className}`}>
      {/* Top Utility Row (Lock-on, 180 Turn, Sprint Toggle) */}
      <div className="absolute right-6 -top-16 flex items-center gap-3">
        {/* Quick 180 Turn */}
        <button
          onClick={onQuickTurn}
          className="w-11 h-11 rounded-full glass-button flex items-center justify-center text-ashen-200 border-ashen-600/50 active:scale-90 active:bg-ashen-600"
          title="Quick 180 Turn"
        >
          <RotateCcw className="w-5 h-5 text-ashen-300" />
        </button>

        {/* Lock On Target */}
        <button
          onClick={onToggleLockOn}
          className={`w-11 h-11 rounded-full glass-button flex items-center justify-center border transition-all active:scale-90 ${
            isLockedOn
              ? 'border-cyanGlow-400 bg-cyanGlow-500/30 text-cyanGlow-300 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
              : 'border-ashen-600/50 text-ashen-300'
          }`}
          title="Target Lock-On"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Sprint Toggle */}
        <button
          onClick={onToggleSprint}
          className={`w-11 h-11 rounded-full glass-button flex items-center justify-center border transition-all active:scale-90 ${
            stats.isSprinting
              ? 'border-ember-500 bg-ember-500/30 text-ember-300 shadow-[0_0_12px_rgba(255,87,34,0.5)]'
              : 'border-ashen-600/50 text-ashen-300'
          }`}
          title="Toggle Sprint Mode"
        >
          <Footprints className="w-5 h-5" />
        </button>

        {/* Estus Potion Flask */}
        <button
          onClick={onHealPotion}
          disabled={!hasPotions}
          className={`relative w-12 h-12 rounded-full glass-button flex items-center justify-center border transition-all active:scale-90 ${
            hasPotions
              ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-50 cursor-not-allowed'
          }`}
          title="Drink Healing Potion"
        >
          <FlaskConical className="w-6 h-6 text-emerald-400" />
          <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-emerald-300">
            {stats.potions}
          </span>
        </button>
      </div>

      {/* Primary Action Button Diamond Cluster */}
      <div className="relative w-56 h-56 flex items-center justify-center">
        {/* Center-Right: Primary Light Attack (Large Button) */}
        <button
          onClick={onLightAttack}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full glass-button border-2 border-cyanGlow-400/80 bg-gradient-to-br from-cyan-900/60 to-ashen-950/80 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] active:scale-90 active:bg-cyanGlow-500/40 z-20"
        >
          <Sword className="w-9 h-9 text-cyan-200" />
          <span className="text-[10px] font-bold font-medieval tracking-wider uppercase text-cyan-200 mt-0.5">
            Attack
          </span>
          {stats.comboCount > 0 && (
            <span className="absolute -top-1.5 -left-1.5 bg-cyan-500 text-ashen-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow border border-cyan-200 animate-bounce">
              {stats.comboCount}x
            </span>
          )}
        </button>

        {/* Top: Heavy Cleave */}
        <button
          onClick={onHeavyCleave}
          disabled={!hasStaminaForHeavy}
          className={`absolute top-0 left-16 w-14 h-14 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 ${
            hasStaminaForHeavy
              ? 'border-amber-500/80 bg-amber-950/40 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-50'
          }`}
          title="Heavy Cleave Strike"
        >
          <Flame className="w-6 h-6 text-amber-400" />
          <span className="text-[8px] font-bold tracking-wider uppercase text-amber-200">Heavy</span>
        </button>

        {/* Bottom: Rune Burst AoE */}
        <button
          onClick={onRuneBurst}
          disabled={!canRuneBurst}
          className={`absolute bottom-0 left-16 w-14 h-14 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 ${
            canRuneBurst
              ? 'border-purple-500/80 bg-purple-950/40 text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.4)] animate-pulse'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-40'
          }`}
          title="Rune Burst AoE"
        >
          <Zap className="w-6 h-6 text-purple-400" />
          <span className="text-[8px] font-bold tracking-wider uppercase text-purple-200">Rune</span>
        </button>

        {/* Left-Top: Parry / Guard Shield */}
        <button
          onClick={onParry}
          className="absolute top-10 left-0 w-14 h-14 rounded-full glass-button border border-blue-400/70 bg-blue-950/40 text-blue-200 flex flex-col items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.3)] active:scale-90"
          title="Shield Parry / Guard"
        >
          <Shield className="w-6 h-6 text-blue-300" />
          <span className="text-[8px] font-bold tracking-wider uppercase text-blue-200">Parry</span>
        </button>

        {/* Left-Bottom: Dodge Roll */}
        <button
          onClick={onDodgeRoll}
          disabled={!hasStaminaForRoll}
          className={`absolute bottom-10 left-0 w-14 h-14 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 ${
            hasStaminaForRoll
              ? 'border-emerald-400/70 bg-emerald-950/40 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-50'
          }`}
          title="Evasive Dodge Roll"
        >
          <RotateCcw className="w-6 h-6 text-emerald-300 rotate-90" />
          <span className="text-[8px] font-bold tracking-wider uppercase text-emerald-200">Roll</span>
        </button>

        {/* Center-Left: Jump */}
        <button
          onClick={onJump}
          className="absolute top-1/2 -translate-y-1/2 left-10 w-12 h-12 rounded-full glass-button border border-ashen-500/60 bg-ashen-900/60 text-ashen-200 flex flex-col items-center justify-center active:scale-90"
          title="Jump"
        >
          <ArrowUp className="w-5 h-5 text-ashen-300" />
          <span className="text-[8px] font-bold tracking-wider uppercase text-ashen-300">Jump</span>
        </button>
      </div>
    </div>
  );
};
