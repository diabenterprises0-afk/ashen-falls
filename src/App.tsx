import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from './engine/GameEngine';
import { TouchJoystick } from './components/TouchJoystick';
import { CameraTouchZone } from './components/CameraTouchZone';
import { TouchCombatControls } from './components/TouchCombatControls';
import { GameHUD } from './components/GameHUD';
import { JoystickCalibrationModal } from './components/JoystickCalibrationModal';
import { AndroidDeploymentModal } from './components/AndroidDeploymentModal';
import { CharacterUploadModal } from './components/CharacterUploadModal';
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';
import {
  PlayerStats,
  ChapterQuest,
  EnemyEntity,
  FloatingText,
  JoystickConfig,
  GraphicSettings,
  ModelCalibrationConfig,
  CustomModelInfo,
} from './types/game';
import { loadGameSettings, saveGameSettings, triggerHaptic } from './utils/storage';
import { soundManager } from './utils/audio';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Settings
  const [settings, setSettings] = useState(() => loadGameSettings());
  const [isMuted, setIsMuted] = useState(false);

  // Live Game State
  const [stats, setStats] = useState<PlayerStats>({
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    runes: 50,
    potions: 4,
    maxPotions: 4,
    potionHealAmount: 45,
    level: 1,
    score: 0,
    comboCount: 0,
    comboMultiplier: 1.0,
    isInvulnerable: false,
    isParrying: false,
    isSprinting: false,
  });

  const [quest, setQuest] = useState<ChapterQuest>({
    chapter: 1,
    title: 'The Ruined Bastion',
    subtitle: 'Courtyard of Forgotten Ash',
    objective: 'Purge the Void Thralls invading the courtyard',
    requiredKills: 4,
    currentKills: 0,
    completed: false,
    bossAppeared: false,
  });

  const [boss, setBoss] = useState<EnemyEntity | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [fps, setFps] = useState(60);
  const [isLockedOn, setIsLockedOn] = useState(false);

  // Custom Character Model Info
  const [modelInfo, setModelInfo] = useState<CustomModelInfo>({
    isLoaded: false,
    name: 'Procedural Ashen Knight',
    source: 'procedural_default',
    hasAnimations: false,
    animationNames: [],
    meshCount: 14,
    vertexCount: 960,
    config: settings.modelConfig,
  });

  // Modals
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  // Initialize Game Engine
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new GameEngine(
      canvasContainerRef.current,
      {
        onStatsUpdate: newStats => setStats(newStats),
        onFloatingText: text => {
          setFloatingTexts(prev => [...prev.slice(-8), text]);
          setTimeout(() => {
            setFloatingTexts(prev => prev.filter(t => t.id !== text.id));
          }, text.duration);
        },
        onQuestUpdate: newQuest => setQuest(newQuest),
        onBossStateChange: b => setBoss(b),
        onGameOver: () => setIsGameOver(true),
        onVictory: () => setIsVictory(true),
        onFpsUpdate: currentFps => setFps(currentFps),
        onModelInfoUpdate: info => setModelInfo(info),
      },
      settings.joystick,
      settings.graphics,
      settings.modelConfig
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update engine configurations when settings change
  const handleSaveJoystickConfig = (newJoystickConfig: JoystickConfig) => {
    const newSettings = { ...settings, joystick: newJoystickConfig };
    setSettings(newSettings);
    saveGameSettings(newSettings);
    if (engineRef.current) {
      engineRef.current.joystickConfig = newJoystickConfig;
    }
  };

  const handleSaveGraphicsConfig = (newGraphics: GraphicSettings) => {
    const newSettings = { ...settings, graphics: newGraphics };
    setSettings(newSettings);
    saveGameSettings(newSettings);
    if (engineRef.current) {
      engineRef.current.graphicSettings = newGraphics;
    }
  };

  const handleSaveModelCalibration = (newConfig: ModelCalibrationConfig) => {
    const newSettings = { ...settings, modelConfig: newConfig };
    setSettings(newSettings);
    saveGameSettings(newSettings);
    if (engineRef.current) {
      engineRef.current.applyModelCalibration(newConfig);
    }
  };

  const handleUploadCharacterFile = async (file: File): Promise<boolean> => {
    if (!engineRef.current) return false;
    try {
      const buffer = await file.arrayBuffer();
      const success = await engineRef.current.loadGLBFromArrayBuffer(buffer, file.name);
      return success;
    } catch (e) {
      console.error('Failed to load uploaded character:', e);
      return false;
    }
  };

  const handleReloadFromFolder = async (): Promise<boolean> => {
    if (!engineRef.current) return false;
    return await engineRef.current.checkAndLoadDefaultGLB();
  };

  const handleResetCharacterToDefault = () => {
    if (engineRef.current) {
      engineRef.current.resetToDefaultKnight();
    }
  };

  // Joystick Input Handler
  const handleJoystickVector = useCallback(
    (vector: { x: number; y: number; magnitude: number }) => {
      if (engineRef.current) {
        engineRef.current.inputVector = vector;
      }
    },
    []
  );

  // Camera Orbit Handler
  const handleCameraRotate = useCallback((deltaYaw: number, deltaPitch: number) => {
    if (engineRef.current) {
      engineRef.current.cameraYaw += deltaYaw;
      engineRef.current.cameraPitch = Math.max(
        -0.45,
        Math.min(1.1, engineRef.current.cameraPitch + deltaPitch)
      );
    }
  }, []);

  // Keyboard Desktop Fallback Controls (WASD / Space / J / K / L / U / I / H)
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.code] = true;
      if (!engineRef.current) return;

      if (e.code === 'Space') {
        engineRef.current.triggerJump();
      } else if (e.code === 'KeyJ') {
        engineRef.current.triggerLightAttack();
      } else if (e.code === 'KeyE') {
        engineRef.current.triggerToggleSword();
      } else if (e.code === 'KeyC') {
        engineRef.current.toggleCrawl();
      } else if (e.code === 'KeyL') {
        if (engineRef.current.stats.isSwordEquipped) {
          engineRef.current.triggerSwordDash();
        } else {
          engineRef.current.triggerHeavyCleave();
        }
      } else if (e.code === 'KeyU') {
        engineRef.current.triggerRuneBurst();
      } else if (e.code === 'KeyK') {
        engineRef.current.triggerDodgeRoll();
      } else if (e.code === 'KeyI') {
        engineRef.current.triggerParry();
      } else if (e.code === 'KeyH') {
        engineRef.current.triggerHealPotion();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        engineRef.current.toggleLockOn();
        setIsLockedOn(!!engineRef.current.targetLockEnemy);
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        engineRef.current.toggleSprint();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
    };

    const keyLoop = setInterval(() => {
      if (!engineRef.current) return;
      let dx = 0;
      let dy = 0;

      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) dy += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) dy -= 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) dx += 1;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) dx -= 1;

      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        engineRef.current.inputVector = { x: dx / mag, y: dy / mag, magnitude: 1.0 };
      } else if (!keysPressed['TouchActive']) {
        // Only clear if no touch joystick is driving input
        if (engineRef.current.inputVector.magnitude > 0 && !engineRef.current.sprintToggled) {
          // let touch handler own it
        }
      }
    }, 16);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearInterval(keyLoop);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleRespawn = () => {
    setIsGameOver(false);
    if (engineRef.current) {
      engineRef.current.respawn();
    }
  };

  const handlePlayAgain = () => {
    setIsVictory(false);
    if (engineRef.current) {
      engineRef.current.stats.score = 0;
      engineRef.current.respawn();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-ashen-950 font-sans select-none touch-none">
      {/* 3D WebGL Canvas Layer */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Screen Division: Camera Look Touch Drag Zone (Covers screen background) */}
      <CameraTouchZone
        config={settings.joystick}
        onCameraRotate={handleCameraRotate}
        className="absolute inset-0 z-0"
      />

      {/* Heads-Up Display (Vitals, Quest, Menus, Boss HP) */}
      <GameHUD
        stats={stats}
        quest={quest}
        boss={boss}
        floatingTexts={floatingTexts}
        fps={fps}
        isMuted={isMuted}
        onToggleMute={() => {
          const muted = soundManager.toggleMute();
          setIsMuted(muted);
        }}
        onOpenCalibration={() => setShowCalibrationModal(true)}
        onOpenAndroidModal={() => setShowAndroidModal(true)}
        onOpenCharacterModal={() => setShowCharacterModal(true)}
      />

      {/* Interactive Calibrated Touch Joystick (Bottom Left Zone) */}
      <div
        className={`absolute bottom-0 z-20 pointer-events-none ${
          settings.joystick.leftHanded ? 'right-0' : 'left-0'
        } w-1/2 h-1/2`}
      >
        <TouchJoystick
          config={settings.joystick}
          onVectorChange={handleJoystickVector}
          className="w-full h-full"
        />
      </div>

      {/* Touch Combat Action Cluster (Bottom Right Zone) */}
      <div
        className={`absolute bottom-6 z-20 pointer-events-none ${
          settings.joystick.leftHanded ? 'left-6' : 'right-6'
        }`}
      >
        <TouchCombatControls
          stats={stats}
          isLockedOn={isLockedOn}
          onLightAttack={() => engineRef.current?.triggerLightAttack()}
          onHeavyCleave={() => engineRef.current?.triggerHeavyCleave()}
          onRuneBurst={() => engineRef.current?.triggerRuneBurst()}
          onDodgeRoll={() => engineRef.current?.triggerDodgeRoll()}
          onParry={() => engineRef.current?.triggerParry()}
          onJump={() => engineRef.current?.triggerJump()}
          onHealPotion={() => engineRef.current?.triggerHealPotion()}
          onToggleSprint={() => engineRef.current?.toggleSprint()}
          onToggleLockOn={() => {
            engineRef.current?.toggleLockOn();
            setIsLockedOn(!!engineRef.current?.targetLockEnemy);
          }}
          onQuickTurn={() => engineRef.current?.quickTurn180()}
          onToggleSword={() => engineRef.current?.triggerToggleSword()}
          onSwordDash={() => engineRef.current?.triggerSwordDash()}
          onToggleCrawl={() => engineRef.current?.toggleCrawl()}
        />
      </div>

      {/* Modals & Dialogs */}
      {showCalibrationModal && (
        <JoystickCalibrationModal
          config={settings.joystick}
          onSave={handleSaveJoystickConfig}
          onClose={() => setShowCalibrationModal(false)}
        />
      )}

      {showAndroidModal && (
        <AndroidDeploymentModal
          graphics={settings.graphics}
          onSaveGraphics={handleSaveGraphicsConfig}
          onClose={() => setShowAndroidModal(false)}
        />
      )}

      {showCharacterModal && (
        <CharacterUploadModal
          modelInfo={modelInfo}
          onUploadFile={handleUploadCharacterFile}
          onReloadFromFolder={handleReloadFromFolder}
          onSaveCalibration={handleSaveModelCalibration}
          onResetToDefault={handleResetCharacterToDefault}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

      {isGameOver && <GameOverModal score={stats.score} onRespawn={handleRespawn} />}

      {isVictory && <VictoryModal score={stats.score} onPlayAgain={handlePlayAgain} />}
    </div>
  );
};
export default App;
