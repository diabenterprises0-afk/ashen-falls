import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from './engine/GameEngine';
import { TouchJoystick } from './components/TouchJoystick';
import { CameraTouchZone } from './components/CameraTouchZone';
import { TouchCombatControls } from './components/TouchCombatControls';
import { GameHUD } from './components/GameHUD';
import { LoadingScreen } from './components/LoadingScreen';
import { MainMenu } from './components/MainMenu';
import { PauseMenu } from './components/PauseMenu';
import { PlayerSettingsModal } from './components/PlayerSettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';
import { AndroidDeploymentModal } from './components/AndroidDeploymentModal';
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
import { loadGameSettings, saveGameSettings } from './utils/storage';
import { soundManager } from './utils/audio';

type AppFlowState = 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // App Navigation Flow
  const [appFlow, setAppFlow] = useState<AppFlowState>('LOADING');
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Ashen Realm engine...');

  // Settings
  const [settings, setSettings] = useState(() => loadGameSettings());
  const [isMuted, setIsMuted] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);

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
  const [isLockedOn, setIsLockedOn] = useState(false);

  // Modals
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  // Initialize Game Engine
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    setLoadingProgress(25);
    setLoadingStatus('Building gothic cathedral courtyard and lighting...');

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
        onFpsUpdate: () => {},
        onModelInfoUpdate: () => {},
      },
      settings.joystick,
      settings.graphics,
      settings.modelConfig
    );

    engineRef.current = engine;
    engine.start();

    // Parallel Asset Loading System: Concurrent GLB & Texture streaming with CacheStorage
    setLoadingProgress(15);
    setLoadingStatus('Downloading textures and 3D assets in parallel...');

    engine
      .loadGameAssetsInParallel((pct, status) => {
        setLoadingProgress(pct);
        setLoadingStatus(status);
      })
      .then(() => {
        setLoadingProgress(100);
        setLoadingStatus('Ready to embark');
        setTimeout(() => {
          setAppFlow('MENU');
        }, 350);
      })
      .catch(err => {
        console.warn('Parallel loading encountered warning:', err);
        setLoadingProgress(100);
        setTimeout(() => {
          setAppFlow('MENU');
        }, 300);
      });

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Audio Toggle
  const handleToggleMute = useCallback(() => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  }, []);

  // Save Settings Handlers
  const handleSaveJoystickConfig = useCallback(
    (newJoystickConfig: JoystickConfig) => {
      const newSettings = { ...settings, joystick: newJoystickConfig };
      setSettings(newSettings);
      saveGameSettings(newSettings);
      if (engineRef.current) {
        engineRef.current.joystickConfig = newJoystickConfig;
      }
    },
    [settings]
  );

  const handleSaveGraphicsConfig = useCallback(
    (newGraphics: GraphicSettings) => {
      const newSettings = { ...settings, graphics: newGraphics };
      setSettings(newSettings);
      saveGameSettings(newSettings);
      if (engineRef.current) {
        engineRef.current.graphicSettings = newGraphics;
      }
    },
    [settings]
  );

  // Joystick Input Handler
  const handleJoystickVector = useCallback(
    (vector: { x: number; y: number; magnitude: number }) => {
      if (appFlow !== 'PLAYING') return;
      if (engineRef.current) {
        engineRef.current.inputVector = vector;
      }
    },
    [appFlow]
  );

  // Camera Orbit Handler
  const handleCameraRotate = useCallback(
    (deltaYaw: number, deltaPitch: number) => {
      if (appFlow !== 'PLAYING') return;
      if (engineRef.current) {
        engineRef.current.cameraYaw += deltaYaw;
        engineRef.current.cameraPitch = Math.max(
          -0.10,
          Math.min(0.82, engineRef.current.cameraPitch + deltaPitch)
        );
      }
    },
    [appFlow]
  );

  // Game Flow Controls
  const handleStartGame = useCallback(() => {
    setAppFlow('PLAYING');
    if (!isMuted) {
      soundManager.startAmbientMusic();
    }
  }, [isMuted]);

  const handleResumeGame = useCallback(() => {
    setAppFlow('PLAYING');
  }, []);

  const handleRestartChapter = useCallback(() => {
    setAppFlow('PLAYING');
    setIsGameOver(false);
    setIsVictory(false);
    if (engineRef.current) {
      engineRef.current.respawn();
    }
  }, []);

  const handleQuitToMainMenu = useCallback(() => {
    setAppFlow('MENU');
    setIsGameOver(false);
    setIsVictory(false);
    if (engineRef.current) {
      engineRef.current.respawn();
    }
  }, []);

  const handleRespawn = useCallback(() => {
    setIsGameOver(false);
    if (engineRef.current) {
      engineRef.current.respawn();
    }
  }, []);

  const handlePlayAgain = useCallback(() => {
    setIsVictory(false);
    if (engineRef.current) {
      engineRef.current.stats.score = 0;
      engineRef.current.respawn();
    }
  }, []);

  // Keyboard Desktop Fallback Controls (WASD / Space / J / K / L / U / I / H)
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (appFlow === 'PLAYING') {
          setAppFlow('PAUSED');
        } else if (appFlow === 'PAUSED') {
          setAppFlow('PLAYING');
        }
        return;
      }

      if (appFlow !== 'PLAYING') return;
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
      if (!engineRef.current || appFlow !== 'PLAYING') return;
      let dx = 0;
      let dy = 0;

      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) dy += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) dy -= 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) dx += 1;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) dx -= 1;

      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        engineRef.current.inputVector = { x: dx / mag, y: dy / mag, magnitude: 1.0 };
      }
    }, 16);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearInterval(keyLoop);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [appFlow]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-ashen-950 font-sans select-none touch-none">
      {/* 3D WebGL Canvas Layer (Runs persistently in background) */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Screen Division: Camera Look Touch Drag Zone (Active during gameplay) */}
      {appFlow === 'PLAYING' && (
        <CameraTouchZone
          config={settings.joystick}
          onCameraRotate={handleCameraRotate}
          className="absolute inset-0 z-0"
        />
      )}

      {/* Heads-Up Display (Vitals, Quest, Pause button, Boss HP) */}
      {appFlow === 'PLAYING' && (
        <GameHUD
          stats={stats}
          quest={quest}
          boss={boss}
          floatingTexts={floatingTexts}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenPause={() => setAppFlow('PAUSED')}
        />
      )}

      {/* Interactive Calibrated Touch Joystick (Bottom Left Zone) */}
      {appFlow === 'PLAYING' && (
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
      )}

      {/* Touch Combat Action Cluster (Bottom Right Zone) */}
      {appFlow === 'PLAYING' && (
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
      )}

      {/* Screen 1: Loading Screen */}
      {appFlow === 'LOADING' && (
        <LoadingScreen progress={loadingProgress} statusText={loadingStatus} />
      )}

      {/* Screen 2: Main Menu */}
      {appFlow === 'MENU' && (
        <MainMenu
          onPlay={handleStartGame}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenAndroidDeployment={() => setShowAndroidModal(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Screen 3: Pause Menu */}
      {appFlow === 'PAUSED' && (
        <PauseMenu
          onResume={handleResumeGame}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenAndroidDeployment={() => setShowAndroidModal(true)}
          onRestartChapter={handleRestartChapter}
          onQuitToMainMenu={handleQuitToMainMenu}
        />
      )}

      {/* Settings Modal (Accessible from Main Menu & Pause Menu) */}
      {showSettingsModal && (
        <PlayerSettingsModal
          graphics={settings.graphics}
          joystick={settings.joystick}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onUpdateGraphics={handleSaveGraphicsConfig}
          onUpdateJoystick={handleSaveJoystickConfig}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Android Deployment & Optimization Modal */}
      {showAndroidModal && (
        <AndroidDeploymentModal
          graphics={settings.graphics}
          onSaveGraphics={handleSaveGraphicsConfig}
          onClose={() => setShowAndroidModal(false)}
        />
      )}

      {/* Game Over Screen */}
      {isGameOver && <GameOverModal score={stats.score} onRespawn={handleRespawn} />}

      {/* Victory Screen */}
      {isVictory && <VictoryModal score={stats.score} onPlayAgain={handlePlayAgain} />}
    </div>
  );
};

export default App;
