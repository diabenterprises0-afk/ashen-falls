export type ActionState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'SPRINT'
  | 'JUMP'
  | 'JUMP_START'
  | 'JUMP_LAND'
  | 'DOUBLE_JUMP'
  | 'DODGE_ROLL'
  | 'HIT_STOMACH'
  | 'ATTACK_1'
  | 'ATTACK_2'
  | 'ATTACK_3'
  | 'HEAVY_CLEAVE'
  | 'RUNE_BURST'
  | 'PARRY'
  | 'HEAL'
  | 'HURT'
  | 'DEAD'
  | 'PUNCH_JAB'
  | 'PUNCH_CROSS'
  | 'KICK'
  | 'JUMP_SPIN_KICK'
  | 'SWORD_ENTER'
  | 'SWORD_ATTACK'
  | 'SWORD_AERIAL'
  | 'SWORD_DASH'
  | 'CRAWL_BACKWARD';

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
  resolutionScale: number; // 0.65, 0.75, 1.0, 1.25
  targetFps: number; // 30, 60, 120
  shadows: 'off' | 'low' | 'high';
  bloom: boolean;
  particleDensity: 'low' | 'medium' | 'high';
  lowEndMode?: boolean; // Optimized specifically for low-end devices like itel A60
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
  isSwordEquipped?: boolean;
  isCrawling?: boolean;
  canDoubleJump?: boolean;
  swordDashCooldown?: number;
  dodgeCooldown?: number;
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

export interface ModelCalibrationConfig {
  scaleMultiplier: number; // 0.2x to 5.0x
  yOffset: number; // -2.0 to 2.0
  rotationOffsetY: number; // 0, 90, 180, 270 degrees
  castShadows: boolean;
  useEmbeddedAnimations: boolean;
}

export interface CustomModelInfo {
  isLoaded: boolean;
  name: string;
  source: 'file' | 'static_url' | 'procedural_default';
  hasAnimations: boolean;
  animationNames: string[];
  meshCount: number;
  vertexCount: number;
  config: ModelCalibrationConfig;
}

export interface GameSettings {
  joystick: JoystickConfig;
  graphics: GraphicSettings;
  modelConfig: ModelCalibrationConfig;
  musicVolume: number;
  sfxVolume: number;
  hapticEnabled: boolean;
}
