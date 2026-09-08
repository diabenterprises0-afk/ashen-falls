export type ActionState =
  | 'IDLE'
  | 'RUN'
  | 'SPRINT'
  | 'ATTACK_1'
  | 'ATTACK_2'
  | 'ATTACK_3'
  | 'HEAVY_CLEAVE'
  | 'RUNE_BURST'
  | 'DODGE_ROLL'
  | 'PARRY'
  | 'JUMP'
  | 'HEAL'
  | 'HURT'
  | 'DEAD';

export type EnemyType = 'VOID_THRALL' | 'CORRUPTED_GUARD' | 'MALAKOR_BOSS';

export interface JoystickConfig {
  deadzone: number; // 0.05 to 0.40 (fraction of radius)
  sensitivity: number; // 0.5 to 2.5
  dynamicAnchor: boolean; // True: stick spawns where touched; False: fixed position
  radius: number; // in pixels (45 to 95)
  opacity: number; // 0.3 to 1.0
  responseCurve: 'linear' | 'smooth' | 'aggressive'; // power curve for magnitude
  sprintThreshold: number; // 0.70 to 0.95 stick push triggers sprint
  haptics: boolean; // trigger haptics on sprint/actions
  leftHanded: boolean; // flip joystick to right side if requested
  cameraSensitivity: number; // 0.5 to 2.5
  cameraInvertY: boolean;
}

export interface GraphicSettings {
  resolutionScale: number; // 0.75, 1.0, 1.25
  targetFps: number; // 30, 60, 120
  shadows: 'off' | 'low' | 'high';
  bloom: boolean;
  particleDensity: 'low' | 'medium' | 'high';
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  runes: number; // 0 to 100
  potions: number;
  maxPotions: number;
  potionHealAmount: number;
  level: number;
  score: number;
  comboCount: number;
  comboMultiplier: number;
  isInvulnerable: boolean;
  isParrying: boolean;
  isSprinting: boolean;
}

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  name: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  hp: number;
  maxHp: number;
  state: 'IDLE' | 'CHASE' | 'WINDUP' | 'ATTACK' | 'STAGGER' | 'DEAD' | 'ENRAGED';
  attackTimer: number;
  staggerTimer: number;
  phase?: number;
  meshRef?: any;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  z: number;
  color: string;
  createdAt: number;
  duration: number;
  scale: number;
}

export interface ChapterQuest {
  chapter: number;
  title: string;
  subtitle: string;
  objective: string;
  requiredKills: number;
  currentKills: number;
  completed: boolean;
  bossAppeared: boolean;
}

export interface GameSettings {
  joystick: JoystickConfig;
  graphics: GraphicSettings;
  musicVolume: number;
  sfxVolume: number;
  hapticEnabled: boolean;
}
