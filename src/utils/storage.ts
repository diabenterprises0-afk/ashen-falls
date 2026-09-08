import { GameSettings, JoystickConfig, GraphicSettings, ModelCalibrationConfig } from '../types/game';

export const DEFAULT_JOYSTICK_CONFIG: JoystickConfig = {
  deadzone: 0.12, // 12% deadzone prevents unintended micro-drift
  sensitivity: 1.0, // Standard responsive multiplier
  dynamicAnchor: false, // Fixed base with visual feedback
  radius: 64, // Optimal 64px radius for mobile thumb ergonomics
  opacity: 0.85, // Clear visibility against 3D dark world
  responseCurve: 'smooth', // Smooth quadratic curve for precision + agility
  sprintThreshold: 0.85, // Pushing stick past 85% activates sprint
  haptics: true,
  leftHanded: false,
  cameraSensitivity: 1.1,
  cameraInvertY: false,
};

export const DEFAULT_MODEL_CALIBRATION: ModelCalibrationConfig = {
  scaleMultiplier: 1.0,
  yOffset: 0.0,
  rotationOffsetY: 0,
  castShadows: true,
  useEmbeddedAnimations: true,
};

export const JOYSTICK_PRESETS: Record<string, { name: string; desc: string; config: Partial<JoystickConfig> }> = {
  balanced: {
    name: 'Balanced (Default)',
    desc: 'Optimized standard curve with gentle deadzone and smooth acceleration.',
    config: {
      deadzone: 0.12,
      sensitivity: 1.0,
      dynamicAnchor: false,
      radius: 64,
      responseCurve: 'smooth',
      sprintThreshold: 0.85,
    }
  },
  pro: {
    name: 'Pro Action / High Agility',
    desc: 'Tight 6% deadzone with 1.4x sensitivity and aggressive response for rapid parrying & dodging.',
    config: {
      deadzone: 0.06,
      sensitivity: 1.35,
      dynamicAnchor: true,
      radius: 70,
      responseCurve: 'aggressive',
      sprintThreshold: 0.78,
    }
  },
  casual: {
    name: 'Gentle & Steady',
    desc: 'Wider 20% deadzone and linear curve to prevent accidental movements on bumpy commutes.',
    config: {
      deadzone: 0.20,
      sensitivity: 0.85,
      dynamicAnchor: false,
      radius: 60,
      responseCurve: 'linear',
      sprintThreshold: 0.90,
    }
  },
  tablet: {
    name: 'Large Screen / Tablet',
    desc: 'Expanded 85px radius and boosted camera sensitivity for foldables & tablets.',
    config: {
      deadzone: 0.10,
      sensitivity: 1.2,
      dynamicAnchor: false,
      radius: 82,
      responseCurve: 'smooth',
      sprintThreshold: 0.82,
    }
  },
  floating: {
    name: 'Dynamic Floating Thumb',
    desc: 'Joystick base anchors wherever your thumb initially touches down on the screen.',
    config: {
      deadzone: 0.08,
      sensitivity: 1.15,
      dynamicAnchor: true,
      radius: 65,
      responseCurve: 'smooth',
      sprintThreshold: 0.84,
    }
  }
};

export const LOW_END_GRAPHICS: GraphicSettings = {
  resolutionScale: 0.75,
  targetFps: 30,
  shadows: 'off',
  bloom: false,
  particleDensity: 'low',
  lowEndMode: true,
};

export const BALANCED_GRAPHICS: GraphicSettings = {
  resolutionScale: 0.85,
  targetFps: 60,
  shadows: 'low',
  bloom: false,
  particleDensity: 'medium',
  lowEndMode: false,
};

export const ULTRA_GRAPHICS: GraphicSettings = {
  resolutionScale: 1.0,
  targetFps: 60,
  shadows: 'high',
  bloom: true,
  particleDensity: 'high',
  lowEndMode: false,
};

export const DEFAULT_GRAPHICS: GraphicSettings = (() => {
  if (typeof window !== 'undefined') {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth < 800 && 'ontouchstart' in window);
    const isLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory <= 3;
    const isLowConcurrency = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

    if (isMobile || isLowMemory || isLowConcurrency) {
      return { ...LOW_END_GRAPHICS };
    }
  }
  return { ...BALANCED_GRAPHICS };
})();

const STORAGE_KEY = 'ashen_realm_settings_v1';

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        joystick: { ...DEFAULT_JOYSTICK_CONFIG, ...(parsed.joystick || {}) },
        graphics: { ...DEFAULT_GRAPHICS, ...(parsed.graphics || {}) },
        modelConfig: { ...DEFAULT_MODEL_CALIBRATION, ...(parsed.modelConfig || {}) },
        musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : 0.6,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : 0.8,
        hapticEnabled: typeof parsed.hapticEnabled === 'boolean' ? parsed.hapticEnabled : true,
      };
    }
  } catch (e) {
    console.warn('Failed to load settings from storage', e);
  }
  return {
    joystick: { ...DEFAULT_JOYSTICK_CONFIG },
    graphics: { ...DEFAULT_GRAPHICS },
    modelConfig: { ...DEFAULT_MODEL_CALIBRATION },
    musicVolume: 0.6,
    sfxVolume: 0.8,
    hapticEnabled: true,
  };
}

export function saveGameSettings(settings: GameSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings to storage', e);
  }
}

export function triggerHaptic(duration = 20) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {}
  }
}
