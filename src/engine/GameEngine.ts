import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ActionState,
  EnemyEntity,
  FloatingText,
  JoystickConfig,
  GraphicSettings,
  PlayerStats,
  ChapterQuest,
  ModelCalibrationConfig,
  CustomModelInfo,
} from '../types/game';
import { soundManager } from '../utils/audio';
import { triggerHaptic } from '../utils/storage';
import { parallelAssetLoader, LoadedGameAssets } from './ParallelAssetLoader';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onFloatingText: (text: FloatingText) => void;
  onQuestUpdate: (quest: ChapterQuest) => void;
  onBossStateChange: (boss: EnemyEntity | null) => void;
  onGameOver: () => void;
  onVictory: () => void;
  onFpsUpdate: (fps: number) => void;
  onModelInfoUpdate?: (info: CustomModelInfo) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private isRunning = false;
  private animationFrameId: number | null = null;

  // Camera Orbit Control state
  public cameraYaw = 0; // Horizontal orbit around player
  public cameraPitch = 0.25; // Vertical angle (radians)
  public cameraDistance = 7.5;
  public targetLockEnemy: EnemyEntity | null = null;

  // Player state
  public playerPosition = new THREE.Vector3(0, 0, 0);
  public playerVelocity = new THREE.Vector3(0, 0, 0);
  public playerRotationY = 0;
  public playerAction: ActionState = 'IDLE';
  public actionTimer = 0;
  public playerVy = 0; // vertical velocity for jump & gravity
  public isGrounded = true;
  public comboStep = 0;
  public comboWindowTimer = 0;
  public parryTimer = 0;

  // Ash Animation & State Machine Properties
  public isSwordEquipped = false;
  public swordDrawnMesh: THREE.Object3D | null = null;
  public swordSheathedMesh: THREE.Object3D | null = null;

  public isDead = false;
  public isDodging = false;
  public dodgeTimer = 0;
  public dodgeCooldownTimer = 0;

  public isHitStunned = false;
  public hitStunTimer = 0;

  public isJumping = false;
  public isDoubleJumping = false;
  public doubleJumpAvailable = true;
  public isLanding = false;
  public landingTimer = 0;

  public isAttacking = false;
  public activeAttackClipName = '';
  public attackAnimTime = 0;
  public attackAnimDuration = 0;
  public comboWindowStart = 0;
  public comboWindowEnd = 0;
  public inputBufferAttack = false;
  public comboAdvanced = false;
  public unarmedComboStep = 0;

  public isDrawingSword = false;
  public swordDashCooldownTimer = 0;
  public isSwordDashing = false;

  public isCrawlInputActive = false;
  public currentAshClipName = '';
  public primaryAnimState: string = 'IDLE';

  public stats: PlayerStats = {
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
  };

  public currentQuest: ChapterQuest = {
    chapter: 1,
    title: 'The Ruined Bastion',
    subtitle: 'Courtyard of Forgotten Ash',
    objective: 'Purge the Void Thralls invading the courtyard',
    requiredKills: 4,
    currentKills: 0,
    completed: false,
    bossAppeared: false,
  };

  // Joystick Input Vector
  public inputVector = { x: 0, y: 0, magnitude: 0 };
  public sprintToggled = false;

  // 3D Visual Objects
  private playerGroup!: THREE.Group;
  private proceduralKnightGroup!: THREE.Group;
  private playerTorso!: THREE.Mesh;
  private playerHead!: THREE.Mesh;
  private playerVisorGlow!: THREE.Mesh;
  private playerSword!: THREE.Group;
  private playerSwordBlade!: THREE.Mesh;
  private playerShield!: THREE.Mesh;
  private playerCape!: THREE.Mesh;
  private playerLeftArm!: THREE.Group;
  private playerRightArm!: THREE.Group;
  private playerLeftLeg!: THREE.Group;
  private playerRightLeg!: THREE.Group;
  private slashTrailMesh!: THREE.Mesh;

  // Custom GLB Model & Animations
  public modelConfig: ModelCalibrationConfig;
  public customModelInfo: CustomModelInfo;
  private customModelGroup: THREE.Group | null = null;
  private animationMixer: THREE.AnimationMixer | null = null;
  private animationActions: Map<string, THREE.AnimationAction> = new Map();
  private actionClipMap: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimationAction: THREE.AnimationAction | null = null;
  private prevPlayerAction: ActionState = 'IDLE';
  private gltfLoader = new GLTFLoader();

  // Material references for parallel texture streaming
  private groundMat: THREE.MeshStandardMaterial | null = null;
  private wallMat: THREE.MeshStandardMaterial | null = null;
  private stoneMat: THREE.MeshStandardMaterial | null = null;
  private circleMat: THREE.MeshBasicMaterial | null = null;
  private loadedAssets: LoadedGameAssets | null = null;

  // World objects
  private braziers: { light: THREE.PointLight; mesh: THREE.Group; x: number; z: number }[] = [];
  private enemies: EnemyEntity[] = [];
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    color: THREE.Color;
    size: number;
  }[] = [];

  // Static Collision Obstacles (Pillars, Braziers)
  private arenaObstacles: { x: number; z: number; radius: number }[] = [];

  // Smooth Camera Vectors
  private smoothedCamPos = new THREE.Vector3(0, 4, 8);
  private smoothedCamTarget = new THREE.Vector3(0, 1.5, 0);

  // Configs
  public joystickConfig: JoystickConfig;
  public graphicSettings: GraphicSettings;

  // FPS tracking
  private frameCount = 0;
  private lastFpsTime = 0;

  constructor(
    container: HTMLElement,
    callbacks: GameEngineCallbacks,
    joystickConfig: JoystickConfig,
    graphics: GraphicSettings,
    modelConfig: ModelCalibrationConfig = {
      scaleMultiplier: 1.0,
      yOffset: 0.0,
      rotationOffsetY: 0,
      castShadows: true,
      useEmbeddedAnimations: true,
    }
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.joystickConfig = joystickConfig;
    this.graphicSettings = graphics;
    this.modelConfig = modelConfig;

    this.customModelInfo = {
      isLoaded: false,
      name: 'Procedural Ashen Knight',
      source: 'procedural_default',
      hasAnimations: false,
      animationNames: [],
      meshCount: 14,
      vertexCount: 960,
      config: { ...modelConfig },
    };

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0f1a);
    this.scene.fog = new THREE.FogExp2(0x0d0f1a, 0.016);

    // 2. Camera Setup
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 140);
    this.camera.position.set(0, 4, 8);
    this.smoothedCamPos.set(0, 4, 8);
    this.smoothedCamTarget.set(0, 1.5, 0);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: graphics.resolutionScale >= 1.0,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, Math.max(1.0, graphics.resolutionScale * 1.5)));
    this.renderer.shadowMap.enabled = graphics.shadows !== 'off';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Attach to DOM
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // 4. Build Environment & Player
    this.buildWorld();
    this.playerGroup = this.buildPlayerModel();
    this.slashTrailMesh = this.buildSlashTrail();
    this.scene.add(this.playerGroup);
    this.scene.add(this.slashTrailMesh);

    // 5. Spawn Chapter 1 Enemies
    this.spawnChapterEnemies(1);

    // 6. Handle Window Resizing
    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private buildWorld() {
    // 1. Procedural Environment Map for PBR Specular Reflections (avoids black metals)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x141829);

      const envLight1 = new THREE.DirectionalLight(0xa0c0ff, 2.0);
      envLight1.position.set(1, 2, 1);
      envScene.add(envLight1);

      const envLight2 = new THREE.DirectionalLight(0xffa060, 1.2);
      envLight2.position.set(-1, -1, -1);
      envScene.add(envLight2);

      const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
      this.scene.environment = envTexture;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('Failed to build PMREM environment:', e);
    }

    // 2. Hemisphere Ambient Light - balanced moonlight sky & dark earth ground
    const hemiLight = new THREE.HemisphereLight(0x9cb4d8, 0x241e34, 1.35);
    this.scene.add(hemiLight);

    // 3. Directional Key Light (Moonlight)
    const keyLight = new THREE.DirectionalLight(0xffeedb, 1.45);
    keyLight.position.set(18, 32, 18);
    if (this.graphicSettings.shadows !== 'off') {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 75;
      keyLight.shadow.camera.left = -24;
      keyLight.shadow.camera.right = 24;
      keyLight.shadow.camera.top = 24;
      keyLight.shadow.camera.bottom = -24;
      keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(keyLight);

    // 4. Directional Rim / Fill Light (Soft cool contrast)
    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    fillLight.position.set(-18, 22, -18);
    this.scene.add(fillLight);

    // 5. Ground Floor: Flagstone arena
    const groundGeo = new THREE.PlaneGeometry(80, 80, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x23253a,
      roughness: 0.75,
      metalness: 0.2,
    });
    this.groundMat = groundMat;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = this.graphicSettings.shadows !== 'off';
    this.scene.add(ground);

    // Courtyard runic rings
    const circleGeo = new THREE.RingGeometry(0.2, 14, 48);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    this.circleMat = circleMat;
    const ringMesh = new THREE.Mesh(circleGeo, circleMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    this.scene.add(ringMesh);

    const outerRingGeo = new THREE.RingGeometry(18.5, 19.2, 48);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.02;
    this.scene.add(outerRing);

    // Clear obstacles array
    this.arenaObstacles = [];

    // 6. Perimeter Cathedral Pillars & Gothic Buttresses
    const pillarGeo = new THREE.CylinderGeometry(0.7, 0.9, 9, 8);
    const pillarCapGeo = new THREE.BoxGeometry(2.2, 0.6, 2.2);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x2a243e,
      roughness: 0.85,
      metalness: 0.15,
    });
    this.stoneMat = stoneMat;

    const pillarPositions = [
      [-16, -16], [0, -18], [16, -16],
      [-18, 0], [18, 0],
      [-16, 16], [0, 18], [16, 16],
      [-8, -10], [8, -10], [-8, 10], [8, 10]
    ];

    pillarPositions.forEach(([px, pz]) => {
      const pillarGroup = new THREE.Group();
      const pMesh = new THREE.Mesh(pillarGeo, stoneMat);
      pMesh.position.y = 4.5;
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      pillarGroup.add(pMesh);

      const cap = new THREE.Mesh(pillarCapGeo, stoneMat);
      cap.position.y = 9;
      cap.castShadow = true;
      pillarGroup.add(cap);

      pillarGroup.position.set(px, 0, pz);
      this.scene.add(pillarGroup);

      // Register collision capsule (pillar radius 0.8 + player capsule 0.45)
      this.arenaObstacles.push({ x: px, z: pz, radius: 1.25 });
    });

    // 7. Boundary Ruined Walls (North, South, East, West)
    const wallGeoH = new THREE.BoxGeometry(44, 5, 1.5);
    const wallGeoV = new THREE.BoxGeometry(1.5, 5, 44);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1d192f, roughness: 0.9 });
    this.wallMat = wallMat;

    const wallNorth = new THREE.Mesh(wallGeoH, wallMat);
    wallNorth.position.set(0, 2.5, -22);
    wallNorth.castShadow = true;
    this.scene.add(wallNorth);

    const wallSouth = new THREE.Mesh(wallGeoH, wallMat);
    wallSouth.position.set(0, 2.5, 22);
    wallSouth.castShadow = true;
    this.scene.add(wallSouth);

    const wallWest = new THREE.Mesh(wallGeoV, wallMat);
    wallWest.position.set(-22, 2.5, 0);
    wallWest.castShadow = true;
    this.scene.add(wallWest);

    const wallEast = new THREE.Mesh(wallGeoV, wallMat);
    wallEast.position.set(22, 2.5, 0);
    wallEast.castShadow = true;
    this.scene.add(wallEast);

    // 8. Braziers with dynamic glowing fire
    const brazierPositions = [
      [-10, -10], [10, -10],
      [-10, 10], [10, 10],
      [0, -14], [0, 14]
    ];

    brazierPositions.forEach(([bx, bz]) => {
      const bGroup = new THREE.Group();
      const standGeo = new THREE.CylinderGeometry(0.35, 0.55, 1.8, 8);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x362c4a, metalness: 0.6, roughness: 0.4 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.y = 0.9;
      stand.castShadow = true;
      bGroup.add(stand);

      // Bowl
      const bowlGeo = new THREE.CylinderGeometry(0.85, 0.4, 0.5, 8);
      const bowlMat = new THREE.MeshStandardMaterial({ color: 0x272036, metalness: 0.8, roughness: 0.3 });
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.y = 1.9;
      bGroup.add(bowl);

      // Flame Core
      const flameGeo = new THREE.SphereGeometry(0.4, 8, 8);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7043 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 2.2;
      bGroup.add(flame);

      // Point Light
      const fireLight = new THREE.PointLight(0xff6838, 2.4, 16, 1.6);
      fireLight.position.set(0, 2.3, 0);
      bGroup.add(fireLight);

      bGroup.position.set(bx, 0, bz);
      this.scene.add(bGroup);

      this.braziers.push({ light: fireLight, mesh: bGroup, x: bx, z: bz });

      // Register collision capsule (brazier radius 0.6 + player capsule 0.45)
      this.arenaObstacles.push({ x: bx, z: bz, radius: 1.05 });
    });
  }

  // Procedural Articulated 3D Player Knight
  private buildPlayerModel(): THREE.Group {
    const group = new THREE.Group();
    this.proceduralKnightGroup = new THREE.Group();

    // Dark steel & gold trimmed armor materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x221e33,
      metalness: 0.85,
      roughness: 0.25,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xdfa038,
      metalness: 0.9,
      roughness: 0.2,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x110f1a,
      roughness: 0.8,
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.85, 1.0, 0.55);
    this.playerTorso = new THREE.Mesh(torsoGeo, armorMat);
    this.playerTorso.position.y = 1.55;
    this.playerTorso.castShadow = true;
    this.proceduralKnightGroup.add(this.playerTorso);

    // Torso gold trim crest
    const crestGeo = new THREE.BoxGeometry(0.3, 0.5, 0.58);
    const crest = new THREE.Mesh(crestGeo, goldTrimMat);
    this.playerTorso.add(crest);

    // 2. Head / Helmet
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.playerHead = new THREE.Mesh(headGeo, armorMat);
    this.playerHead.position.set(0, 0.8, 0);
    this.playerHead.castShadow = true;
    this.playerTorso.add(this.playerHead);

    // Glowing cyan visor eye-slit
    const visorGeo = new THREE.BoxGeometry(0.42, 0.09, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    this.playerVisorGlow = new THREE.Mesh(visorGeo, visorMat);
    this.playerVisorGlow.position.set(0, 0.04, 0.26);
    this.playerHead.add(this.playerVisorGlow);

    // Horns / Helmet Plumes
    const hornGeo = new THREE.ConeGeometry(0.08, 0.45, 5);
    const hornL = new THREE.Mesh(hornGeo, goldTrimMat);
    hornL.rotation.z = 0.5;
    hornL.position.set(-0.3, 0.25, 0);
    this.playerHead.add(hornL);

    const hornR = new THREE.Mesh(hornGeo, goldTrimMat);
    hornR.rotation.z = -0.5;
    hornR.position.set(0.3, 0.25, 0);
    this.playerHead.add(hornR);

    // 3. Pauldrons (Shoulders)
    const pauldronGeo = new THREE.BoxGeometry(0.45, 0.35, 0.45);
    const pauldronL = new THREE.Mesh(pauldronGeo, goldTrimMat);
    pauldronL.position.set(-0.6, 0.35, 0);
    this.playerTorso.add(pauldronL);

    const pauldronR = new THREE.Mesh(pauldronGeo, goldTrimMat);
    pauldronR.position.set(0.6, 0.35, 0);
    this.playerTorso.add(pauldronR);

    // 4. Flowing Cape
    const capeGeo = new THREE.PlaneGeometry(0.8, 1.4, 4, 4);
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x3b1c4a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    this.playerCape = new THREE.Mesh(capeGeo, capeMat);
    this.playerCape.position.set(0, 0.3, -0.32);
    this.playerCape.rotation.x = 0.15;
    this.playerTorso.add(this.playerCape);

    // 5. Left Arm & Kite Shield
    this.playerLeftArm = new THREE.Group();
    this.playerLeftArm.position.set(-0.55, 0.3, 0);
    const armGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    const armL = new THREE.Mesh(armGeo, armorMat);
    armL.position.y = -0.35;
    this.playerLeftArm.add(armL);

    // Shield
    const shieldGeo = new THREE.BoxGeometry(0.6, 0.9, 0.12);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x1e192c,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.playerShield = new THREE.Mesh(shieldGeo, shieldMat);
    this.playerShield.position.set(-0.15, -0.35, 0.2);
    this.playerShield.castShadow = true;
    const shieldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.94, 0.05), goldTrimMat);
    this.playerShield.add(shieldTrim);
    this.playerLeftArm.add(this.playerShield);
    this.playerTorso.add(this.playerLeftArm);

    // 6. Right Arm & Runic Greatsword
    this.playerRightArm = new THREE.Group();
    this.playerRightArm.position.set(0.55, 0.3, 0);
    const armR = new THREE.Mesh(armGeo, armorMat);
    armR.position.y = -0.35;
    this.playerRightArm.add(armR);

    // Runic Greatsword
    this.playerSword = new THREE.Group();
    this.playerSword.position.set(0.1, -0.65, 0.2);

    const bladeGeo = new THREE.BoxGeometry(0.16, 1.7, 0.06);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      metalness: 0.95,
      roughness: 0.1,
    });
    this.playerSwordBlade = new THREE.Mesh(bladeGeo, bladeMat);
    this.playerSwordBlade.position.y = 0.85;
    this.playerSwordBlade.castShadow = true;
    this.playerSword.add(this.playerSwordBlade);

    // Emissive Cyan Rune Inlay on Sword
    const runeInlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.3, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    runeInlay.position.y = 0.85;
    this.playerSwordBlade.add(runeInlay);

    // Sword Crossguard & Pommel
    const guardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.14), goldTrimMat);
    this.playerSword.add(guardMesh);
    const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35), jointMat);
    handleMesh.position.y = -0.2;
    this.playerSword.add(handleMesh);
    const pommelMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), goldTrimMat);
    pommelMesh.position.y = -0.4;
    this.playerSword.add(pommelMesh);

    this.playerRightArm.add(this.playerSword);
    this.playerTorso.add(this.playerRightArm);

    // 7. Legs & Boots
    const legGeo = new THREE.BoxGeometry(0.3, 0.85, 0.32);

    this.playerLeftLeg = new THREE.Group();
    this.playerLeftLeg.position.set(-0.25, 0.95, 0);
    const legL = new THREE.Mesh(legGeo, armorMat);
    legL.position.y = -0.42;
    legL.castShadow = true;
    this.playerLeftLeg.add(legL);
    this.proceduralKnightGroup.add(this.playerLeftLeg);

    this.playerRightLeg = new THREE.Group();
    this.playerRightLeg.position.set(0.25, 0.95, 0);
    const legR = new THREE.Mesh(legGeo, armorMat);
    legR.position.y = -0.42;
    legR.castShadow = true;
    this.playerRightLeg.add(legR);
    this.proceduralKnightGroup.add(this.playerRightLeg);

    group.add(this.proceduralKnightGroup);
    return group;
  }

  // 3D Sword Arc Slash Ribbon
  private buildSlashTrail(): THREE.Mesh {
    const geo = new THREE.RingGeometry(1.2, 2.4, 24, 1, 0, Math.PI * 0.85);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 1.4;
    return mesh;
  }

  // Parallel Asset Loading System: Downloads textures and GLB files concurrently with Cache API
  public async loadGameAssetsInParallel(
    onProgress?: (percent: number, statusText: string) => void
  ): Promise<boolean> {
    try {
      const assets = await parallelAssetLoader.loadAll(prog => {
        onProgress?.(prog.percent, prog.statusText);
      });
      this.loadedAssets = assets;

      // 1. Apply textures to world materials
      if (assets.textures) {
        if (this.groundMat) {
          this.groundMat.map = assets.textures.stoneFloorDiffuse;
          this.groundMat.normalMap = assets.textures.stoneFloorNormal;
          this.groundMat.normalScale.set(0.6, 0.6);
          this.groundMat.needsUpdate = true;
        }
        if (this.wallMat) {
          this.wallMat.map = assets.textures.wallStoneDiffuse;
          this.wallMat.needsUpdate = true;
        }
        if (this.stoneMat) {
          this.stoneMat.map = assets.textures.pillarStoneDiffuse;
          this.stoneMat.needsUpdate = true;
        }
        if (this.circleMat) {
          this.circleMat.map = assets.textures.runicGlyphs;
          this.circleMat.needsUpdate = true;
        }
      }

      // 2. Mount hero GLB if buffer was downloaded
      if (assets.heroGlbBuffer) {
        onProgress?.(98, 'Parsing 3D hero skeleton and animations...');
        await new Promise<void>(resolve => {
          this.gltfLoader.parse(
            assets.heroGlbBuffer!,
            '',
            gltf => {
              this.setupGLTFModel(gltf, 'Ash.glb', 'static_url');
              resolve();
            },
            error => {
              console.warn('Failed to parse parallel GLB buffer:', error);
              resolve();
            }
          );
        });
      } else {
        // Fallback candidate probe if buffer was null
        await this.checkAndLoadDefaultGLB(onProgress);
      }

      // 3. Pre-compile WebGL shaders on GPU to eliminate frame drops on Android
      onProgress?.(100, 'Pre-compiling GPU shaders for Android...');
      this.renderer.compile(this.scene, this.camera);

      return true;
    } catch (err) {
      console.warn('Parallel asset loading error, falling back:', err);
      return this.checkAndLoadDefaultGLB(onProgress);
    }
  }

  // Probe and load default /models/Ash.glb (or fallback character paths)
  public async checkAndLoadDefaultGLB(onProgress?: (percent: number, statusText: string) => void): Promise<boolean> {
    const candidatePaths = [
      '/models/Ash.glb',
      '/models/ash.glb',
      '/public/models/Ash.glb',
      '/assets/characters/Ash.glb',
      '/assets/characters/player.glb',
      '/assets/characters/Player.glb',
      '/assets/characters/character.glb',
    ];

    for (const path of candidatePaths) {
      try {
        const loaded = await this.loadGLBFromURL(path, path.split('/').pop() || 'Ash.glb', onProgress);
        if (loaded) return true;
      } catch (e) {
        // Continue searching candidates
      }
    }
    return false;
  }

  // Load GLB from URL (e.g. static assets)
  public async loadGLBFromURL(
    url: string,
    fileName = 'player.glb',
    onProgress?: (percent: number, statusText: string) => void
  ): Promise<boolean> {
    return new Promise(resolve => {
      this.gltfLoader.load(
        url,
        gltf => {
          this.setupGLTFModel(gltf, fileName, 'static_url');
          onProgress?.(100, 'Hero Model Loaded');
          resolve(true);
        },
        xhr => {
          if (xhr.lengthComputable && xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            const mbLoaded = (xhr.loaded / (1024 * 1024)).toFixed(1);
            const mbTotal = (xhr.total / (1024 * 1024)).toFixed(1);
            onProgress?.(pct, `Loading Hero 3D Assets (${mbLoaded} MB / ${mbTotal} MB)...`);
          } else {
            onProgress?.(50, 'Downloading Hero 3D Assets...');
          }
        },
        error => {
          console.warn('Failed to load GLB from candidate url:', url, error);
          resolve(false);
        }
      );
    });
  }

  // Load GLB from raw ArrayBuffer (from drag-and-drop or file upload)
  public async loadGLBFromArrayBuffer(buffer: ArrayBuffer, fileName = 'custom_character.glb'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.parse(
        buffer,
        '',
        gltf => {
          this.setupGLTFModel(gltf, fileName, 'file');
          resolve(true);
        },
        error => {
          console.error('Failed to parse uploaded GLB array buffer:', error);
          reject(error);
        }
      );
    });
  }

  // Parse and mount GLTF character into the player hierarchy
  private setupGLTFModel(gltf: any, name: string, source: 'file' | 'static_url') {
    // 1. Remove old custom model if present
    if (this.customModelGroup) {
      this.playerGroup.remove(this.customModelGroup);
      this.customModelGroup = null;
    }

    // 2. Hide procedural knight
    this.proceduralKnightGroup.visible = false;

    // 3. Create fresh wrapper group
    this.customModelGroup = new THREE.Group();
    const model = gltf.scene;

    // Compute bounding box for auto-scaling and auto-grounding
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    // Standard target character height is 1.95 units
    const targetHeight = 1.95;
    const baseScale = size.y > 0.001 ? targetHeight / size.y : 1.0;

    // Center and ground the model so feet are at y = 0
    model.position.set(-center.x * baseScale, -bbox.min.y * baseScale, -center.z * baseScale);
    model.scale.set(baseScale, baseScale, baseScale);

    let meshCount = 0;
    let vertexCount = 0;

    // Detect bone sockets for models with weapon systems (like Ash.glb)
    let rightHandBone: THREE.Object3D | null = null;
    let hipsBone: THREE.Object3D | null = null;
    let swordHandSocket: THREE.Object3D | null = null;
    let swordSheathSocket: THREE.Object3D | null = null;
    let swordDrawn: THREE.Object3D | null = null;
    let swordSheathed: THREE.Object3D | null = null;

    model.traverse((child: any) => {
      if (child.name === 'RightHand') rightHandBone = child;
      if (child.name === 'Hips') hipsBone = child;
      if (child.name === 'SwordHandSocket') swordHandSocket = child;
      if (child.name === 'SwordSheathSocket') swordSheathSocket = child;
      if (child.name === 'Sword_Drawn') swordDrawn = child;
      if (child.name === 'Sword_Sheathed') swordSheathed = child;

      if (child.isMesh) {
        meshCount++;
        if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
          vertexCount += child.geometry.attributes.position.count;
        }
        child.castShadow = this.modelConfig.castShadows;
        child.receiveShadow = true;
        child.frustumCulled = true;

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.side = THREE.DoubleSide;
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
          if (mat.emissiveMap) {
            mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            mat.emissiveMap.needsUpdate = true;
          }
          if (mat.roughness !== undefined && mat.roughness < 0.2) {
            mat.roughness = 0.25;
          }
          mat.envMapIntensity = 1.25;
          mat.needsUpdate = true;
        }
      }
    });

    // Parent sword to RightHand bone and sheath to Hips bone if specified in model
    if (rightHandBone && swordHandSocket) {
      (rightHandBone as THREE.Object3D).add(swordHandSocket);
    }
    if (hipsBone && swordSheathSocket) {
      (hipsBone as THREE.Object3D).add(swordSheathSocket);
    }
    this.swordDrawnMesh = swordDrawn;
    this.swordSheathedMesh = swordSheathed;

    // Initially unarmed as required: sword in sheath on hips, hands free for punches
    const drawn = this.swordDrawnMesh as any;
    const sheathed = this.swordSheathedMesh as any;
    if (drawn) drawn.visible = this.isSwordEquipped;
    if (sheathed) sheathed.visible = !this.isSwordEquipped;

    // 4. Setup Skeletal Animation Mixer if animations exist
    const animNames: string[] = [];
    this.animationActions.clear();
    this.actionClipMap.clear();

    if (gltf.animations && gltf.animations.length > 0) {
      this.animationMixer = new THREE.AnimationMixer(model);

      gltf.animations.forEach((clip: THREE.AnimationClip) => {
        animNames.push(clip.name);
        const action = this.animationMixer!.clipAction(clip);
        this.animationActions.set(clip.name, action);

        // Loop and Clamping rules
        if (
          clip.name === 'Idle' ||
          clip.name === 'Walk (mocap)' ||
          clip.name === 'Sprint' ||
          clip.name === 'Crawl Backward'
        ) {
          action.loop = THREE.LoopRepeat;
          action.clampWhenFinished = false;
        } else {
          action.loop = THREE.LoopOnce;
          action.clampWhenFinished = true;
        }

        // Action-specific playback speeds for responsiveness
        if (clip.name === 'Idle') action.timeScale = 1.0;
        else if (clip.name === 'Walk (mocap)') action.timeScale = 1.1;
        else if (clip.name === 'Sprint') action.timeScale = 1.15;
        else if (clip.name === 'Jump Start') action.timeScale = 1.8;
        else if (clip.name === 'Jump Land') action.timeScale = 2.2;
        else if (clip.name === 'Ninja Jump Double') action.timeScale = 1.8;
        else if (clip.name === 'Punch (jab)') action.timeScale = 1.8;
        else if (clip.name === 'Punch (cross)') action.timeScale = 1.8;
        else if (clip.name === 'Kick') action.timeScale = 1.8;
        else if (clip.name.startsWith('Jumping spinning kick')) action.timeScale = 2.4;
        else if (clip.name === 'Sword Enter') action.timeScale = 1.6;
        else if (clip.name === 'Sword Attack') action.timeScale = 2.2;
        else if (clip.name === 'Sword Aerial Combo') action.timeScale = 1.7;
        else if (clip.name === 'Sword Dash Root Motion') action.timeScale = 2.0;
        else if (clip.name === 'Hit Stomach') action.timeScale = 1.8;
        else if (clip.name === 'Death') action.timeScale = 1.0;
        else if (clip.name === 'Crawl Backward') action.timeScale = 1.3;
      });

      // Register friendly aliases for spinning kick
      const spinKick = this.animationActions.get('Jumping spinning kick (c0a12a) (in place)');
      if (spinKick) {
        this.animationActions.set('Jumping spinning kick (in place)', spinKick);
        this.animationActions.set('Jumping spinning kick', spinKick);
      }

      // Hook animation mixer completion listener
      this.animationMixer.addEventListener('finished', (e: any) => {
        const finishedClipName = e.action?.getClip()?.name || '';
        this.handleAnimationFinished(finishedClipName);
      });

      const initialAction = this.animationActions.get('Idle') || this.animationActions.values().next().value;
      if (initialAction) {
        initialAction.play();
        this.currentAnimationAction = initialAction;
        this.currentAshClipName = 'Idle';
      }
    } else {
      this.animationMixer = null;
    }

    this.customModelGroup.add(model);
    this.playerGroup.add(this.customModelGroup);
    this.applyModelCalibration(this.modelConfig);

    this.customModelInfo = {
      isLoaded: true,
      name,
      source,
      hasAnimations: animNames.length > 0,
      animationNames: animNames,
      meshCount,
      vertexCount,
      config: { ...this.modelConfig },
    };

    this.callbacks.onModelInfoUpdate?.(this.customModelInfo);
    this.callbacks.onFloatingText({
      id: `model_${Date.now()}`,
      text: `3D HERO LOADED: ${name}`,
      x: this.playerPosition.x,
      y: this.playerPosition.y + 2.2,
      z: this.playerPosition.z,
      color: '#22d3ee',
      createdAt: Date.now(),
      duration: 1800,
      scale: 1.25,
    });
  }

  // Update Model Scale, Ground Y-Offset, and Facing Angle
  public applyModelCalibration(config: ModelCalibrationConfig) {
    this.modelConfig = { ...config };
    this.customModelInfo.config = { ...config };

    if (this.customModelGroup) {
      this.customModelGroup.scale.set(config.scaleMultiplier, config.scaleMultiplier, config.scaleMultiplier);
      this.customModelGroup.position.y = config.yOffset;
      this.customModelGroup.rotation.y = (config.rotationOffsetY * Math.PI) / 180;
    }
  }

  // Reset to default procedural knight
  public resetToDefaultKnight() {
    if (this.customModelGroup) {
      this.playerGroup.remove(this.customModelGroup);
      this.customModelGroup = null;
    }
    this.animationMixer = null;
    this.proceduralKnightGroup.visible = true;

    this.customModelInfo = {
      isLoaded: false,
      name: 'Procedural Ashen Knight',
      source: 'procedural_default',
      hasAnimations: false,
      animationNames: [],
      meshCount: 14,
      vertexCount: 960,
      config: { ...this.modelConfig },
    };

    this.callbacks.onModelInfoUpdate?.(this.customModelInfo);
  }

  // Spawns enemies according to chapter progression
  public spawnChapterEnemies(chapter: number) {
    // Clear old meshes
    this.enemyMeshes.forEach(mesh => this.scene.remove(mesh));
    this.enemyMeshes.clear();
    this.enemies = [];

    if (chapter === 1) {
      this.currentQuest = {
        chapter: 1,
        title: 'The Ruined Bastion',
        subtitle: 'Courtyard of Forgotten Ash',
        objective: 'Purge the Void Thralls invading the courtyard',
        requiredKills: 4,
        currentKills: 0,
        completed: false,
        bossAppeared: false,
      };

      const spawnPoints = [
        { x: -8, z: -8 },
        { x: 8, z: -8 },
        { x: -9, z: 7 },
        { x: 9, z: 8 },
      ];

      spawnPoints.forEach((pos, idx) => {
        const id = `thrall_${idx + 1}`;
        const enemy: EnemyEntity = {
          id,
          type: 'VOID_THRALL',
          name: `Void Thrall #${idx + 1}`,
          x: pos.x,
          y: 0,
          z: pos.z,
          rotationY: Math.random() * Math.PI * 2,
          hp: 45,
          maxHp: 45,
          state: 'IDLE',
          attackTimer: 0,
          staggerTimer: 0,
        };
        this.enemies.push(enemy);
        this.createEnemyMesh(enemy);
      });
    } else if (chapter === 2) {
      this.currentQuest = {
        chapter: 2,
        title: 'The Hall of Cinders',
        subtitle: 'Inner Gate Garrison',
        objective: 'Defeat the Corrupted Ashen Knights guarding the sanctum',
        requiredKills: 3,
        currentKills: 0,
        completed: false,
        bossAppeared: false,
      };

      const guards = [
        { x: -6, z: -10, type: 'CORRUPTED_GUARD' as const, name: 'Ashen Defender Vael' },
        { x: 6, z: -10, type: 'CORRUPTED_GUARD' as const, name: 'Ashen Defender Korin' },
        { x: 0, z: -15, type: 'CORRUPTED_GUARD' as const, name: 'Corrupted Gatekeeper' },
      ];

      guards.forEach((g, idx) => {
        const id = `guard_${idx + 1}`;
        const enemy: EnemyEntity = {
          id,
          type: g.type,
          name: g.name,
          x: g.x,
          y: 0,
          z: g.z,
          rotationY: Math.PI,
          hp: 110,
          maxHp: 110,
          state: 'IDLE',
          attackTimer: 0,
          staggerTimer: 0,
        };
        this.enemies.push(enemy);
        this.createEnemyMesh(enemy);
      });
    } else if (chapter === 3) {
      this.currentQuest = {
        chapter: 3,
        title: 'Throne of the Void Inquisitor',
        subtitle: 'Abyssal Sanctuary',
        objective: 'Slay Inquisitor Malakor, Lord of the Abyss',
        requiredKills: 1,
        currentKills: 0,
        completed: false,
        bossAppeared: true,
      };

      const boss: EnemyEntity = {
        id: 'malakor_boss',
        type: 'MALAKOR_BOSS',
        name: 'Inquisitor Malakor',
        x: 0,
        y: 0,
        z: -12,
        rotationY: Math.PI,
        hp: 350,
        maxHp: 350,
        state: 'IDLE',
        attackTimer: 0,
        staggerTimer: 0,
        phase: 1,
      };
      this.enemies.push(boss);
      this.createEnemyMesh(boss);
      this.callbacks.onBossStateChange(boss);
    }

    this.callbacks.onQuestUpdate(this.currentQuest);
  }

  // Create 3D Meshes for enemies
  private createEnemyMesh(enemy: EnemyEntity) {
    const group = new THREE.Group();

    if (enemy.type === 'VOID_THRALL') {
      // Swarming purple shadow fiend
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x180d2b,
        roughness: 0.6,
        metalness: 0.3,
      });
      const purpleGlowMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), bodyMat);
      torso.position.y = 1.1;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), bodyMat);
      head.position.set(0, 0.65, 0.1);
      torso.add(head);

      // Glowing purple eyes
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), purpleGlowMat);
      eyeL.position.set(-0.12, 0.05, 0.24);
      head.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), purpleGlowMat);
      eyeR.position.set(0.12, 0.05, 0.24);
      head.add(eyeR);

      // Twin claw blades
      const clawMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.9 });
      const clawL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4), clawMat);
      clawL.rotation.x = Math.PI / 2;
      clawL.position.set(-0.45, -0.2, 0.35);
      torso.add(clawL);

      const clawR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4), clawMat);
      clawR.rotation.x = Math.PI / 2;
      clawR.position.set(0.45, -0.2, 0.35);
      torso.add(clawR);
    } else if (enemy.type === 'CORRUPTED_GUARD') {
      // Armored Ashen Guard with Spiked Mace
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x24171a, metalness: 0.8, roughness: 0.3 });
      const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.6), armorMat);
      torso.position.y = 1.6;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), armorMat);
      head.position.set(0, 0.85, 0);
      torso.add(head);

      // Red visor slit
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), redGlowMat);
      visor.position.set(0, 0.05, 0.31);
      head.add(visor);

      // Spiked Mace in Right Hand
      const maceGroup = new THREE.Group();
      maceGroup.position.set(0.7, -0.2, 0.2);
      const maceShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), armorMat);
      maceShaft.position.y = 0.5;
      maceGroup.add(maceShaft);
      const maceHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), redGlowMat);
      maceHead.position.y = 1.1;
      maceGroup.add(maceHead);
      torso.add(maceGroup);

      // Iron Tower Shield in Left Hand
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), armorMat);
      shield.position.set(-0.7, -0.1, 0.25);
      torso.add(shield);
    } else if (enemy.type === 'MALAKOR_BOSS') {
      // Giant Abyssal Lord (2.3x scale)
      const bossArmorMat = new THREE.MeshStandardMaterial({
        color: 0x12071f,
        metalness: 0.9,
        roughness: 0.15,
      });
      const bossEmberMat = new THREE.MeshBasicMaterial({ color: 0xff5722 });
      const bossVoidMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 1.0), bossArmorMat);
      torso.position.y = 2.8;
      torso.castShadow = true;
      group.add(torso);

      // Giant Crowned Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), bossArmorMat);
      head.position.set(0, 1.4, 0);
      torso.add(head);

      // Spiked Abyssal Crown
      [-0.4, -0.2, 0, 0.2, 0.4].forEach(x => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 4), bossVoidMat);
        spike.position.set(x, 0.7, 0.1);
        head.add(spike);
      });

      // Fiery Eyes & Visor
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bossEmberMat);
      eyeL.position.set(-0.25, 0.1, 0.52);
      head.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bossEmberMat);
      eyeR.position.set(0.25, 0.1, 0.52);
      head.add(eyeR);

      // Giant Double Scythe of Embers
      const scythe = new THREE.Group();
      scythe.position.set(1.2, 0, 0.4);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2), bossArmorMat);
      pole.position.y = 0.8;
      scythe.add(pole);
      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 12, Math.PI * 0.7), bossEmberMat);
      blade.position.set(0.4, 2.1, 0);
      blade.rotation.z = -0.5;
      scythe.add(blade);
      torso.add(scythe);
    }

    group.position.set(enemy.x, enemy.y, enemy.z);
    group.rotation.y = enemy.rotationY;
    this.scene.add(group);
    this.enemyMeshes.set(enemy.id, group);
  }

  // -------------------------------------------------------------
  // ASH ANIMATION & COMBAT ENGINE
  // -------------------------------------------------------------

  public playAshAnimation(clipName: string, blendDuration = 0.12, restartIfSame = false) {
    if (!this.animationMixer) return;
    const action = this.animationActions.get(clipName);
    if (!action) return;

    if (this.currentAshClipName === clipName && !restartIfSame) {
      if (!action.isRunning()) {
        action.play();
      }
      return;
    }

    if (this.currentAnimationAction && this.currentAnimationAction !== action) {
      this.currentAnimationAction.fadeOut(blendDuration);
    }

    action.reset().fadeIn(blendDuration).play();
    this.currentAnimationAction = action;
    this.currentAshClipName = clipName;
  }

  public handleAnimationFinished(clipName: string) {
    if (clipName === 'Sword Enter') {
      this.isSwordEquipped = true;
      this.stats.isSwordEquipped = true;
      if (this.swordDrawnMesh) this.swordDrawnMesh.visible = true;
      if (this.swordSheathedMesh) this.swordSheathedMesh.visible = false;
      this.isDrawingSword = false;
      this.isAttacking = false;
      this.activeAttackClipName = '';
    } else if (clipName === 'Jump Land') {
      this.isLanding = false;
    } else if (clipName === 'Ninja Jump Double') {
      if (this.isDodging) {
        this.isDodging = false;
        this.stats.isInvulnerable = false;
        this.dodgeCooldownTimer = 0.25;
        this.stats.dodgeCooldown = 0.25;
      }
      if (this.isDoubleJumping) {
        this.isDoubleJumping = false;
      }
    } else if (clipName === 'Hit Stomach') {
      this.isHitStunned = false;
    } else if (clipName === 'Sword Dash Root Motion') {
      this.isSwordDashing = false;
      this.isAttacking = false;
      this.activeAttackClipName = '';
    }
  }

  // 6. IDLE/WALK/SPRINT -> ATTACK (Unarmed combo sequence & Sword attack)
  public triggerLightAttack() {
    if (this.isDead || this.isDodging || this.isHitStunned || this.isDrawingSword || this.isSwordDashing) return;

    // 8. Air attacks
    if (!this.isGrounded) {
      this.triggerAirAttack();
      return;
    }

    // 10. Sword Attack
    if (this.isSwordEquipped) {
      this.triggerSwordAttack();
      return;
    }

    // Unarmed ground combo
    if (this.stats.stamina < 8) return;

    if (!this.isAttacking) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 8);
      this.startUnarmedAttack(1);
    } else {
      // In active attack: check combo window and input buffer
      if (this.attackAnimTime < this.comboWindowStart) {
        // Slightly before combo window: remember via input buffer
        this.inputBufferAttack = true;
      } else if (this.attackAnimTime >= this.comboWindowStart && this.attackAnimTime <= this.comboWindowEnd) {
        // Within combo window: advance immediately
        this.stats.stamina = Math.max(0, this.stats.stamina - 8);
        this.advanceUnarmedCombo();
      }
      // If outside combo window: do not restart current attack
    }
  }

  private startUnarmedAttack(step: number) {
    this.isAttacking = true;
    this.unarmedComboStep = step;
    this.attackAnimTime = 0;
    this.inputBufferAttack = false;
    this.comboAdvanced = false;

    if (step === 1) {
      this.activeAttackClipName = 'Punch (jab)';
      this.attackAnimDuration = 0.833 / 1.8; // ~0.46s
      this.comboWindowStart = 0.18;
      this.comboWindowEnd = 0.42;
      this.stats.comboCount = 1;
      this.stats.comboMultiplier = 1.0;
      soundManager.playSwing(1.1);
      triggerHaptic(20);
      setTimeout(() => this.performAttackHitCheck(1, false), 180);
    } else if (step === 2) {
      this.activeAttackClipName = 'Punch (cross)';
      this.attackAnimDuration = 0.967 / 1.8; // ~0.54s
      this.comboWindowStart = 0.20;
      this.comboWindowEnd = 0.48;
      this.stats.comboCount = 2;
      this.stats.comboMultiplier = 1.25;
      soundManager.playSwing(1.2);
      triggerHaptic(25);
      setTimeout(() => this.performAttackHitCheck(2, false), 200);
    } else if (step === 3) {
      this.activeAttackClipName = 'Kick';
      this.attackAnimDuration = 1.100 / 1.8; // ~0.61s
      this.comboWindowStart = 0.24;
      this.comboWindowEnd = 0.55;
      this.stats.comboCount = 3;
      this.stats.comboMultiplier = 1.5;
      soundManager.playSwing(1.3);
      triggerHaptic(30);
      setTimeout(() => this.performAttackHitCheck(3, false), 240);
    } else if (step === 4) {
      this.activeAttackClipName = 'Jumping spinning kick (c0a12a) (in place)';
      this.attackAnimDuration = 3.967 / 2.4; // ~1.65s
      this.comboWindowStart = 999; // final finisher
      this.comboWindowEnd = 999;
      this.stats.comboCount = 4;
      this.stats.comboMultiplier = 2.0;
      soundManager.playSwing(0.9);
      triggerHaptic(45);
      setTimeout(() => this.performAttackHitCheck(4, true), 350);
      setTimeout(() => this.performAttackHitCheck(4, true), 700);
    }

    this.playAshAnimation(this.activeAttackClipName, 0.06, true);
  }

  public advanceUnarmedCombo() {
    if (this.comboAdvanced) return;
    if (this.unarmedComboStep === 1) {
      this.comboAdvanced = true;
      this.startUnarmedAttack(2);
    } else if (this.unarmedComboStep === 2) {
      this.comboAdvanced = true;
      this.startUnarmedAttack(3);
    } else if (this.unarmedComboStep === 3) {
      this.comboAdvanced = true;
      this.startUnarmedAttack(4);
    }
  }

  // 10. SWORD ATTACK
  public triggerSwordAttack() {
    if (!this.isSwordEquipped || this.isDead || this.isDodging || this.isHitStunned || this.isDrawingSword || this.isSwordDashing) return;
    if (this.stats.stamina < 12) return;

    if (!this.isAttacking) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 12);
      this.isAttacking = true;
      this.activeAttackClipName = 'Sword Attack';
      this.attackAnimTime = 0;
      this.attackAnimDuration = 1.533 / 2.2; // ~0.70s
      this.comboWindowStart = 0.28;
      this.comboWindowEnd = 0.58;
      this.inputBufferAttack = false;
      this.comboAdvanced = false;
      this.stats.comboCount = (this.stats.comboCount % 3) + 1;
      this.stats.comboMultiplier = 1.0 + this.stats.comboCount * 0.2;

      this.playAshAnimation('Sword Attack', 0.06, true);
      soundManager.playSwing(1.0);
      triggerHaptic(30);
      setTimeout(() => this.performAttackHitCheck(2, false), 220);
    } else if (this.activeAttackClipName === 'Sword Attack') {
      if (this.attackAnimTime < this.comboWindowStart) {
        this.inputBufferAttack = true;
      } else if (this.attackAnimTime >= this.comboWindowStart && this.attackAnimTime <= this.comboWindowEnd && !this.comboAdvanced) {
        this.comboAdvanced = true;
        this.stats.stamina = Math.max(0, this.stats.stamina - 12);
        this.attackAnimTime = 0;
        this.inputBufferAttack = false;
        this.stats.comboCount = (this.stats.comboCount % 3) + 1;
        this.stats.comboMultiplier = 1.0 + this.stats.comboCount * 0.3;
        this.playAshAnimation('Sword Attack', 0.06, true);
        soundManager.playSwing(1.2);
        triggerHaptic(35);
        setTimeout(() => this.performAttackHitCheck(3, true), 220);
      }
    }
  }

  // 8. AIR ATTACKS
  public triggerAirAttack() {
    if (this.isGrounded || this.isDead || this.isDodging || this.isHitStunned) return;
    if (this.stats.stamina < 15) return;
    this.stats.stamina = Math.max(0, this.stats.stamina - 15);

    this.isAttacking = true;
    this.attackAnimTime = 0;
    this.inputBufferAttack = false;

    if (this.isSwordEquipped) {
      // 11. SWORD AERIAL COMBO
      this.activeAttackClipName = 'Sword Aerial Combo';
      this.attackAnimDuration = 1.000 / 1.7; // ~0.59s
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;
      soundManager.playSwing(1.2);
      triggerHaptic(30);
      setTimeout(() => this.performAttackHitCheck(3, false), 200);
    } else {
      // Unarmed aerial kick
      this.activeAttackClipName = 'Jumping spinning kick (c0a12a) (in place)';
      this.attackAnimDuration = 3.967 / 2.4;
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;
      soundManager.playSwing(1.0);
      triggerHaptic(35);
      setTimeout(() => this.performAttackHitCheck(3, true), 300);
    }

    this.playAshAnimation(this.activeAttackClipName, 0.06, true);
  }

  // 9. SWORD ENTER & SHEATHE
  public triggerToggleSword() {
    if (this.isDead || this.isDodging || this.isHitStunned || this.isDrawingSword || this.isSwordDashing) return;

    if (!this.isSwordEquipped) {
      // Draw sword with "Sword Enter"
      this.isAttacking = true;
      this.isDrawingSword = true;
      this.activeAttackClipName = 'Sword Enter';
      this.attackAnimTime = 0;
      this.attackAnimDuration = 1.300 / 1.6; // ~0.81s
      this.comboWindowStart = 999;
      this.comboWindowEnd = 999;

      this.playAshAnimation('Sword Enter', 0.06, true);
      soundManager.playSwing(0.8);
      triggerHaptic(30);

      // Equip sword to hand when hand grasps hilt in animation (~0.5s)
      setTimeout(() => {
        if (this.isDead) return;
        this.isSwordEquipped = true;
        this.stats.isSwordEquipped = true;
        if (this.swordDrawnMesh) this.swordDrawnMesh.visible = true;
        if (this.swordSheathedMesh) this.swordSheathedMesh.visible = false;
        soundManager.playSwing(1.3);
      }, 500);

      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'SWORD DRAWN',
        x: this.playerPosition.x,
        y: this.playerPosition.y + 2.2,
        z: this.playerPosition.z,
        color: '#22d3ee',
        createdAt: Date.now(),
        duration: 1000,
        scale: 1.2,
      });
    } else {
      // Sheathe sword
      if (this.isAttacking) return;
      this.isSwordEquipped = false;
      this.stats.isSwordEquipped = false;
      if (this.swordDrawnMesh) this.swordDrawnMesh.visible = false;
      if (this.swordSheathedMesh) this.swordSheathedMesh.visible = true;
      triggerHaptic(20);

      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'SWORD SHEATHED',
        x: this.playerPosition.x,
        y: this.playerPosition.y + 2.2,
        z: this.playerPosition.z,
        color: '#94a3b8',
        createdAt: Date.now(),
        duration: 1000,
        scale: 1.1,
      });
    }
  }

  // 12. SWORD DASH
  public triggerSwordDash() {
    if (!this.isSwordEquipped || this.isDead || this.isDodging || this.isHitStunned || this.swordDashCooldownTimer > 0) return;
    if (this.stats.stamina < 20) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 20);
    this.isAttacking = true;
    this.isSwordDashing = true;
    this.swordDashCooldownTimer = 1.2;
    this.stats.swordDashCooldown = 1.2;
    this.activeAttackClipName = 'Sword Dash Root Motion';
    this.attackAnimTime = 0;
    this.attackAnimDuration = 1.567 / 2.0; // ~0.78s
    this.comboWindowStart = 999;
    this.comboWindowEnd = 999;

    this.playAshAnimation('Sword Dash Root Motion', 0.06, true);
    soundManager.playHeavyCleave();
    triggerHaptic(40);

    const dashAngle = this.inputVector.magnitude > 0.1
      ? Math.atan2(this.inputVector.x, this.inputVector.y) + this.cameraYaw
      : this.playerRotationY;
    this.playerRotationY = dashAngle;
    this.playerVelocity.set(
      Math.sin(dashAngle) * 14.0,
      0,
      Math.cos(dashAngle) * 14.0
    );

    setTimeout(() => {
      this.performAttackHitCheck(4, true);
    }, 250);
  }

  // Heavy Cleave fallback
  public triggerHeavyCleave() {
    if (this.isSwordEquipped) {
      this.triggerSwordDash();
    } else {
      if (this.stats.stamina < 25) return;
      this.stats.stamina = Math.max(0, this.stats.stamina - 25);
      this.startUnarmedAttack(4);
    }
  }

  public triggerRuneBurst() {
    if (this.stats.runes < 30) return;
    if (this.isDead || this.playerAction === 'DEAD') return;

    this.stats.runes -= 30;
    triggerHaptic(60);
    soundManager.playRuneBurst();

    this.spawnRuneBurstParticles(this.playerPosition);

    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') return;
      const dist = this.playerPosition.distanceTo(new THREE.Vector3(enemy.x, enemy.y, enemy.z));
      if (dist <= 6.5) {
        this.damageEnemy(enemy, 55, true, 'RUNE BLAST!');
      }
    });
  }

  // 5. ANY NORMAL STATE -> DODGE
  public triggerDodgeRoll() {
    if (this.isDead || this.isDodging || this.dodgeCooldownTimer > 0) return;
    if (this.stats.stamina < 18) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 18);
    // Cancel normal movement and attacks
    this.isAttacking = false;
    this.unarmedComboStep = 0;
    this.activeAttackClipName = '';
    this.isDrawingSword = false;
    this.isSwordDashing = false;

    this.isDodging = true;
    this.dodgeTimer = 0.45;
    this.stats.isInvulnerable = true;
    triggerHaptic(20);
    soundManager.playDodge();

    let moveAngle = this.playerRotationY;
    if (this.inputVector.magnitude > 0.1) {
      moveAngle = Math.atan2(this.inputVector.x, this.inputVector.y) + this.cameraYaw;
      this.playerRotationY = moveAngle;
    }
    this.playerVelocity.set(
      Math.sin(moveAngle) * 11.0,
      0,
      Math.cos(moveAngle) * 11.0
    );

    this.playAshAnimation('Ninja Jump Double', 0.05, true);
  }

  public triggerParry() {
    if (this.stats.stamina < 15 || this.isDead || this.isDodging) return;

    this.stats.stamina = Math.max(0, this.stats.stamina - 15);
    this.parryTimer = 0.35;
    this.stats.isParrying = true;
    triggerHaptic(30);
  }

  // 3. IDLE/WALK/SPRINT -> JUMP & 4. AIRBORNE -> DOUBLE JUMP
  public triggerJump() {
    if (this.isDead || this.isDodging || this.isHitStunned) return;

    if (!this.isGrounded) {
      // Airborne: trigger double jump if available
      if (this.doubleJumpAvailable && !this.isDoubleJumping) {
        this.triggerDoubleJump();
      }
      return;
    }

    if (this.isAttacking) return; // Jump does not interrupt attack (Rule 7)

    // Ground jump: Jump Start
    this.isGrounded = false;
    this.isJumping = true;
    this.isDoubleJumping = false;
    this.doubleJumpAvailable = true;
    this.isLanding = false;
    this.playerVy = 8.0;
    this.playAshAnimation('Jump Start', 0.06, true);
    soundManager.playSwing(1.3);
    triggerHaptic(15);
  }

  public triggerDoubleJump() {
    if (this.isGrounded || !this.doubleJumpAvailable || this.isDoubleJumping || this.isDead) return;
    this.isDoubleJumping = true;
    this.doubleJumpAvailable = false;
    this.playerVy = 6.8;
    this.playAshAnimation('Ninja Jump Double', 0.06, true);
    soundManager.playSwing(1.6);
    triggerHaptic(30);
  }

  // 15. CRAWL BACKWARD
  public setCrawlActive(active: boolean) {
    this.isCrawlInputActive = active;
    this.stats.isCrawling = active;
  }

  public toggleCrawl() {
    this.setCrawlActive(!this.isCrawlInputActive);
  }

  public triggerHealPotion() {
    if (this.stats.potions <= 0 || this.stats.hp >= this.stats.maxHp || this.isDead) return;

    this.stats.potions -= 1;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.potionHealAmount);
    triggerHaptic(40);
    soundManager.playPotion();

    this.spawnHealParticles(this.playerPosition);
    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: `+${this.stats.potionHealAmount} HP`,
      x: this.playerPosition.x,
      y: this.playerPosition.y + 2.2,
      z: this.playerPosition.z,
      color: '#4ade80',
      createdAt: Date.now(),
      duration: 1200,
      scale: 1.2,
    });
  }

  public toggleSprint() {
    this.sprintToggled = !this.sprintToggled;
    this.stats.isSprinting = this.sprintToggled;
    triggerHaptic(20);
  }

  public toggleLockOn() {
    if (this.targetLockEnemy) {
      this.targetLockEnemy = null;
    } else {
      // Find closest alive enemy within 15 units
      let closest: EnemyEntity | null = null;
      let minDist = 15;
      this.enemies.forEach(e => {
        if (e.state === 'DEAD') return;
        const d = this.playerPosition.distanceTo(new THREE.Vector3(e.x, e.y, e.z));
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      });
      this.targetLockEnemy = closest;
    }
    triggerHaptic(15);
  }

  public quickTurn180() {
    this.cameraYaw += Math.PI;
    this.playerRotationY += Math.PI;
    triggerHaptic(25);
  }

  // Attack hit registration
  private performAttackHitCheck(comboIndex: number, isHeavy = false) {
    const forward = new THREE.Vector3(
      Math.sin(this.playerRotationY),
      0,
      Math.cos(this.playerRotationY)
    ).normalize();

    const range = isHeavy ? 3.8 : 2.7;
    const baseDamage = isHeavy ? 48 : 20 + comboIndex * 6;

    // Show sword arc slash
    this.slashTrailMesh.position.copy(this.playerPosition);
    this.slashTrailMesh.rotation.z = this.playerRotationY + Math.PI / 2;
    (this.slashTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;

    let hitAny = false;

    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') return;
      const enemyPos = new THREE.Vector3(enemy.x, enemy.y, enemy.z);
      const toEnemy = enemyPos.clone().sub(this.playerPosition);
      const dist = toEnemy.length();

      if (dist <= range) {
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        // Hit if enemy is within 120 degree cone in front of player
        if (dot > 0.25 || isHeavy) {
          hitAny = true;
          const isCrit = comboIndex === 3 || isHeavy;
          const dmg = Math.round(baseDamage * (isCrit ? 1.4 : 1.0) * this.stats.comboMultiplier);

          this.damageEnemy(enemy, dmg, isCrit);
          this.spawnHitSparks(enemyPos, isCrit);
        }
      }
    });

    if (hitAny) {
      this.stats.comboCount += 1;
      this.stats.comboMultiplier = Math.min(2.5, 1.0 + this.stats.comboCount * 0.1);
      this.stats.runes = Math.min(100, this.stats.runes + (isHeavy ? 18 : 8));
    }
  }

  private damageEnemy(enemy: EnemyEntity, damage: number, isCrit: boolean, customLabel?: string) {
    enemy.hp = Math.max(0, enemy.hp - damage);
    soundManager.playHit(isCrit);
    triggerHaptic(isCrit ? 40 : 20);

    // Stagger enemy
    enemy.state = 'STAGGER';
    enemy.staggerTimer = isCrit ? 0.6 : 0.35;

    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: customLabel ? customLabel : isCrit ? `CRIT ${damage}!` : `${damage}`,
      x: enemy.x + (Math.random() - 0.5) * 0.5,
      y: enemy.y + 1.8 + Math.random() * 0.4,
      z: enemy.z + (Math.random() - 0.5) * 0.5,
      color: customLabel ? '#22d3ee' : isCrit ? '#f59e0b' : '#ffffff',
      createdAt: Date.now(),
      duration: 1000,
      scale: isCrit ? 1.3 : 1.0,
    });

    // Boss Phase 2 Transition Check
    if (enemy.type === 'MALAKOR_BOSS' && enemy.phase === 1 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.phase = 2;
      enemy.state = 'ENRAGED';
      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'PHASE 2: ABYSSAL INFERNO!',
        x: enemy.x,
        y: enemy.y + 3.0,
        z: enemy.z,
        color: '#ff3b30',
        createdAt: Date.now(),
        duration: 2000,
        scale: 1.5,
      });
      soundManager.playRuneBurst();
    }

    if (enemy.hp <= 0) {
      enemy.state = 'DEAD';
      this.stats.score += enemy.type === 'MALAKOR_BOSS' ? 1000 : enemy.type === 'CORRUPTED_GUARD' ? 250 : 100;
      this.currentQuest.currentKills += 1;

      // Check Chapter completion
      if (this.currentQuest.currentKills >= this.currentQuest.requiredKills) {
        this.currentQuest.completed = true;
        if (this.currentQuest.chapter === 1) {
          setTimeout(() => this.spawnChapterEnemies(2), 1500);
        } else if (this.currentQuest.chapter === 2) {
          setTimeout(() => this.spawnChapterEnemies(3), 1500);
        } else if (this.currentQuest.chapter === 3) {
          setTimeout(() => this.callbacks.onVictory(), 2000);
        }
      }
      this.callbacks.onQuestUpdate(this.currentQuest);
    }

    if (enemy.type === 'MALAKOR_BOSS') {
      this.callbacks.onBossStateChange(enemy);
    }
  }

  // Damage player from enemy attacks
  private damagePlayer(damage: number, attackerName: string) {
    if (this.isDead || this.stats.isInvulnerable || this.stats.hp <= 0) return;

    // Check Parry Stance
    if (this.stats.isParrying && this.parryTimer > 0) {
      soundManager.playParry();
      triggerHaptic(50);
      this.callbacks.onFloatingText({
        id: Math.random().toString(),
        text: 'PARRY COUNTER!',
        x: this.playerPosition.x,
        y: this.playerPosition.y + 2.0,
        z: this.playerPosition.z,
        color: '#22d3ee',
        createdAt: Date.now(),
        duration: 1200,
        scale: 1.4,
      });
      this.stats.runes = Math.min(100, this.stats.runes + 25);
      return;
    }

    this.stats.hp = Math.max(0, this.stats.hp - damage);
    soundManager.playHurt();
    triggerHaptic(45);

    this.callbacks.onFloatingText({
      id: Math.random().toString(),
      text: `-${damage}`,
      x: this.playerPosition.x,
      y: this.playerPosition.y + 1.8,
      z: this.playerPosition.z,
      color: '#ef4444',
      createdAt: Date.now(),
      duration: 1000,
      scale: 1.1,
    });

    if (this.stats.hp <= 0) {
      // 14. DEATH STATE - Highest priority, cannot be interrupted
      this.isDead = true;
      this.stats.hp = 0;
      this.playerAction = 'DEAD';
      this.primaryAnimState = 'DEATH';

      // Clear all active states and velocity
      this.isAttacking = false;
      this.isDodging = false;
      this.isHitStunned = false;
      this.isDrawingSword = false;
      this.isSwordDashing = false;
      this.isJumping = false;
      this.isDoubleJumping = false;
      this.playerVelocity.set(0, 0, 0);
      this.playerVy = 0;

      this.playAshAnimation('Death', 0.05, true);
      this.callbacks.onGameOver();
    } else {
      // 13. HIT STOMACH (DAMAGE REACTION)
      // Prevent multiple Hit Stomach animations from stacking simultaneously
      if (!this.isHitStunned && this.hitStunTimer <= 0) {
        this.isHitStunned = true;
        this.hitStunTimer = 0.35;
        this.playerAction = 'HIT_STOMACH';
        this.primaryAnimState = 'HIT_STOMACH';

        // Damage reaction interrupts attacks and normal movement
        this.isAttacking = false;
        this.unarmedComboStep = 0;
        this.activeAttackClipName = '';
        this.isDrawingSword = false;
        this.isSwordDashing = false;

        this.playAshAnimation('Hit Stomach', 0.05, true);
      }
    }
  }

  // Respawn player
  public respawn() {
    this.isDead = false;
    this.stats.hp = this.stats.maxHp;
    this.stats.stamina = this.stats.maxStamina;
    this.stats.potions = this.stats.maxPotions;
    this.stats.isInvulnerable = false;
    this.stats.isParrying = false;
    this.stats.isSprinting = false;

    this.playerAction = 'IDLE';
    this.primaryAnimState = 'IDLE';
    this.isAttacking = false;
    this.isDodging = false;
    this.isHitStunned = false;
    this.isDrawingSword = false;
    this.isSwordDashing = false;
    this.isJumping = false;
    this.isDoubleJumping = false;
    this.isLanding = false;
    this.unarmedComboStep = 0;
    this.activeAttackClipName = '';

    this.playerPosition.set(0, 0, 0);
    this.playerVelocity.set(0, 0, 0);
    this.playerVy = 0;
    this.isGrounded = true;
    this.cameraYaw = 0;
    this.cameraPitch = 0.28;
    this.smoothedCamPos.set(0, 4, 8);
    this.smoothedCamTarget.set(0, 1.5, 0);

    this.playAshAnimation('Idle', 0.15, true);
    this.spawnChapterEnemies(this.currentQuest.chapter);
  }

  // Particle Emitters
  private spawnHitSparks(pos: THREE.Vector3, isCrit: boolean) {
    const count = isCrit ? 16 : 8;
    const color = isCrit ? new THREE.Color(0xf59e0b) : new THREE.Color(0x67e8f9);
    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.SphereGeometry(0.06, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({ color });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + 1.2 + (Math.random() - 0.5) * 0.4,
        pos.z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 6
      );
      this.particles.push({ mesh: p, velocity: vel, life: 0, maxLife: 0.35, color, size: 0.06 });
    }
  }

  private spawnRuneBurstParticles(pos: THREE.Vector3) {
    const ringGeo = new THREE.RingGeometry(0.2, 0.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.1, pos.z);
    this.scene.add(ring);

    this.particles.push({
      mesh: ring,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0,
      maxLife: 0.5,
      color: new THREE.Color(0x22d3ee),
      size: 1.0,
    });
  }

  private spawnHealParticles(pos: THREE.Vector3) {
    for (let i = 0; i < 12; i++) {
      const pGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
      const p = new THREE.Mesh(pGeo, pMat);
      const angle = (i / 12) * Math.PI * 2;
      p.position.set(pos.x + Math.cos(angle) * 0.8, 0.2, pos.z + Math.sin(angle) * 0.8);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(Math.cos(angle) * 0.4, 2.5, Math.sin(angle) * 0.4),
        life: 0,
        maxLife: 0.7,
        color: new THREE.Color(0x4ade80),
        size: 0.08,
      });
    }
  }

  // Main Loop Update
  public update(delta: number) {
    const clampedDelta = Math.min(delta, 0.1);
    const animTime = this.clock.getElapsedTime();

    // FPS calculation
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.callbacks.onFpsUpdate(Math.round((this.frameCount * 1000) / (now - this.lastFpsTime)));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // 1. Update Cooldowns, Timers & Stamina
    if (this.stats.stamina < this.stats.maxStamina) {
      const regenRate = this.stats.isSprinting ? 0 : 18;
      this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + regenRate * clampedDelta);
    }

    // Cooldowns
    this.dodgeCooldownTimer = Math.max(0, this.dodgeCooldownTimer - clampedDelta);
    this.stats.dodgeCooldown = this.dodgeCooldownTimer;
    this.swordDashCooldownTimer = Math.max(0, this.swordDashCooldownTimer - clampedDelta);
    this.stats.swordDashCooldown = this.swordDashCooldownTimer;
    this.stats.isSwordEquipped = this.isSwordEquipped;
    this.stats.isCrawling = this.isCrawlInputActive;
    this.stats.canDoubleJump = !this.isGrounded && this.doubleJumpAvailable && !this.isDoubleJumping;

    if (this.hitStunTimer > 0) {
      this.hitStunTimer -= clampedDelta;
      if (this.hitStunTimer <= 0) {
        this.isHitStunned = false;
      }
    }

    if (this.isDodging) {
      this.dodgeTimer -= clampedDelta;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.stats.isInvulnerable = false;
        this.dodgeCooldownTimer = 0.25;
        this.stats.dodgeCooldown = 0.25;
      }
    }

    if (this.parryTimer > 0) {
      this.parryTimer -= clampedDelta;
      if (this.parryTimer <= 0) {
        this.stats.isParrying = false;
      }
    }

    // Attack timer & input buffer execution
    if (this.isAttacking) {
      this.attackAnimTime += clampedDelta;

      // Check if buffered attack can fire inside combo window
      if (
        this.inputBufferAttack &&
        !this.comboAdvanced &&
        this.attackAnimTime >= this.comboWindowStart &&
        this.attackAnimTime <= this.comboWindowEnd
      ) {
        if (this.isSwordEquipped) {
          this.triggerSwordAttack();
        } else {
          this.advanceUnarmedCombo();
        }
      }

      // Check attack duration expiry
      if (this.attackAnimTime >= this.attackAnimDuration) {
        this.isAttacking = false;
        this.isDrawingSword = false;
        this.isSwordDashing = false;
        this.activeAttackClipName = '';
        if (this.unarmedComboStep === 4) {
          this.unarmedComboStep = 0;
          this.stats.comboCount = 0;
        }
      }
    }

    if (this.isLanding) {
      this.landingTimer -= clampedDelta;
      if (this.landingTimer <= 0) {
        this.isLanding = false;
      }
    }

    // 2. Locomotion & Physics
    const isSprint = (this.sprintToggled || this.inputVector.magnitude >= this.joystickConfig.sprintThreshold) && this.stats.stamina > 5;
    this.stats.isSprinting = isSprint && this.inputVector.magnitude > 0.2 && !this.isCrawlInputActive;

    if (isSprint && this.stats.isSprinting) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 10 * clampedDelta);
    }

    const moveSpeed = isSprint ? 8.5 : 5.2;

    if (this.isDead) {
      this.playerVelocity.set(0, 0, 0);
    } else if (this.isDodging) {
      this.playerVelocity.x *= 0.94;
      this.playerVelocity.z *= 0.94;
    } else if (this.isHitStunned) {
      this.playerVelocity.x *= 0.6;
      this.playerVelocity.z *= 0.6;
    } else if (this.isSwordDashing) {
      this.playerVelocity.x *= 0.96;
      this.playerVelocity.z *= 0.96;
    } else if (this.isAttacking && this.isGrounded) {
      // Clamp/stop movement during ground attack strike
      this.playerVelocity.x *= 0.3;
      this.playerVelocity.z *= 0.3;
    } else if (this.isCrawlInputActive && this.isGrounded) {
      // Slow backward movement away from facing direction
      const crawlSpeed = 2.0;
      this.playerVelocity.x = Math.sin(this.playerRotationY) * crawlSpeed;
      this.playerVelocity.z = Math.cos(this.playerRotationY) * crawlSpeed;
    } else {
      if (this.inputVector.magnitude > 0.05) {
        const inX = this.inputVector.x;
        const inY = this.inputVector.y;
        const camYaw = this.cameraYaw;

        // Camera-relative movement vector
        // In Three.js coordinate system: camera looks toward -Z at yaw 0
        // Pushing UP (inY > 0) -> move forward (-Z)
        // Pushing DOWN (inY < 0) -> move backward (+Z)
        // Pushing RIGHT (inX > 0) -> move right (+X)
        // Pushing LEFT (inX < 0) -> move left (-X)
        const moveDirX = inX * Math.cos(camYaw) - inY * Math.sin(camYaw);
        const moveDirZ = -inX * Math.sin(camYaw) - inY * Math.cos(camYaw);

        const targetRotation = Math.atan2(moveDirX, -moveDirZ);

        let diff = targetRotation - this.playerRotationY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.playerRotationY += diff * 14.0 * clampedDelta;

        const effectiveMag = Math.min(1.0, this.inputVector.magnitude);
        const speed = effectiveMag * moveSpeed;

        this.playerVelocity.x = moveDirX * speed;
        this.playerVelocity.z = moveDirZ * speed;
      } else {
        this.playerVelocity.x *= 0.72;
        this.playerVelocity.z *= 0.72;
      }
    }

    // Gravity & Vertical Physics
    if (!this.isGrounded) {
      this.playerVy -= 18.0 * clampedDelta;
      this.playerPosition.y += this.playerVy * clampedDelta;
      if (this.playerPosition.y <= 0) {
        this.playerPosition.y = 0;
        this.playerVy = 0;
        const wasAirborne = !this.isGrounded;
        this.isGrounded = true;
        this.isJumping = false;
        this.isDoubleJumping = false;
        this.doubleJumpAvailable = true;

        if (wasAirborne) {
          if (this.stats.isSprinting && this.inputVector.magnitude > 0.2) {
            // Cancel landing directly into sprint
            this.isLanding = false;
          } else if (!this.isAttacking && !this.isDodging && !this.isHitStunned) {
            this.isLanding = true;
            this.landingTimer = 0.20;
          }
        }
      }
    } else {
      // Keep grounded character anchored to floor
      this.playerPosition.y = 0;
      this.playerVy = 0;
    }

    // Apply horizontal velocity
    this.playerPosition.x += this.playerVelocity.x * clampedDelta;
    this.playerPosition.z += this.playerVelocity.z * clampedDelta;

    // Obstacle capsule collision (Pillars & Braziers) with tangent wall-sliding
    for (let i = 0; i < this.arenaObstacles.length; i++) {
      const obs = this.arenaObstacles[i];
      const dx = this.playerPosition.x - obs.x;
      const dz = this.playerPosition.z - obs.z;
      const distSq = dx * dx + dz * dz;
      const minD = obs.radius;
      if (distSq < minD * minD && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        // Push capsule out to surface
        this.playerPosition.x = obs.x + nx * minD;
        this.playerPosition.z = obs.z + nz * minD;
        // Remove normal component of velocity for smooth sliding
        const dot = this.playerVelocity.x * nx + this.playerVelocity.z * nz;
        if (dot < 0) {
          this.playerVelocity.x -= dot * nx;
          this.playerVelocity.z -= dot * nz;
        }
      }
    }

    // Arena boundary limits (Inside perimeter stone walls)
    const arenaLimit = 20.2;
    if (this.playerPosition.x < -arenaLimit) {
      this.playerPosition.x = -arenaLimit;
      if (this.playerVelocity.x < 0) this.playerVelocity.x = 0;
    } else if (this.playerPosition.x > arenaLimit) {
      this.playerPosition.x = arenaLimit;
      if (this.playerVelocity.x > 0) this.playerVelocity.x = 0;
    }
    if (this.playerPosition.z < -arenaLimit) {
      this.playerPosition.z = -arenaLimit;
      if (this.playerVelocity.z < 0) this.playerVelocity.z = 0;
    } else if (this.playerPosition.z > arenaLimit) {
      this.playerPosition.z = arenaLimit;
      if (this.playerVelocity.z > 0) this.playerVelocity.z = 0;
    }

    // Failsafe: character can never fall into void
    if (this.playerPosition.y < 0) {
      this.playerPosition.y = 0;
      this.playerVy = 0;
      this.isGrounded = true;
    }

    // Update Player Model Transform
    this.playerGroup.position.copy(this.playerPosition);
    this.playerGroup.rotation.y = this.playerRotationY;

    // 3. PRIORITY-BASED SKELETAL ANIMATION CONTROLLER
    // "Death" > "Dodge_Roll" > "Hit Stomach" > "Attack/Sword Attack" > "Jump/Air" > "Sprint" > "Walk" > "Idle"
    let selectedClipName = 'Idle';
    let blendDuration = 0.12;

    if (this.isDead || this.stats.hp <= 0) {
      // 1. DEATH (Top Priority)
      selectedClipName = 'Death';
      blendDuration = 0.05;
      this.primaryAnimState = 'DEATH';
      this.playerAction = 'DEAD';
    } else if (this.isDodging) {
      // 2. DODGE ROLL
      selectedClipName = 'Ninja Jump Double';
      blendDuration = 0.05;
      this.primaryAnimState = 'DODGE_ROLL';
      this.playerAction = 'DODGE_ROLL';
    } else if (this.isHitStunned) {
      // 3. HIT STOMACH
      selectedClipName = 'Hit Stomach';
      blendDuration = 0.05;
      this.primaryAnimState = 'HIT_STOMACH';
      this.playerAction = 'HIT_STOMACH';
    } else if (this.isAttacking && this.activeAttackClipName) {
      // 4. ATTACK / SWORD ATTACK
      selectedClipName = this.activeAttackClipName;
      blendDuration = 0.06;
      this.primaryAnimState = 'ATTACK';
      this.playerAction = 'ATTACK_1';
    } else if (!this.isGrounded || this.isJumping || this.isDoubleJumping || this.isLanding) {
      // 5. JUMP / AIRBORNE
      if (this.isDoubleJumping) {
        selectedClipName = 'Ninja Jump Double';
        blendDuration = 0.06;
      } else if (this.isLanding) {
        selectedClipName = 'Jump Land';
        blendDuration = 0.08;
      } else {
        selectedClipName = 'Jump Start';
        blendDuration = 0.08;
      }
      this.primaryAnimState = 'JUMP';
      this.playerAction = 'JUMP';
    } else if (this.isCrawlInputActive) {
      // 15. CRAWL BACKWARD
      selectedClipName = 'Crawl Backward';
      blendDuration = 0.12;
      this.primaryAnimState = 'CRAWL_BACKWARD';
      this.playerAction = 'CRAWL_BACKWARD';
    } else if (this.stats.isSprinting && this.inputVector.magnitude > 0.05) {
      // 6. SPRINT
      selectedClipName = 'Sprint';
      blendDuration = 0.10;
      this.primaryAnimState = 'SPRINT';
      this.playerAction = 'SPRINT';
    } else if (this.inputVector.magnitude > 0.05) {
      // 7. WALK
      selectedClipName = 'Walk (mocap)';
      blendDuration = 0.12;
      this.primaryAnimState = 'WALK';
      this.playerAction = 'RUN';
    } else {
      // 8. IDLE
      selectedClipName = 'Idle';
      blendDuration = 0.14;
      this.primaryAnimState = 'IDLE';
      this.playerAction = 'IDLE';
    }

    if (this.animationMixer && this.modelConfig.useEmbeddedAnimations) {
      this.animationMixer.update(clampedDelta);
      this.playAshAnimation(selectedClipName, blendDuration);
    } else if (this.customModelGroup) {
      // Procedural animations for custom static mesh models
      const animTime = this.clock.getElapsedTime();
      const baseRotY = (this.modelConfig.rotationOffsetY * Math.PI) / 180;
      const currentAction = this.playerAction as string;

      if (currentAction === 'RUN' || currentAction === 'SPRINT') {
        const strideFreq = currentAction === 'SPRINT' ? 14 : 9;
        this.customModelGroup.rotation.z = Math.sin(animTime * strideFreq) * 0.08;
        this.customModelGroup.rotation.y = baseRotY;
        this.customModelGroup.position.y = this.modelConfig.yOffset + Math.abs(Math.sin(animTime * strideFreq)) * 0.08;
      } else if (currentAction === 'IDLE') {
        this.customModelGroup.rotation.z = 0;
        this.customModelGroup.rotation.x = 0;
        this.customModelGroup.rotation.y = baseRotY;
        this.customModelGroup.position.y = this.modelConfig.yOffset + Math.sin(animTime * 2.5) * 0.03;
      } else if (
        currentAction === 'ATTACK_1' ||
        currentAction === 'ATTACK_2' ||
        currentAction === 'ATTACK_3' ||
        currentAction === 'HEAVY_CLEAVE'
      ) {
        this.customModelGroup.rotation.y = baseRotY + Math.sin((0.32 - this.actionTimer) * 12) * 0.4;
      } else if (currentAction === 'DODGE_ROLL') {
        this.customModelGroup.rotation.x = (0.42 - this.actionTimer) * Math.PI * 4;
      } else {
        this.customModelGroup.rotation.x = 0;
        this.customModelGroup.rotation.z = 0;
        this.customModelGroup.rotation.y = baseRotY;
      }
    } else {
      // Default procedural knight articulation
      const animTime = this.clock.getElapsedTime();
      const currentAction = this.playerAction as string;
      if (currentAction === 'RUN' || currentAction === 'SPRINT') {
        const strideFreq = currentAction === 'SPRINT' ? 14 : 9;
        this.playerLeftLeg.rotation.x = Math.sin(animTime * strideFreq) * 0.65;
        this.playerRightLeg.rotation.x = -Math.sin(animTime * strideFreq) * 0.65;
        this.playerLeftArm.rotation.x = -Math.sin(animTime * strideFreq) * 0.45;
        this.playerRightArm.rotation.x = Math.sin(animTime * strideFreq) * 0.45;
        this.playerCape.rotation.x = 0.4 + Math.sin(animTime * strideFreq) * 0.25;
        this.playerTorso.position.y = 1.55 + Math.abs(Math.sin(animTime * strideFreq)) * 0.08;
      } else if (currentAction === 'IDLE') {
        this.playerLeftLeg.rotation.x = 0;
        this.playerRightLeg.rotation.x = 0;
        this.playerLeftArm.rotation.x = 0;
        this.playerRightArm.rotation.x = 0;
        this.playerTorso.position.y = 1.55 + Math.sin(animTime * 2.5) * 0.03;
        this.playerCape.rotation.x = 0.15 + Math.sin(animTime * 2) * 0.05;
      } else if (currentAction === 'ATTACK_1') {
        this.playerRightArm.rotation.z = -0.8;
        this.playerRightArm.rotation.y = Math.sin((0.32 - this.actionTimer) * 12) * 1.6;
      } else if (currentAction === 'ATTACK_2') {
        this.playerRightArm.rotation.z = 0.8;
        this.playerRightArm.rotation.y = -Math.sin((0.32 - this.actionTimer) * 12) * 1.6;
      } else if (currentAction === 'ATTACK_3' || currentAction === 'HEAVY_CLEAVE') {
        this.playerRightArm.rotation.x = -Math.PI * 0.7 + (1.0 - this.actionTimer) * Math.PI;
      } else if (currentAction === 'PARRY') {
        this.playerLeftArm.position.set(-0.2, 0.4, 0.3);
        this.playerLeftArm.rotation.y = 0.6;
      } else if (currentAction === 'DODGE_ROLL') {
        this.playerTorso.rotation.x = (0.42 - this.actionTimer) * Math.PI * 4;
      }
    }

    // Fade out sword arc
    const slashMat = this.slashTrailMesh.material as THREE.MeshBasicMaterial;
    if (slashMat.opacity > 0) {
      slashMat.opacity = Math.max(0, slashMat.opacity - 4.0 * clampedDelta);
    }

    // 4. Enemy AI Update
    this.enemies.forEach(enemy => {
      if (enemy.state === 'DEAD') {
        const mesh = this.enemyMeshes.get(enemy.id);
        if (mesh) {
          mesh.position.y = Math.max(-2, mesh.position.y - 1.5 * clampedDelta);
          mesh.scale.multiplyScalar(0.96);
        }
        return;
      }

      const enemyPos = new THREE.Vector3(enemy.x, enemy.y, enemy.z);
      const toPlayer = this.playerPosition.clone().sub(enemyPos);
      const dist = toPlayer.length();

      // Enemy Stagger Recovery
      if (enemy.state === 'STAGGER') {
        enemy.staggerTimer -= clampedDelta;
        if (enemy.staggerTimer <= 0) enemy.state = 'IDLE';
        return;
      }

      // AI Decision
      if (dist < 18) {
        toPlayer.normalize();
        enemy.rotationY = Math.atan2(toPlayer.x, toPlayer.z);

        const attackRange = enemy.type === 'MALAKOR_BOSS' ? 4.5 : 2.2;

        if (dist > attackRange) {
          // Chase player
          const speed = enemy.type === 'VOID_THRALL' ? 4.0 : enemy.type === 'MALAKOR_BOSS' ? 3.2 : 2.6;
          enemy.x += toPlayer.x * speed * clampedDelta;
          enemy.z += toPlayer.z * speed * clampedDelta;
          enemy.state = 'CHASE';
        } else {
          // Attack windup & attack execution
          enemy.attackTimer += clampedDelta;
          const windupDuration = enemy.type === 'MALAKOR_BOSS' ? 1.4 : 1.1;

          if (enemy.attackTimer >= windupDuration) {
            enemy.attackTimer = 0;
            const enemyDmg = enemy.type === 'MALAKOR_BOSS' ? 32 : enemy.type === 'CORRUPTED_GUARD' ? 22 : 14;
            this.damagePlayer(enemyDmg, enemy.name);
          }
        }
      }

      // Update enemy mesh position & rotation
      const eMesh = this.enemyMeshes.get(enemy.id);
      if (eMesh) {
        eMesh.position.set(enemy.x, enemy.y, enemy.z);
        eMesh.rotation.y = enemy.rotationY;
      }
    });

    // 5. Update Camera Position (Orbit & Target Lock)
    if (this.targetLockEnemy && this.targetLockEnemy.state !== 'DEAD') {
      const enemyPos = new THREE.Vector3(this.targetLockEnemy.x, this.targetLockEnemy.y, this.targetLockEnemy.z);
      const dir = enemyPos.clone().sub(this.playerPosition).normalize();
      this.cameraYaw = Math.atan2(-dir.x, -dir.z);
    }

    // Clamp pitch to safe bounds so camera never clips into the floor
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch, -0.10, 0.82);

    const targetCamX = this.playerPosition.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const targetCamY = Math.max(0.75, this.playerPosition.y + Math.sin(this.cameraPitch) * this.cameraDistance + 1.8);
    const targetCamZ = this.playerPosition.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    // Smooth exponential lerp (0.16) for cinematic smoothness without lag
    this.smoothedCamPos.x += (targetCamX - this.smoothedCamPos.x) * 0.16;
    this.smoothedCamPos.y += (targetCamY - this.smoothedCamPos.y) * 0.16;
    this.smoothedCamPos.z += (targetCamZ - this.smoothedCamPos.z) * 0.16;

    const targetLookY = this.playerPosition.y + 1.45;
    this.smoothedCamTarget.x += (this.playerPosition.x - this.smoothedCamTarget.x) * 0.16;
    this.smoothedCamTarget.y += (targetLookY - this.smoothedCamTarget.y) * 0.16;
    this.smoothedCamTarget.z += (this.playerPosition.z - this.smoothedCamTarget.z) * 0.16;

    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedCamTarget);

    // 6. Flickering Brazier Fire
    this.braziers.forEach((b, i) => {
      b.light.intensity = 1.8 + Math.sin(animTime * 8 + i * 2) * 0.4 + (Math.random() - 0.5) * 0.2;
    });

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += clampedDelta;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, clampedDelta);
      if (p.mesh.geometry.type === 'RingGeometry') {
        const scale = 1.0 + (p.life / p.maxLife) * 12.0;
        p.mesh.scale.set(scale, scale, 1);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - p.life / p.maxLife;
      } else {
        p.velocity.y -= 9.8 * clampedDelta;
        const fade = 1.0 - p.life / p.maxLife;
        p.mesh.scale.setScalar(p.size * fade);
      }
    }

    // 8. Render Scene
    this.renderer.render(this.scene, this.camera);
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const loop = () => {
      if (!this.isRunning) return;
      const delta = this.clock.getDelta();
      this.update(delta);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy() {
    this.stop();
    parallelAssetLoader.abort();
    soundManager.stopAmbientMusic();
    window.removeEventListener('resize', this.onWindowResize);
    if (this.renderer && this.renderer.domElement && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
