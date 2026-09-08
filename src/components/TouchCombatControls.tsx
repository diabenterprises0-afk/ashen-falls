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
import { triggerHaptic } from '../utils/storage';

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
  onToggleSword?: () => void;
  onSwordDash?: () => void;
  onToggleCrawl?: () => void;
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
  onToggleSword,
  onSwordDash,
  className = '',
}) => {
  const canRuneBurst = stats.runes >= 30;
  const hasPotions = stats.potions > 0;
  const hasStaminaForRoll = stats.stamina >= 18;
  const hasStaminaForHeavy = stats.stamina >= 20;

  return (
    <div className={`relative pointer-events-auto touch-none select-none ${className}`}>
      {/* Top Utility Belt (Potion, Lock-On, Sprint, Sword Toggle, 180 Turn) */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 mb-3 pr-2">
        {/* Sword Draw / Sheathe Toggle */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onToggleSword?.();
          }}
          className={`w-11 h-11 rounded-2xl glass-button flex items-center justify-center border transition-all active:scale-90 shadow ${
            stats.isSwordEquipped
              ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
              : 'border-ashen-700/60 text-ashen-400 bg-ashen-950/60'
          }`}
          title={stats.isSwordEquipped ? 'Sheathe Sword' : 'Draw Runic Sword'}
        >
          <Sword className={`w-5 h-5 ${stats.isSwordEquipped ? 'text-cyan-300 rotate-45' : 'text-ashen-400'}`} />
        </button>

        {/* Quick 180 Turn */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onQuickTurn();
          }}
          className="w-11 h-11 rounded-2xl glass-button flex items-center justify-center text-ashen-200 border border-ashen-700/60 bg-ashen-950/60 active:scale-90 shadow"
          title="Quick 180° Turn"
        >
          <RotateCcw className="w-5 h-5 text-ashen-300" />
        </button>

        {/* Lock On Target */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onToggleLockOn();
          }}
          className={`w-11 h-11 rounded-2xl glass-button flex items-center justify-center border transition-all active:scale-90 shadow ${
            isLockedOn
              ? 'border-cyan-400 bg-cyan-950/70 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
              : 'border-ashen-700/60 text-ashen-300 bg-ashen-950/60'
          }`}
          title="Target Lock-On"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Sprint Toggle */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onToggleSprint();
          }}
          className={`w-11 h-11 rounded-2xl glass-button flex items-center justify-center border transition-all active:scale-90 shadow ${
            stats.isSprinting
              ? 'border-amber-400 bg-amber-950/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              : 'border-ashen-700/60 text-ashen-300 bg-ashen-950/60'
          }`}
          title="Toggle Sprint"
        >
          <Footprints className="w-5 h-5" />
        </button>

        {/* Healing Potion Flask */}
        <button
          onClick={() => {
            if (hasPotions) {
              triggerHaptic(25);
              onHealPotion();
            }
          }}
          disabled={!hasPotions}
          className={`relative w-11 h-11 rounded-2xl glass-button flex items-center justify-center border transition-all active:scale-90 shadow ${
            hasPotions
              ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'border-ashen-800 bg-ashen-950/50 text-ashen-600 opacity-40 cursor-not-allowed'
          }`}
          title="Drink Healing Potion"
        >
          <FlaskConical className="w-5 h-5 text-emerald-400" />
          <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[9px] font-mono w-4 h-4 rounded-full flex items-center justify-center border border-emerald-300">
            {stats.potions}
          </span>
        </button>
      </div>

      {/* Main Action Diamond Cluster */}
      <div className="relative w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center">
        {/* Primary Attack Button (Center-Right, Large) */}
        <button
          onClick={() => {
            triggerHaptic(20);
            onLightAttack();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-18 h-18 sm:w-20 sm:h-20 rounded-full glass-button border-2 border-cyan-400/80 bg-gradient-to-br from-cyan-900/70 via-ashen-900/90 to-ashen-950 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] active:scale-90 z-20"
        >
          <Sword className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-200" />
          <span className="text-[9px] sm:text-[10px] font-bold font-medieval tracking-wider uppercase text-cyan-200 mt-0.5">
            {stats.isSwordEquipped ? 'Slash' : 'Attack'}
          </span>
          {stats.comboCount > 0 && (
            <span className="absolute -top-1 -left-1 bg-cyan-400 text-ashen-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow border border-white animate-bounce">
              {stats.comboCount}x
            </span>
          )}
        </button>

        {/* Top Button: Heavy / Dash */}
        <button
          onClick={() => {
            if (hasStaminaForHeavy && (stats.swordDashCooldown || 0) <= 0) {
              triggerHaptic(30);
              if (stats.isSwordEquipped && onSwordDash) onSwordDash();
              else onHeavyCleave();
            }
          }}
          disabled={!hasStaminaForHeavy || (stats.swordDashCooldown || 0) > 0}
          className={`absolute top-0 left-14 sm:left-16 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 shadow ${
            hasStaminaForHeavy && (stats.swordDashCooldown || 0) <= 0
              ? 'border-amber-500/80 bg-amber-950/50 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-40'
          }`}
          title={stats.isSwordEquipped ? 'Sword Dash' : 'Heavy Cleave'}
        >
          <Flame className="w-5 h-5 text-amber-400" />
          <span className="text-[7px] sm:text-[8px] font-bold tracking-wider uppercase text-amber-200">
            {stats.isSwordEquipped ? 'Dash' : 'Heavy'}
          </span>
        </button>

        {/* Bottom Button: Rune Burst AoE */}
        <button
          onClick={() => {
            if (canRuneBurst) {
              triggerHaptic(40);
              onRuneBurst();
            }
          }}
          disabled={!canRuneBurst}
          className={`absolute bottom-0 left-14 sm:left-16 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 shadow ${
            canRuneBurst
              ? 'border-purple-500/80 bg-purple-950/50 text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.4)] animate-pulse'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-40'
          }`}
          title="Rune Burst (AoE blast)"
        >
          <Zap className="w-5 h-5 text-purple-400" />
          <span className="text-[7px] sm:text-[8px] font-bold tracking-wider uppercase text-purple-200">Rune</span>
        </button>

        {/* Left-Top Button: Parry */}
        <button
          onClick={() => {
            triggerHaptic(20);
            onParry();
          }}
          className="absolute top-8 left-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-button border border-blue-400/70 bg-blue-950/50 text-blue-200 flex flex-col items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.3)] active:scale-90"
          title="Shield Parry"
        >
          <Shield className="w-5 h-5 text-blue-300" />
          <span className="text-[7px] sm:text-[8px] font-bold tracking-wider uppercase text-blue-200">Parry</span>
        </button>

        {/* Left-Bottom Button: Dodge Roll */}
        <button
          onClick={() => {
            if (hasStaminaForRoll && (stats.dodgeCooldown || 0) <= 0) {
              triggerHaptic(20);
              onDodgeRoll();
            }
          }}
          disabled={!hasStaminaForRoll || (stats.dodgeCooldown || 0) > 0}
          className={`absolute bottom-8 left-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 shadow ${
            hasStaminaForRoll && (stats.dodgeCooldown || 0) <= 0
              ? 'border-emerald-400/70 bg-emerald-950/50 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'border-ashen-800 bg-ashen-950/40 text-ashen-600 opacity-40'
          }`}
          title="Dodge Roll (Invulnerability)"
        >
          <RotateCcw className="w-5 h-5 text-emerald-300 rotate-90" />
          <span className="text-[7px] sm:text-[8px] font-bold tracking-wider uppercase text-emerald-200">Roll</span>
        </button>

        {/* Center-Left Button: Jump */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onJump();
          }}
          className={`absolute top-1/2 -translate-y-1/2 left-8 sm:left-9 w-11 h-11 sm:w-12 sm:h-12 rounded-full glass-button border flex flex-col items-center justify-center active:scale-90 shadow ${
            stats.canDoubleJump
              ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.4)]'
              : 'border-ashen-600/70 bg-ashen-900/60 text-ashen-200'
          }`}
          title={stats.canDoubleJump ? 'Double Jump' : 'Jump'}
        >
          <ArrowUp className={`w-4 h-4 ${stats.canDoubleJump ? 'text-cyan-300 animate-bounce' : 'text-ashen-300'}`} />
          <span className="text-[7px] font-bold tracking-wider uppercase text-ashen-200">
            {stats.canDoubleJump ? 'D-Jump' : 'Jump'}
          </span>
        </button>
      </div>
    </div>
  );
};
